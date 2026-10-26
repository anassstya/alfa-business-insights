"""Internal HTTP transport for analysis and session chat. api.py is the LLM client."""

from __future__ import annotations

import hmac
import os
from pathlib import Path
from typing import Mapping

from .runtime_environment import load_runtime_environment
from fastapi import Depends, FastAPI, Header, HTTPException, Request

from .contracts import AnalysisRequest, AnalysisResult, CompanyResearchContext, SearchTask
from .api import GatewayClient, ModelSettings
from .api import ModelError, ModelFormatError
from .budget import BudgetExceeded
from .analysis_chat import (ChatRequest, ChatResponse, answer_analysis_question,
                            SessionNotFound, SessionNotReady, SessionStoreUnavailable,
                            ChatContextTooLarge)
from .company_analysis import CompanyAnalysisInput, _analyze_company
from .backend_callback import (
    BackendCallbackClient, CallbackError, CallbackSettings, analyze_with_callback,
)
from .pipeline import AnalysisPipeline
from .profile_repository import (AmbiguousCompanyIdentity, CompanyNotFound, ProfileNotPrepared,
                                 ProfileStoreUnavailable, JsonCompanyProfileRepository,
                                 SupabaseCompanyProfileRepository, ROOT)
from .research_pipeline import ResearchPipeline
from .research_context_repository import SupabaseResearchContextRepository
from .web_pipeline import WebAnalysisPipeline
from .web_research import FileEvidenceStore, HTTPDocumentFetcher, TavilySearchProvider, search_news


def _enabled(value: str | None) -> bool:
    return value is not None and value.lower() in ("1", "true", "yes")


class ServiceSettings:
    def __init__(self, environ: Mapping[str, str] | None = None):
        if environ is None:
            load_runtime_environment()
            environ = os.environ
        self.fixture_mode = _enabled(environ.get("ML_FIXTURE_MODE"))
        self.local_dev_mode = _enabled(environ.get("ML_LOCAL_DEV_MODE"))
        self.service_token = environ.get("ML_SERVICE_TOKEN") or None
        self.callback = CallbackSettings.from_environment(environ)
        self.evidence_cache = Path(environ.get("ML_EVIDENCE_CACHE") or
                                   Path(__file__).resolve().parents[1] / ".cache" / "web")


