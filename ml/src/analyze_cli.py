"""Run fixture or live web analysis; prints StageEvents to stderr."""

import argparse
import sys
from pathlib import Path

from .contracts import AnalysisRequest
from .pipeline import analyze
from .profile_repository import JsonCompanyProfileRepository
from .profile_repository import SupabaseCompanyProfileRepository
from .research_context_repository import SupabaseResearchContextRepository
from .research_pipeline import ResearchPipeline
from .web_pipeline import WebAnalysisPipeline
from .api import GatewayClient, ModelSettings
from .backend_callback import (
    BackendCallbackClient, CallbackError, CallbackSettings, analyze_with_callback,
)
from .web_research import FileEvidenceStore, HTTPDocumentFetcher, TavilySearchProvider


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("request", type=Path, help="JSON AnalysisRequest file")
    parser.add_argument("--mode", choices=("fixture", "live"), required=True)
    parser.add_argument("--no-callback", action="store_true",
                        help="Diagnostic run: return JSON without publishing backend events")
    args = parser.parse_args()
    request = AnalysisRequest.model_validate_json(args.request.read_text(encoding="utf-8"))
    def run(on_event):
        if args.mode == "fixture":
            repo = JsonCompanyProfileRepository(Path(__file__).resolve().parents[1] /
                                               "fixtures/company_profiles.json",
                                               identity_rows={"U_EXAMPLE": [123]})
            return analyze(request, on_event, repository=repo)
        repo = SupabaseCompanyProfileRepository.from_env()
        try:
            model = GatewayClient(ModelSettings.from_environment())
            store = FileEvidenceStore(Path(__file__).resolve().parents[1] / ".cache" / "web")
            research = ResearchPipeline(repo, model, TavilySearchProvider(), HTTPDocumentFetcher(), store)
            runner = WebAnalysisPipeline(research, SupabaseResearchContextRepository(repo.engine))
            return runner.analyze(request, on_event)
        finally:
            repo.close()
    callback = None
    try:
        settings = CallbackSettings.from_environment()
        if settings.enabled and not args.no_callback:
            callback = BackendCallbackClient(settings)
        result = analyze_with_callback(request, run, callback,
            on_event=lambda event: print(event.model_dump_json(), file=sys.stderr))
    except CallbackError as exc:
        parser.exit(1, f"CallbackError: {exc}\n")
    finally:
        if callback is not None:
            callback.close()
    print(result.model_dump_json(indent=2))
    if result.outcome == "failed":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
