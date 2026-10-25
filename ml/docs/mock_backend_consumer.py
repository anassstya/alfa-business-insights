"""Local integration example. Keeps job state in memory; makes no database writes."""

import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from ml.src.contracts import AnalysisResult


def main() -> None:
    token = os.environ.get("ML_SERVICE_TOKEN")
    if not token:
        raise SystemExit("Set ML_SERVICE_TOKEN in the environment")
    payload = json.loads((Path(__file__).parent / "fixture_request.json").read_text(encoding="utf-8"))
    job = {"id": payload["job_id"], "status": "pending", "result": None}
    print(json.dumps({"job_id": job["id"], "status": job["status"]}))
    job["status"] = "running"
    print(json.dumps({"job_id": job["id"], "status": job["status"]}))
    request = Request("http://127.0.0.1:8000/internal/analyze",
                      data=json.dumps(payload).encode("utf-8"), method="POST",
                      headers={"Content-Type": "application/json",
                               "Authorization": f"Bearer {token}"})
    try:
        with urlopen(request, timeout=30) as response:
            result = AnalysisResult.model_validate_json(response.read())
        if str(result.job_id) != payload["job_id"]:
            raise ValueError("response job_id mismatch")
        job["result"] = result.model_dump(mode="json")
        job["status"] = "failed" if result.outcome == "failed" else "completed"
    except (HTTPError, URLError, ValueError) as exc:
        job["status"] = "failed"
        job["error_message"] = type(exc).__name__
    # Real backend persists this state with its own credentials and access checks.
    print(json.dumps({"job_id": job["id"], "status": job["status"],
                      "result_outcome": job["result"]["outcome"] if job["result"] else None}))


if __name__ == "__main__":
    main()
