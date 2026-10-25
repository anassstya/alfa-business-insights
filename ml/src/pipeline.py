"""Fixture milestone pipeline. No external search, model calls, or database writes."""

from __future__ import annotations

import hashlib
import os
from collections.abc import Callable
from datetime import datetime, timezone, timedelta
from pathlib import Path
from uuid import uuid4

from .contracts import AnalysisRequest, AnalysisResult, CompanyResearchContext, EvidenceRecord, Insight, ResearchWindow, StageEvent, VERSION
from .exposures import RULE_VERSION, build_exposures
from .profile_repository import CompanyProfileRepository, JsonCompanyProfileRepository


FIXTURE_WARNING = "DEMONSTRATION ONLY: evidence and insight are hypothetical, not live news or bank research"
STAGES = ("loading_profile", "mapping_exposures", "planning", "retrieving",
          "analyzing", "validating", "completed")


class FixtureEvidenceProvider:
    """A hypothetical scenario, explicitly marked as fixture in the v1 contract."""

    def get_evidence(self, request: AnalysisRequest) -> list[EvidenceRecord]:
        excerpt = "Hypothetical scenario: financing terms could change. No actual event is asserted."
        return [EvidenceRecord(
            evidence_id="fixture-financing-1", document_id="fixture-scenario-1",
            source_kind="fixture", title="DEMO SCENARIO: possible financing terms change",
            publisher="ML fixture", url=None, published_at=None,
            retrieved_at=request.as_of, event_at=None, excerpt=excerpt,
            content_hash=hashlib.sha256(excerpt.encode()).hexdigest(),
            date_status="unknown", content_status="excerpt_only",
        )]


class FixtureInsightBuilder:
    def build(self, request: AnalysisRequest, evidence: list[EvidenceRecord]) -> list[Insight]:
        if not evidence or request.max_insights == 0:
            return []
        return [Insight(
            insight_id="fixture-impact-1",
            event="DEMO SCENARIO: financing terms might change; no real event was found.",
            company_relevance="A company profile was loaded. Its actual financing exposure is unknown in this demonstration.",
            role_relevance=f"For role {request.role}, verify whether financing terms affect the stated goal.",
            impact_chain=["Hypothetical change in financing terms", "Actual exposure requires verification",
                          "Possible effect on future financing decisions"],
            risks=["A decision based on an unverified scenario could be misleading"],
            suggested_actions=["Check primary sources and current financing terms before acting"],
            assumptions=["The scenario is hypothetical; no current borrowing or debt amount is inferred"],
            uncertainty="Illustrative only; no live evidence or bank position was consulted.",
            evidence_refs=[evidence[0].evidence_id],
            feature_refs=["/base_information/profile"], rank=1,
        )]


