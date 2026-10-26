"""Public entry point: analyze_company(company_id, role, goal=None)."""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from .runtime_environment import load_runtime_environment
from pydantic import Field, field_validator

from .api import GatewayClient, ModelSettings
from .backend_callback import BackendCallbackClient, CallbackSettings, analyze_with_callback
from .contracts import AnalysisRequest, AnalysisResult, Contract, Role
from .pipeline import AnalysisPipeline
from .profile_repository import ROOT, JsonCompanyProfileRepository, SupabaseCompanyProfileRepository
from .research_context_repository import SupabaseResearchContextRepository
from .research_pipeline import ResearchPipeline
from .web_pipeline import WebAnalysisPipeline
from .web_research import FileEvidenceStore, HTTPDocumentFetcher, TavilySearchProvider


class CompanyAnalysisInput(Contract):
    company_id: int | str
    role: Role
    goal: str | None = Field(default=None, max_length=1000)
    job_id: UUID | None = None
    as_of: datetime | None = None

    @field_validator("company_id", mode="before")
    @classmethod
    def validate_company_id(cls, value):
        if type(value) is int and value > 0:
            return value
        if isinstance(value, str) and re.fullmatch(r"U_[A-Za-z0-9_]{1,126}", value):
            return value
        raise ValueError("company_id must be a positive companies.id or a string U_…")


def analyze_company(company_id: int | str, role: Role, goal: str | None = None, *,
                    job_id: UUID | str | None = None,
                    as_of: datetime | None = None) -> AnalysisResult:
    """Run analysis synchronously using the configured Supabase, Tavily and LLM.

    company_id accepts companies.id (e.g. 70) or synthetic_u (e.g. 'U_1').
    Supply a backend-created job_id to enable configured callback delivery.
    Without job_id a local trace UUID is generated, without creating a DB job.
    """
    return _analyze_company(CompanyAnalysisInput(company_id=company_id, role=role, goal=goal,
                                                job_id=job_id, as_of=as_of))


def _analyze_company(body: CompanyAnalysisInput, *, fixture_mode: bool | None = None,
                     callback_settings: CallbackSettings | None = None,
                     callback_client=None, evidence_cache: Path | None = None) -> AnalysisResult:
    load_runtime_environment()
    if fixture_mode is None:
        fixture_mode = os.getenv("ML_FIXTURE_MODE", "false").lower() in ("1", "true", "yes")
    repository = (JsonCompanyProfileRepository(ROOT / "ml/fixtures/company_profiles.json",
                                              identity_rows={"U_EXAMPLE": [123]})
                  if fixture_mode else SupabaseCompanyProfileRepository.from_env())
    callback = None
    owns_callback = False
    try:
        synthetic_u, row_id = repository.resolve_company_identity(body.company_id)
        request = AnalysisRequest(
            job_id=body.job_id or uuid4(), company_id=synthetic_u, company_row_id=row_id,
            role=body.role, goal=body.goal, as_of=body.as_of or datetime.now(timezone.utc),
        )
        settings = callback_settings or CallbackSettings.from_environment()
        # No backend job exists for a three-argument standalone invocation.
        # Do not publish an invented job ID or write analysis_jobs ourselves.
        if body.job_id is not None:
            callback = callback_client
            if callback is None and settings.enabled:
                callback = BackendCallbackClient(settings)
                owns_callback = True

        def run(on_event):
            if fixture_mode:
                return AnalysisPipeline(repository).analyze(request, on_event=on_event)
            research = ResearchPipeline(
                repository, GatewayClient(ModelSettings.from_environment()),
                TavilySearchProvider(), HTTPDocumentFetcher(),
                FileEvidenceStore(evidence_cache or ROOT / "ml/.cache/web"),
            )
            runner = WebAnalysisPipeline(research, SupabaseResearchContextRepository(repository.engine))
            return runner.analyze(request, on_event=on_event)

        return analyze_with_callback(request, run, callback)
    finally:
        if owns_callback:
            callback.close()
        if not fixture_mode:
            repository.close()
