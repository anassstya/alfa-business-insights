"""Persist an analysis and its resolved source links in analysis_jobs.result."""

from __future__ import annotations

from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .contracts import AnalysisRequest, AnalysisResult
from .profile_repository import SupabaseSettings
from .jsonb_storage import JsonbWriteConflict, update_jsonb


class AnalysisJobStoreError(Exception):
    pass


class AnalysisJobPermissionError(AnalysisJobStoreError):
    pass


class AnalysisJobConflict(AnalysisJobStoreError):
    pass


def resolve_result_sources(result: AnalysisResult) -> AnalysisResult:
    """Inline source metadata from evidence, never a URL invented by the model."""
    records = {}
    if result.research_context is not None:
        records.update((e.evidence_id, e) for e in result.research_context.evidence)
    records.update((e.evidence_id, e) for e in result.evidence)
    insights = []
    used = {}
    for insight in result.insights:
        quotes = {s.get("evidence_id"): s.get("quote") for s in insight.evidence_sources}
        sources = []
        for ref in insight.evidence_refs:
            if ref not in records:
                raise AnalysisJobStoreError("insight references missing evidence")
            source = records[ref]
            quote = quotes.get(ref) or source.excerpt
            if " ".join(quote.casefold().split()) not in " ".join(source.excerpt.casefold().split()):
                raise AnalysisJobStoreError("source quote does not match evidence")
            sources.append({
                "evidence_id": ref, "title": source.title,
                "publisher": source.publisher, "url": source.url,
                "source_kind": source.source_kind,
                "published_at": source.published_at.isoformat() if source.published_at else None,
                "retrieved_at": source.retrieved_at.isoformat(),
                "page_number": source.page_number, "quote": quote,
            })
            used[ref] = source
        insights.append(insight.model_copy(update={"evidence_sources": sources}, deep=True))
    return result.model_copy(update={"insights": insights,
                                     "evidence": list(used.values())}, deep=True)


class SupabaseAnalysisJobRepository:
    def __init__(self, engine):
        self.engine = engine

    @classmethod
    def from_env(cls):
        return cls(SupabaseSettings().create_engine())

    def close(self):
        self.engine.dispose()

    def assert_access(self):
        # Column-level INSERT/UPDATE grants are enough; do not require admin access.
        checks = ["has_table_privilege(current_user, 'public.analysis_jobs', 'SELECT')"]
        for privilege, columns in (
            ("INSERT", ("id", "company_id", "role", "goal", "status", "stage")),
            ("UPDATE", ("status", "stage", "result", "error_message", "updated_at")),
        ):
            checks.extend(
                f"has_column_privilege(current_user, 'public.analysis_jobs', '{col}', '{privilege}')"
                for col in columns
            )
        try:
            with self.engine.connect() as conn:
                allowed = conn.execute(text("SELECT " + " AND ".join(checks))).scalar_one()
        except SQLAlchemyError as exc:
            raise AnalysisJobStoreError("analysis_jobs access check failed") from exc
        if not allowed:
            raise AnalysisJobPermissionError(
                "analysis_jobs access denied; apply ml/sql/analysis_jobs_access.sql as database owner"
            )

    def start(self, request: AnalysisRequest):
        """Create or claim a pending/failed job; never overwrite a running/completed one."""
        self.assert_access()  # Fail before paid model/search requests.
        try:
            with self.engine.connect() as conn:
                row = conn.execute(text("""
                    INSERT INTO public.analysis_jobs
                        (id, company_id, role, goal, status, stage)
                    SELECT CAST(:job_id AS uuid), c.id, :role, :goal,
                           'running', 'loading_profile'
                    FROM public.companies c
                    WHERE c.id = :company_row_id AND c.synthetic_u = :company_id
                    ON CONFLICT (id) DO UPDATE SET
                        status = 'running', stage = 'loading_profile',
                        result = NULL, error_message = NULL, updated_at = now()
                    WHERE analysis_jobs.company_id = EXCLUDED.company_id
                      AND analysis_jobs.role = EXCLUDED.role
                      AND analysis_jobs.goal IS NOT DISTINCT FROM EXCLUDED.goal
                      AND analysis_jobs.status IN ('pending', 'failed')
                    RETURNING id
                """), {
                    "job_id": str(request.job_id), "company_row_id": request.company_row_id,
                    "company_id": request.company_id, "role": request.role, "goal": request.goal,
                }).first()
            if row is None:
                raise AnalysisJobConflict("job already running/completed or request identity does not match")
        except SQLAlchemyError as exc:
            self._raise_store_error(exc, "analysis_jobs start failed")

    def save(self, request: AnalysisRequest, result: AnalysisResult):
        if (result.job_id != request.job_id or result.company_id != request.company_id
                or result.company_row_id != request.company_row_id
                or result.role != request.role or result.goal != request.goal):
            raise AnalysisJobConflict("analysis result identity does not match request")
        try:
            update_jsonb(self.engine, table="analysis_jobs", column="result",
                where="""id = CAST(:job_id AS uuid) AND company_id = :company_row_id
                    AND role = :role AND goal IS NOT DISTINCT FROM :goal AND status = 'running'""",
                params={
                    "job_id": str(request.job_id), "company_row_id": request.company_row_id,
                    "role": request.role, "goal": request.goal,
                }, document=result.model_dump_json(), updates={
                    "status": "failed" if result.outcome == "failed" else "completed",
                    "stage": "completed",
                    "error_message": "analysis_failed; see result.warnings" if result.outcome == "failed" else None,
                })
        except JsonbWriteConflict as exc:
            raise AnalysisJobConflict("running analysis job not found or upload superseded") from exc
        except SQLAlchemyError as exc:
            self._raise_store_error(exc, "analysis_jobs result save failed")

    @staticmethod
    def _raise_store_error(exc, message):
        if getattr(getattr(exc, "orig", None), "sqlstate", None) == "42501":
            raise AnalysisJobPermissionError(
                "analysis_jobs access denied; apply ml/sql/analysis_jobs_access.sql as database owner"
            ) from exc
        # SQLAlchemy errors can contain connection information and bound JSON. Never expose them.
        raise AnalysisJobStoreError(message) from exc


def analyze_and_save(pipeline, request: AnalysisRequest, jobs, on_event=None) -> AnalysisResult:
    """A successful return guarantees the complete result was passed to the job store."""
    jobs.start(request)
    try:
        result = pipeline.analyze(request, on_event=on_event)
        result = resolve_result_sources(result)
    except Exception as exc:
        result = AnalysisResult(
            job_id=request.job_id, run_id=uuid4(), company_id=request.company_id,
            company_row_id=request.company_row_id, role=request.role, goal=request.goal,
            as_of=request.as_of, mode="live", outcome="failed",
            warnings=[f"analysis_exception:{type(exc).__name__}"],
        )
    jobs.save(request, result)
    return result
