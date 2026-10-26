"""Read-only loaders for the existing generated company profile."""

from __future__ import annotations

import csv
import hashlib
import json
import os
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping

from .runtime_environment import load_runtime_environment
from psycopg import ClientCursor
from pydantic import ValidationError
from sqlalchemy import URL, create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.engine import Engine
from sqlalchemy.pool import NullPool

from .contracts import BaseCompanyProfile


ROOT = Path(__file__).resolve().parents[2]
STAGE_KEY = "__base_context_upload_chunks__"


class CompanyNotFound(Exception):
    pass


class ProfileNotPrepared(Exception):
    pass


class AmbiguousCompanyIdentity(Exception):
    pass


class InvalidProfile(Exception):
    pass


class CompanyIdentityMismatch(InvalidProfile):
    pass


class ProfileStoreUnavailable(Exception):
    pass


def _profile(company_id: str, payload: Any, source: str,
             updated_at: datetime | None = None) -> BaseCompanyProfile:
    if not isinstance(payload, dict):
        raise InvalidProfile("payload must be an object")
    if STAGE_KEY in payload:
        raise ProfileNotPrepared("profile upload is incomplete")
    if "base_information" not in payload:
        raise ProfileNotPrepared("base_information is absent")
    if payload.get("company_id") != company_id:
        raise InvalidProfile("payload company_id does not match key")
    base = payload["base_information"]
    if not isinstance(base, dict):
        raise InvalidProfile("base_information must be an object")
    try:
        canonical = json.dumps(base, ensure_ascii=False, sort_keys=True,
                               separators=(",", ":"), allow_nan=False)
        digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        warnings = ["revenue period and currency are unknown", "payments do not establish goods or services"]
        return BaseCompanyProfile(company_id=company_id, base_information=base,
                                  source=source, source_updated_at=updated_at,
                                  profile_hash=digest, warnings=warnings)
    except (TypeError, ValueError, ValidationError) as exc:
        raise InvalidProfile("invalid base_information") from exc


class CompanyProfileRepository(ABC):
    def resolve_company_identity(self, company_id: int | str) -> tuple[str, int]:
        """Resolve a numeric companies.id or synthetic_u to (synthetic_u, row id)."""
        raise NotImplementedError

    @abstractmethod
    def get_company_profile(self, company_id: str, company_row_id: int | None = None) -> BaseCompanyProfile:
        """Fetch one profile; optional numeric ID must match the unique company row."""


def _check_identity(company_id: str, row_ids: list[int], company_row_id: int | None) -> None:
    if not row_ids:
        raise CompanyNotFound(company_id)
    if len(row_ids) > 1:
        raise AmbiguousCompanyIdentity(company_id)
    if company_row_id is not None and (isinstance(company_row_id, bool) or
                                       company_row_id != row_ids[0]):
        raise CompanyIdentityMismatch("company_row_id does not match company_id")


class JsonCompanyProfileRepository(CompanyProfileRepository):
    """Explicit offline snapshot. File and identity index are loaded once per instance."""

    def __init__(self, path: Path, *, companies_csv: Path | None = None,
                 identity_rows: Mapping[str, list[int]] | None = None):
        self.path = Path(path)
        try:
            records = json.loads(self.path.read_text(encoding="utf-8"))
            if isinstance(records, list):
                self.records = {record["company_id"]: record for record in records}
                if len(self.records) != len(records):
                    raise InvalidProfile("duplicate company_id in JSON")
            elif isinstance(records, dict):
                self.records = records
            else:
                raise InvalidProfile("JSON root must be list or object")
            if identity_rows is not None:
                self.identities = {key: list(value) for key, value in identity_rows.items()}
            elif companies_csv is not None:
                self.identities: dict[str, list[int]] = {}
                with Path(companies_csv).open(encoding="utf-8-sig", newline="") as stream:
                    for row in csv.DictReader(stream):
                        self.identities.setdefault(row["synthetic_u"], []).append(int(row["id"]))
            else:
                # A small fixture may omit the company table. Only profile existence
                # can then be checked; numeric ID verification requires identity rows.
                self.identities = {key: [0] for key in self.records}
        except (OSError, UnicodeError, json.JSONDecodeError, KeyError, ValueError) as exc:
            raise ProfileStoreUnavailable("cannot load offline profile snapshot") from exc

    def resolve_company_identity(self, company_id: int | str) -> tuple[str, int]:
        if isinstance(company_id, bool) or not isinstance(company_id, (int, str)):
            raise ValueError("company_id must be a positive integer or synthetic_u")
        if isinstance(company_id, int):
            if company_id <= 0:
                raise ValueError("company_id must be positive")
            matches = [key for key, ids in self.identities.items() if company_id in ids]
            if not matches:
                raise CompanyNotFound(str(company_id))
            if len(matches) != 1:
                raise AmbiguousCompanyIdentity(str(company_id))
            company_id = matches[0]
        ids = self.identities.get(company_id, [])
        if ids == [0]:
            raise ProfileStoreUnavailable("numeric identity index is required for company analysis")
        _check_identity(company_id, ids, None)
        return company_id, ids[0]

    def get_company_profile(self, company_id: str, company_row_id: int | None = None) -> BaseCompanyProfile:
        if not isinstance(company_id, str):
            raise ValueError("company_id must be a string synthetic_u")
        if company_row_id is not None and self.identities.get(company_id) == [0]:
            raise ProfileStoreUnavailable("identity index required to verify company_row_id")
        _check_identity(company_id, self.identities.get(company_id, []), company_row_id)
        payload = self.records.get(company_id)
        if payload is None:
            raise ProfileNotPrepared(company_id)
        return _profile(company_id, payload, "json")


