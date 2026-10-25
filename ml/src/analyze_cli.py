"""Run the same fixture analysis locally; prints StageEvents to stderr."""

import argparse
import os
import sys
from pathlib import Path

from .contracts import AnalysisRequest
from .pipeline import analyze
from .profile_repository import JsonCompanyProfileRepository


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("request", type=Path, help="JSON AnalysisRequest file")
    args = parser.parse_args()
    if os.environ.get("ML_FIXTURE_MODE", "").lower() not in ("1", "true", "yes"):
        parser.error("ML_FIXTURE_MODE=true is required for this milestone")
    repo = JsonCompanyProfileRepository(Path(__file__).resolve().parents[1] /
                                        "fixtures/company_profiles.json",
                                        identity_rows={"U_EXAMPLE": [123]})
    request = AnalysisRequest.model_validate_json(args.request.read_text(encoding="utf-8"))
    result = analyze(request, lambda event: print(event.model_dump_json(), file=sys.stderr),
                     repository=repo)
    print(result.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
