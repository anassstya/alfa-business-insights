"""Run fixture or live web analysis; prints StageEvents to stderr."""

import argparse
import os
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
from .analysis_job_repository import (
    AnalysisJobStoreError, SupabaseAnalysisJobRepository, analyze_and_save,
)
from .web_research import FileEvidenceStore, HTTPDocumentFetcher, TavilySearchProvider


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("request", type=Path, help="JSON AnalysisRequest file")
    parser.add_argument("--mode", choices=("fixture", "live"), required=True)
    parser.add_argument("--no-save-job", action="store_true",
                        help="Explicitly skip analysis_jobs persistence for a diagnostic run")
    args = parser.parse_args()
    request = AnalysisRequest.model_validate_json(args.request.read_text(encoding="utf-8"))
    if args.mode == "fixture":
        repo = JsonCompanyProfileRepository(Path(__file__).resolve().parents[1] /
                                            "fixtures/company_profiles.json",
                                            identity_rows={"U_EXAMPLE": [123]})
        result = analyze(request, lambda event: print(event.model_dump_json(), file=sys.stderr),
                         repository=repo)
    else:
        repo = SupabaseCompanyProfileRepository.from_env()
        try:
            model = GatewayClient(ModelSettings.from_environment())
            store = FileEvidenceStore(Path(__file__).resolve().parents[1] / ".cache" / "web")
            research = ResearchPipeline(repo, model, TavilySearchProvider(), HTTPDocumentFetcher(), store)
            runner = WebAnalysisPipeline(research, SupabaseResearchContextRepository(repo.engine))
            on_event = lambda event: print(event.model_dump_json(), file=sys.stderr)
            persist = not args.no_save_job and os.getenv("ML_PERSIST_ANALYSIS_JOBS", "true").lower() in ("1", "true", "yes")
            if persist:
                result = analyze_and_save(runner, request,
                                          SupabaseAnalysisJobRepository(repo.engine), on_event)
            else:
                result = runner.analyze(request, on_event)
        except AnalysisJobStoreError as exc:
            parser.exit(1, f"{type(exc).__name__}: {exc}\n")
        finally:
            repo.close()
    print(result.model_dump_json(indent=2))
    if result.outcome == "failed":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
