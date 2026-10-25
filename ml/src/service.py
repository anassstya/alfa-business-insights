"""Internal HTTP transport for the fixture pipeline. ml.src.api is the LLM client."""

from __future__ import annotations

import hmac
import os
from pathlib import Path
from typing import Mapping

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request

from .contracts import AnalysisRequest, AnalysisResult, CompanyResearchContext, SearchTask
from .api import GatewayClient, ModelSettings
from .pipeline import AnalysisPipeline
from .profile_repository import JsonCompanyProfileRepository, SupabaseCompanyProfileRepository, ROOT
from .research_pipeline import ResearchPipeline
from .research_context_repository import SupabaseResearchContextRepository
from .web_pipeline import WebAnalysisPipeline
from .web_research import FileEvidenceStore, HTTPDocumentFetcher, TavilySearchProvider, search_news


def _enabled(value: str | None) -> bool:
    return value is not None and value.lower() in ("1", "true", "yes")


class ServiceSettings:
    def __init__(self, environ: Mapping[str, str] | None = None):
        if environ is None:
            load_dotenv(ROOT / ".env", override=False)
            environ = os.environ
        self.fixture_mode = _enabled(environ.get("ML_FIXTURE_MODE"))
        self.local_dev_mode = _enabled(environ.get("ML_LOCAL_DEV_MODE"))
        self.service_token = environ.get("ML_SERVICE_TOKEN") or None
        self.evidence_cache = Path(environ.get("ML_EVIDENCE_CACHE") or
                                   Path(__file__).resolve().parents[1] / ".cache" / "web")


def create_app(*, settings: ServiceSettings | None = None,
               pipeline: AnalysisPipeline | None = None,
               news_provider=None, document_fetcher=None, evidence_store=None,
               research_pipeline: ResearchPipeline | None = None,
               web_pipeline: WebAnalysisPipeline | None = None) -> FastAPI:
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
        if settings.fixture_mode:
            if pipeline is None:
                raise HTTPException(status_code=503, detail="fixture pipeline is disabled")
            return pipeline.analyze(body)
        if web_pipeline is not None:
            return web_pipeline.analyze(body)
        if pipeline is not None:
            raise HTTPException(status_code=503, detail="fixture pipeline is disabled")
        repository = SupabaseCompanyProfileRepository.from_env()
        context_repository = SupabaseResearchContextRepository(repository.engine)
        try:
            model = GatewayClient(ModelSettings.from_environment())
            research = ResearchPipeline(repository, model, news_provider or TavilySearchProvider(),
                                        document_fetcher or HTTPDocumentFetcher(), store)
            return WebAnalysisPipeline(research, context_repository).analyze(body)
        finally:
            repository.close()

    @app.post("/internal/news/search")
    def internal_news_search(body: SearchTask, _authorized: None = Depends(authorize)):
        return search_news(body, provider=news_provider or TavilySearchProvider(),
                           fetcher=document_fetcher or HTTPDocumentFetcher(), store=store)

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
