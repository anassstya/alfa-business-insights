"""Read and replace only the web_research block of a prepared company payload."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from pydantic import BaseModel, ConfigDict
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .contracts import CompanyResearchContext, Role
from .profile_repository import SupabaseSettings
from .jsonb_storage import JsonbWriteConflict, read_web_research, update_jsonb


class ResearchContextStoreError(Exception):
    pass


class ResearchContextPermissionError(ResearchContextStoreError):
    pass


class ResearchScope(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Role
    goal: str
    lookback_days: int
    as_of: datetime
    planner_version: str
    exposure_version: str
    model: str
    search_task_limit: int
    provider: str = "tavily"


class SavedWebResearch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    context: CompanyResearchContext
    scope: ResearchScope
    refreshed_at: datetime


class ResearchContextRepository:
    def replace_alfa_analytics(self, company_id, context, scope):
        raise NotImplementedError

    def get_web_research(self, company_id: str) -> SavedWebResearch | None:
        raise NotImplementedError

    def replace_web_research(self, company_id: str, context: CompanyResearchContext,
                             scope: ResearchScope) -> SavedWebResearch:
        raise NotImplementedError


def _block(company_id, context, scope):
    if company_id != context.company_id:
        raise ValueError("company_id mismatch")
    return SavedWebResearch(context=context, scope=scope, refreshed_at=datetime.now(timezone.utc))


class JsonResearchContextRepository(ResearchContextRepository):
    """Small, explicit offline JSON file; caller must use a temporary copy."""

    def __init__(self, path: Path):
        self.path = Path(path)

    def _read(self):
        return json.loads(self.path.read_text(encoding="utf-8"))

    def get_web_research(self, company_id):
        payload = self._read()
        if payload.get("company_id") != company_id:
            raise ResearchContextStoreError("company context missing")
        block = payload.get("web_research")
        return SavedWebResearch.model_validate(block) if block else None

    def replace_web_research(self, company_id, context, scope):
        return self._replace(company_id, context, scope, 'web_research')

    def replace_alfa_analytics(self, company_id, context, scope):
        return self._replace(company_id, context, scope, 'alfa_analytics')

    def _replace(self, company_id, context, scope, destination):
        block = _block(company_id, context, scope)
        payload = self._read()
        if payload.get("company_id") != company_id or "base_information" not in payload:
            raise ResearchContextStoreError("prepared company context missing")
        payload[destination] = block.model_dump(mode="json")
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(self.path)
        return block


class SupabaseResearchContextRepository(ResearchContextRepository):
    def __init__(self, engine):
        self.engine = engine

    @classmethod
    def from_env(cls):
        return cls(SupabaseSettings().create_engine())

    def close(self):
        self.engine.dispose()

    def can_update_web_research(self) -> bool:
        """Read-only privilege probe; an UPDATE may still be denied by RLS."""
        try:
            with self.engine.connect() as conn:
                row = conn.execute(text("""SELECT
                    has_column_privilege(current_user, 'public.company_contexts', 'payload', 'UPDATE')
                    AND has_column_privilege(current_user, 'public.company_contexts', 'updated_at', 'UPDATE')""")).scalar_one()
            return bool(row)
        except SQLAlchemyError as exc:
            raise ResearchContextStoreError("UPDATE privilege check failed") from exc

    def get_web_research(self, company_id):
        try:
            value = read_web_research(self.engine, company_id)
            return SavedWebResearch.model_validate(value) if value else None
        except JsonbWriteConflict as exc:
            raise ResearchContextStoreError(str(exc)) from exc
        except SQLAlchemyError as exc:
            raise ResearchContextStoreError("web research read failed") from exc

    def replace_web_research(self, company_id, context, scope):
        return self._replace(company_id, context, scope, 'web_research')

    def replace_alfa_analytics(self, company_id, context, scope):
        return self._replace(company_id, context, scope, 'alfa_analytics')

    def _replace(self, company_id, context, scope, destination):
        block = _block(company_id, context, scope)
        if not self.can_update_web_research():
            raise ResearchContextPermissionError("UPDATE company_contexts permission denied")
        try:
            update_jsonb(self.engine, table="company_contexts", column="payload",
                         where="company_id=:id AND payload ? 'base_information'",
                         params={"id": company_id}, document=block.model_dump_json(),
                         destination=destination)
            return block
        except JsonbWriteConflict as exc:
            raise ResearchContextStoreError("prepared company context missing or upload superseded") from exc
        except SQLAlchemyError as exc:
            code = getattr(getattr(exc, "orig", None), "sqlstate", None)
            if code == "42501":
                raise ResearchContextPermissionError("UPDATE company_contexts permission denied") from exc
            raise ResearchContextStoreError("web research save failed") from exc
