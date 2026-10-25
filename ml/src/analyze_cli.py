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
from .web_research import FileEvidenceStore, HTTPDocumentFetcher, TavilySearchProvider


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("request", type=Path, help="JSON AnalysisRequest file")
    parser.add_argument("--mode", choices=("fixture", "live"), required=True)
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
            result = WebAnalysisPipeline(research, SupabaseResearchContextRepository(repo.engine)).analyze(
                request, lambda event: print(event.model_dump_json(), file=sys.stderr))
        finally:
            repo.close()
    print(result.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
