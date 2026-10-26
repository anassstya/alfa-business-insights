"""Live web analysis; backend owns analysis_jobs and persists the returned result."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from .budget import BudgetExceeded, BudgetManager
from .bank_research import enrich_with_timeout
from .api import ModelError
from .contracts import AnalysisRequest, AnalysisResult, StageEvent, VERSION
from .exposures import RULE_VERSION
from .impact import IMPACT_VERSION, build_insights
from .research_context_repository import ResearchScope, ResearchContextStoreError
from .research_pipeline import PIPELINE_VERSION, ResearchPipeline


def make_scope(request: AnalysisRequest, *, model: str, provider: str,
               search_task_limit: int) -> ResearchScope:
    return ResearchScope(role=request.role, goal=" ".join((request.goal or "").casefold().split()),
                         lookback_days=request.lookback_days, as_of=request.as_of,
                         planner_version=PIPELINE_VERSION, exposure_version=RULE_VERSION,
                         model=model, provider=provider, search_task_limit=search_task_limit)


class WebAnalysisPipeline:
    def __init__(self, research: ResearchPipeline, context_repository, bank_provider=None):
        self.research = research
        self.context_repository = context_repository
        self.bank_provider = bank_provider

    def analyze(self, request: AnalysisRequest, on_event=None, *,
                budget: BudgetManager | None = None) -> AnalysisResult:
        request = AnalysisRequest.model_validate(request)
        # Six web tasks retain their original allowance; bank retrieval gets one extra call.
        budget = budget or BudgetManager(max_tool_calls=7)
        run_id = uuid4()
        trace, warnings = [], []
        profile = context = None
        def emit(stage, state, summary, **counters):
            event = StageEvent(job_id=request.job_id, run_id=run_id, seq=len(trace)+1,
                               stage=stage, state=state, at=datetime.now(timezone.utc),
                               summary=summary, counters=counters)
            trace.append(event)
            if on_event:
                on_event(event)
        common = dict(job_id=request.job_id, run_id=run_id, company_id=request.company_id,
                      company_row_id=request.company_row_id, role=request.role, goal=request.goal,
                      as_of=request.as_of, mode="live",
                      versions={"contract": VERSION, "research": PIPELINE_VERSION,
                                "impact": IMPACT_VERSION, "exposures": RULE_VERSION})
        try:
            emit("loading_profile", "started", "Loading prepared profile")
            profile = self.research.repository.get_company_profile(request.company_id, request.company_row_id)
            emit("loading_profile", "completed", "Prepared profile loaded")
            scope = make_scope(request, model=self.research.model.settings.model,
                               provider=type(self.research.provider).__name__,
                               search_task_limit=budget.max_search_tasks)
            saved = self.context_repository.get_web_research(request.company_id)
            compatible = bool(saved and saved.context.company_id == request.company_id and
                              saved.scope == scope and
                              saved.context.profile_hash == profile.profile_hash)
            fresh = compatible and saved.context.expires_at is not None and \
                saved.context.expires_at > datetime.now(timezone.utc)
            if fresh and not request.refresh_web_research:
                context = saved.context.model_copy(deep=True)
                emit("retrieving", "skipped", "Compatible saved web research reused")
            else:
                def forward_research_event(event):
                    if event.stage not in ("loading_profile", "completed"):
                        emit(event.stage, event.state, event.summary, **event.counters)
                context = self.research.run(request, budget=budget, profile=profile,
                                            on_event=forward_research_event)
                if context.coverage.get("all_sources_unavailable"):
                    warnings.append("all_web_sources_unavailable")
                    if compatible and saved.context.evidence:
                        context = saved.context.model_copy(deep=True)
                        warnings.append("stale_saved_context_used")
                    else:
                        context = None
                else:
                    self.context_repository.replace_web_research(request.company_id, context, scope)
            if context is None:
                emit("completed", "failed", "All web sources unavailable")
                return AnalysisResult(**common, outcome="failed", profile_snapshot=profile,
                                      warnings=warnings, trace=trace, usage=budget.usage())
            if self.bank_provider is not None:
                emit('retrieving', 'started', 'Retrieving supplementary bank PDF context')
                try:
                    bank = enrich_with_timeout(self.bank_provider, request, profile, context, budget)
                    available = max(0, 48 - len(context.evidence))
                    if len(bank.evidence) > available:
                        warnings.append('bank_evidence_context_limit')
                    bank = bank.model_copy(update={'evidence': bank.evidence[:available]}, deep=True)
                    bank.coverage['matches'] = len(bank.evidence)
                    context = context.model_copy(update={
                        'evidence': context.evidence + bank.evidence,
                        'coverage': {**context.coverage, 'bank_research': bank.coverage},
                        'gaps': list(dict.fromkeys(context.gaps + bank.gaps))[:30],
                        'versions': {**context.versions, **bank.versions}}, deep=True)
                    try:
                        self.context_repository.replace_alfa_analytics(request.company_id, bank, scope)
                    except ResearchContextStoreError as exc:
                        warnings.append('bank_context_save_failed:' + type(exc).__name__)
                    emit('retrieving', 'completed', 'Bank PDF context added', bank_evidence=len(bank.evidence))
                except BudgetExceeded:
                    raise
                except Exception as exc:
                    warnings.append('bank_research_unavailable:' + type(exc).__name__)
                    emit('retrieving', 'skipped', 'Bank PDF context unavailable; continuing web analysis')
            emit("analyzing", "started", "Building source-grounded impacts")
            insights, rejected = build_insights(request, profile, context, self.research.model, budget)
            emit("analyzing", "completed", "Impact candidates built", insights=len(insights))
            emit("validating", "completed", "Mechanical references checked", rejected=len(rejected))
            if rejected:
                warnings.append("invalid_impact_candidates:" + str(rejected))
            partial = bool(rejected or warnings or context.coverage.get("source_errors") or
                           any(event.state == "failed" for event in context.trace))
            outcome = ("partial" if partial else "ok") if insights else \
                      ("partial" if partial else "no_relevant_evidence")
            emit("completed", "completed", "Web analysis finished", insights=len(insights))
            return AnalysisResult(**common, outcome=outcome, insights=insights,
                                  evidence=[e for e in context.evidence if e.evidence_id in
                                            {ref for insight in insights for ref in insight.evidence_refs}][:48],
                                  profile_snapshot=profile, research_context=context.model_copy(deep=True),
                                  warnings=warnings, trace=trace, usage=budget.usage())
        except (BudgetExceeded, ModelError) as exc:
            warnings.append(f"{type(exc).__name__}: {exc}")
            if context is not None:
                emit("completed", "completed", "Impact generation incomplete")
                return AnalysisResult(**common, outcome="partial", profile_snapshot=profile,
                                      research_context=context, warnings=warnings,
                                      trace=trace, usage=budget.usage())
        except ResearchContextStoreError as exc:
            warnings.append(f"{type(exc).__name__}: {exc}")
        except Exception as exc:
            warnings.append(f"{type(exc).__name__}: {exc}")
        emit("completed", "failed", "Web analysis failed")
        return AnalysisResult(**common, outcome="failed", profile_snapshot=profile,
                              research_context=context, warnings=warnings,
                              trace=trace, usage=budget.usage())