class SupabaseSettings:
    """Explicit remote PostgreSQL settings; never infer localhost or a port."""

    def __init__(self, environ: Mapping[str, str] | None = None):
        if environ is None:
            load_runtime_environment()
            environ = os.environ
        required = ("POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_USER", "POSTGRES_PASSWORD",
                    "POSTGRES_DB", "POSTGRES_CONNECTION_MODE")
        missing = [key for key in required if not environ.get(key)]
        if missing:
            raise ProfileStoreUnavailable("missing remote settings: " + ", ".join(missing))
        self.mode = environ["POSTGRES_CONNECTION_MODE"]
        if self.mode not in ("direct", "session", "transaction"):
            raise ProfileStoreUnavailable("invalid POSTGRES_CONNECTION_MODE")
        host = environ["POSTGRES_HOST"]
        if host.lower() in ("localhost", "127.0.0.1", "::1"):
            raise ProfileStoreUnavailable("POSTGRES_HOST must be remote")
        try:
            port = int(environ["POSTGRES_PORT"])
            timeout = int(environ.get("POSTGRES_CONNECT_TIMEOUT", "5"))
            if not 1 <= port <= 65535 or not 1 <= timeout <= 30:
                raise ValueError
        except ValueError as exc:
            raise ProfileStoreUnavailable("invalid port or connect timeout") from exc
        self.url = URL.create("postgresql+psycopg", username=environ["POSTGRES_USER"],
                              password=environ["POSTGRES_PASSWORD"], host=host,
                              port=port, database=environ["POSTGRES_DB"])
        self.connect_args = {"connect_timeout": timeout,
                             "sslmode": environ.get("POSTGRES_SSLMODE", "require"),
                             "autocommit": True, "gssencmode": "disable",
                             "cursor_factory": ClientCursor}
        if self.connect_args["sslmode"] not in ("require", "verify-ca", "verify-full"):
            raise ProfileStoreUnavailable("SSL mode must verify or require TLS")
        if self.mode == "transaction":
            self.connect_args["prepare_threshold"] = None

    def create_engine(self) -> Engine:
        engine = create_engine(self.url, connect_args=self.connect_args,
                               isolation_level="AUTOCOMMIT", use_native_hstore=False,
                               poolclass=NullPool, hide_parameters=True,
                               skip_autocommit_rollback=True)
        # The current remote connection stalls after several statements. Initialize
        # the dialect on a disposable connection; each actual operation then uses
        # one fresh connection and one atomic statement, as the batch writer does.
        try:
            with engine.connect():
                pass
        except SQLAlchemyError as exc:
            engine.dispose()
            raise ProfileStoreUnavailable("remote database initialization failed") from exc
        return engine


class SupabaseCompanyProfileRepository(CompanyProfileRepository):
    def __init__(self, engine: Engine):
        self.engine = engine

    @classmethod
    def from_env(cls) -> "SupabaseCompanyProfileRepository":
        return cls(SupabaseSettings().create_engine())

    def close(self) -> None:
        self.engine.dispose()

    def resolve_company_identity(self, company_id: int | str) -> tuple[str, int]:
        if isinstance(company_id, bool) or not isinstance(company_id, (int, str)):
            raise ValueError("company_id must be a positive integer or synthetic_u")
        if isinstance(company_id, int) and company_id <= 0:
            raise ValueError("company_id must be positive")
        column = "id" if isinstance(company_id, int) else "synthetic_u"
        try:
            with self.engine.connect() as conn:
                rows = conn.execute(text(f"SELECT id, synthetic_u FROM public.companies "
                                         f"WHERE {column}=:value ORDER BY id LIMIT 2"),
                                    {"value": company_id}).all()
        except SQLAlchemyError as exc:
            raise ProfileStoreUnavailable("company identity lookup failed") from exc
        if not rows:
            raise CompanyNotFound(str(company_id))
        if len(rows) != 1:
            raise AmbiguousCompanyIdentity(str(company_id))
        return rows[0][1], rows[0][0]

    def get_company_profile(self, company_id: str, company_row_id: int | None = None) -> BaseCompanyProfile:
        if not isinstance(company_id, str):
            raise ValueError("company_id must be a string synthetic_u")
        try:
            with self.engine.connect() as conn:
                # One SELECT obtains a consistent identity/profile without session state.
                # Short autocommit statements avoid the observed pooler transaction hangs.
                rows = conn.execute(text("""SELECT c.id,
                    x.payload - 'web_research' - 'alfa_analytics' - '__ml_jsonb_upload__', x.updated_at
                    FROM public.companies c
                    LEFT JOIN public.company_contexts x ON x.company_id = c.synthetic_u
                    WHERE c.synthetic_u = :company_id ORDER BY c.id LIMIT 2"""),
                    {"company_id": company_id}).all()
            _check_identity(company_id, [row[0] for row in rows], company_row_id)
            if rows[0][1] is None:
                raise ProfileNotPrepared(company_id)
            try:
                payload = json.loads(rows[0][1]) if isinstance(rows[0][1], str) else rows[0][1]
            except json.JSONDecodeError as exc:
                raise InvalidProfile("invalid JSON payload") from exc
            return _profile(company_id, payload, "supabase", rows[0][2])
        except SQLAlchemyError as exc:
            raise ProfileStoreUnavailable("profile store query failed") from exc