class AnalysisPipeline:
    def __init__(self, repository: CompanyProfileRepository, *,
                 evidence_provider: FixtureEvidenceProvider | None = None,
                 insight_builder: FixtureInsightBuilder | None = None):
        self.repository = repository
        self.evidence_provider = evidence_provider or FixtureEvidenceProvider()
        self.insight_builder = insight_builder or FixtureInsightBuilder()

    def analyze(self, request: AnalysisRequest,
                on_event: Callable[[StageEvent], None] | None = None) -> AnalysisResult:
        if not isinstance(request, AnalysisRequest):
            request = AnalysisRequest.model_validate(request)
        run_id = uuid4()
        trace: list[StageEvent] = []

        def emit(stage: str, state: str, summary: str, **counters: int) -> None:
            event = StageEvent(job_id=request.job_id, run_id=run_id, seq=len(trace) + 1,
                               stage=stage, state=state, at=datetime.now(timezone.utc),
                               summary=summary, counters=counters)
            trace.append(event)
            if on_event:
                on_event(event)

        common = dict(job_id=request.job_id, run_id=run_id, company_id=request.company_id,
                      company_row_id=request.company_row_id, role=request.role, goal=request.goal,
                      as_of=request.as_of, mode="fixture",
                      versions={"contract": VERSION, "pipeline": "fixture-1",
                                "evidence": "fixture-1", "insight": "fixture-1"},
                      usage={"llm_calls": 0, "search_calls": 0})
        emit("loading_profile", "started", "Loading prepared profile")
        try:
            profile = self.repository.get_company_profile(request.company_id, request.company_row_id)
        except Exception as exc:
            emit("loading_profile", "failed", f"Profile load failed: {type(exc).__name__}")
            return AnalysisResult(**common, outcome="failed", warnings=[FIXTURE_WARNING,
                                  f"profile_load_failed: {type(exc).__name__}"], trace=trace)
        emit("loading_profile", "completed", "Prepared profile loaded")

        emit("mapping_exposures", "started", "Mapping profile factors")
        exposures = build_exposures(profile, request.role, request.goal)
        emit("mapping_exposures", "completed", "Profile factors mapped", exposures=len(exposures))
        research_context = CompanyResearchContext(
            company_id=request.company_id, profile_hash=profile.profile_hash,
            as_of=request.as_of,
            window=ResearchWindow(start=request.as_of - timedelta(days=request.lookback_days), end=request.as_of),
            exposures=exposures, coverage={"mode": "fixture", "web_research": "not_started"},
            gaps=["No live web research was performed"], versions={"exposure_rules": RULE_VERSION})
        emit("planning", "skipped", "Fixture mode has no live planner")

        emit("retrieving", "started", "Loading hypothetical fixture evidence")
        try:
            evidence = self.evidence_provider.get_evidence(request)
            emit("retrieving", "completed", "Fixture evidence loaded", evidence=len(evidence))
            emit("analyzing", "started", "Building hypothetical fixture insight")
            insights = self.insight_builder.build(request, evidence)
            emit("analyzing", "completed", "Fixture insight built", insights=len(insights))
            emit("validating", "started", "Validating references and result")
            evidence_ids = {item.evidence_id for item in evidence}
            for insight in insights:
                if not set(insight.evidence_refs) <= evidence_ids:
                    raise ValueError("insight references absent evidence")
                for ref in insight.feature_refs:
                    if ref != "/base_information/profile":
                        raise ValueError("insight references absent feature")
            outcome = "ok" if insights else "partial"
            warnings = [FIXTURE_WARNING]
            if not insights:
                warnings.append("No fixture insight produced; max_insights may be zero")
            result = AnalysisResult(**common, outcome=outcome, insights=insights,
                                    evidence=evidence, profile_snapshot=profile,
                                    research_context=research_context,
                                    warnings=warnings, trace=trace)
            emit("validating", "completed", "Result validated")
            emit("completed", "completed", "Fixture analysis finished")
            return result.model_copy(update={"trace": trace})
        except Exception as exc:
            stage = trace[-1].stage
            emit(stage, "failed", f"Fixture analysis failed: {type(exc).__name__}")
            return AnalysisResult(**common, outcome="failed", profile_snapshot=profile,
                                  research_context=research_context,
                                  warnings=[FIXTURE_WARNING, f"analysis_failed: {type(exc).__name__}"],
                                  trace=trace)


def analyze(request: AnalysisRequest, on_event: Callable[[StageEvent], None] | None = None,
            *, repository: CompanyProfileRepository | None = None,
            evidence_provider: FixtureEvidenceProvider | None = None,
            insight_builder: FixtureInsightBuilder | None = None) -> AnalysisResult:
    if repository is None:
        if os.environ.get("ML_FIXTURE_MODE", "").lower() not in ("1", "true", "yes"):
            raise RuntimeError("ML_FIXTURE_MODE=true is required for fixture analysis")
        repository = JsonCompanyProfileRepository(
            Path(__file__).resolve().parents[1] / "fixtures/company_profiles.json",
            identity_rows={"U_EXAMPLE": [123]})
    return AnalysisPipeline(repository, evidence_provider=evidence_provider,
                            insight_builder=insight_builder).analyze(request, on_event)