def create_app(*, settings: ServiceSettings | None = None,
               pipeline: AnalysisPipeline | None = None,
               news_provider=None, document_fetcher=None, evidence_store=None,
               research_pipeline: ResearchPipeline | None = None,
               web_pipeline: WebAnalysisPipeline | None = None,
               callback_client=None, chat_service=None) -> FastAPI:
    settings = settings or ServiceSettings()
    if pipeline is None and settings.fixture_mode:
        repository = JsonCompanyProfileRepository(
            Path(__file__).resolve().parents[1] / "fixtures/company_profiles.json",
            identity_rows={"U_EXAMPLE": [123]},
        )
        pipeline = AnalysisPipeline(repository)
    app = FastAPI(title="Alfa Business Insights ML", docs_url=None, redoc_url=None)
    store = evidence_store or FileEvidenceStore(settings.evidence_cache)

    @app.get("/health")
    def health():
        return {"status": "ok", "fixture_mode": settings.fixture_mode}

    def authorize(request: Request, authorization: str | None = Header(default=None)):
        supplied = authorization.removeprefix("Bearer ") if authorization else ""
        authenticated = bool(settings.service_token and authorization and
                             authorization.startswith("Bearer ") and
                             hmac.compare_digest(supplied, settings.service_token))
        local_dev = settings.local_dev_mode and request.client is not None and \
            request.client.host in ("127.0.0.1", "::1")
        if not (authenticated or local_dev):
            raise HTTPException(status_code=401, detail="service authentication required")

    @app.post("/internal/analyze", response_model=AnalysisResult)
    def internal_analyze(body: AnalysisRequest, _authorized: None = Depends(authorize)):
        if not settings.fixture_mode and pipeline is not None and web_pipeline is None:
            raise HTTPException(status_code=503, detail="fixture pipeline is disabled")

        def run(on_event):
            if settings.fixture_mode:
                return pipeline.analyze(body, on_event=on_event)
            if web_pipeline is not None:
                return web_pipeline.analyze(body, on_event=on_event)
            repository = SupabaseCompanyProfileRepository.from_env()
            try:
                model = GatewayClient(ModelSettings.from_environment())
                research = ResearchPipeline(repository, model, news_provider or TavilySearchProvider(),
                                            document_fetcher or HTTPDocumentFetcher(), store)
                runner = WebAnalysisPipeline(research, SupabaseResearchContextRepository(repository.engine))
                return runner.analyze(body, on_event=on_event)
            finally:
                repository.close()

        callback = callback_client
        owns_callback = False
        try:
            if callback is None and settings.callback.enabled:
                callback = BackendCallbackClient(settings.callback)
                owns_callback = True
            return analyze_with_callback(body, run, callback)
        except CallbackError as exc:
            raise HTTPException(status_code=503, detail={
                "code": "backend_callback_failed", "message": str(exc),
                "job_id": str(body.job_id),
            }) from exc
        finally:
            if owns_callback:
                callback.close()

    @app.post("/internal/analyze-company", response_model=AnalysisResult)
    def internal_analyze_company(body: CompanyAnalysisInput, _authorized: None = Depends(authorize)):
        try:
            return _analyze_company(body, fixture_mode=settings.fixture_mode,
                                    callback_settings=settings.callback, callback_client=callback_client,
                                    evidence_cache=settings.evidence_cache)
        except CompanyNotFound as exc:
            raise HTTPException(status_code=404, detail="company not found") from exc
        except AmbiguousCompanyIdentity as exc:
            raise HTTPException(status_code=409, detail="ambiguous company identity") from exc
        except ProfileNotPrepared as exc:
            raise HTTPException(status_code=409, detail="company profile is not prepared") from exc
        except ProfileStoreUnavailable as exc:
            raise HTTPException(status_code=503, detail="company profile store unavailable") from exc
        except CallbackError as exc:
            raise HTTPException(status_code=503, detail={
                "code": "backend_callback_failed", "message": str(exc),
                "job_id": str(body.job_id) if body.job_id else None,
            }) from exc

    @app.post("/internal/news/search")
    def internal_news_search(body: SearchTask, _authorized: None = Depends(authorize)):
        return search_news(body, provider=news_provider or TavilySearchProvider(),
                           fetcher=document_fetcher or HTTPDocumentFetcher(), store=store)

    @app.post("/internal/chat", response_model=ChatResponse)
    def internal_chat(body: ChatRequest, _authorized: None = Depends(authorize)):
        try:
            if chat_service is not None:
                return chat_service.answer(body)
            return answer_analysis_question(body.job_id, body.message,
                                            history=[t.model_dump() for t in body.history])
        except SessionNotFound as exc:
            raise HTTPException(404, detail={"code": "session_not_found"}) from exc
        except SessionNotReady as exc:
            raise HTTPException(409, detail={"code": "session_not_ready", "message": str(exc)}) from exc
        except ChatContextTooLarge as exc:
            raise HTTPException(413, detail={"code": "chat_context_too_large"}) from exc
        except (SessionStoreUnavailable, ProfileStoreUnavailable) as exc:
            raise HTTPException(503, detail={"code": "session_store_unavailable",
                                "message": "Check database availability and analysis_jobs SELECT permission; "
                                           "in backend mode check the result endpoint"}) from exc
        except ModelFormatError as exc:
            raise HTTPException(502, detail={"code": "chat_answer_invalid"}) from exc
        except (ModelError, BudgetExceeded) as exc:
            raise HTTPException(503, detail={"code": "chat_model_unavailable"}) from exc

    @app.post("/internal/research", response_model=CompanyResearchContext)
    def internal_research(body: AnalysisRequest, _authorized: None = Depends(authorize)):
        if research_pipeline is not None:
            return research_pipeline.run(body)
        repository = SupabaseCompanyProfileRepository.from_env()
        try:
            model = GatewayClient(ModelSettings.from_environment())
            runner = ResearchPipeline(repository, model, news_provider or TavilySearchProvider(),
                                      document_fetcher or HTTPDocumentFetcher(), store)
            return runner.run(body)
        finally:
            repository.close()

    @app.get("/internal/evidence/{evidence_id}")
    def internal_evidence(evidence_id: str, _authorized: None = Depends(authorize)):
        found = store.get(evidence_id)
        if found is None:
            raise HTTPException(status_code=404, detail="evidence not found")
        record, text = found
        return {"record": record, "text": text}

    return app


# Uvicorn can import this app. With no token, internal requests fail closed.
app = create_app()
