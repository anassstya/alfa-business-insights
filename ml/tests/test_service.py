import unittest
from pathlib import Path
from uuid import UUID

from fastapi.testclient import TestClient
from pydantic import ValidationError

from ml.src.contracts import AnalysisRequest, AnalysisResult
from ml.src.pipeline import AnalysisPipeline, analyze
from ml.src.profile_repository import JsonCompanyProfileRepository
from ml.src.service import ServiceSettings, create_app


FIXTURE = Path(__file__).resolve().parents[1] / "fixtures/company_profiles.json"
REQUEST = {"schema_version": "1.0", "job_id": str(UUID(int=1)),
           "company_row_id": 123, "company_id": "U_EXAMPLE", "role": "cfo",
           "goal": "Review possible funding cost", "as_of": "2026-09-15T12:00:00+03:00"}


def pipeline():
    return AnalysisPipeline(JsonCompanyProfileRepository(FIXTURE,
                            identity_rows={"U_EXAMPLE": [123]}))


class ServiceTests(unittest.TestCase):
    def test_valid_request_events_and_serialization(self):
        events = []
        result = pipeline().analyze(AnalysisRequest.model_validate(REQUEST), events.append)
        self.assertEqual(result.outcome, "ok")
        self.assertEqual(result.mode, "fixture")
        self.assertEqual(result.company_row_id, 123)
        self.assertEqual([e.seq for e in events], list(range(1, len(events) + 1)))
        self.assertEqual([(e.stage, e.state) for e in events], [
            ("loading_profile", "started"), ("loading_profile", "completed"),
            ("mapping_exposures", "skipped"), ("planning", "skipped"),
            ("retrieving", "started"), ("retrieving", "completed"),
            ("analyzing", "started"), ("analyzing", "completed"),
            ("validating", "started"), ("validating", "completed"),
            ("completed", "completed")])
        restored = AnalysisResult.model_validate_json(result.model_dump_json())
        self.assertEqual(restored.trace, events)
        self.assertEqual(restored.insights[0].bank_view.status, "unavailable")
        self.assertEqual(restored.insights[0].evidence_refs, [restored.evidence[0].evidence_id])
        self.assertEqual(restored.insights[0].feature_refs, ["/base_information/profile"])

    def test_invalid_role_and_ids(self):
        for change in ({"role": "admin"}, {"company_id": "F_1"},
                       {"company_row_id": "U_EXAMPLE"}):
            with self.subTest(change=change), self.assertRaises(ValidationError):
                AnalysisRequest.model_validate({**REQUEST, **change})

    def test_profile_failure_returns_failed_result(self):
        events = []
        result = pipeline().analyze(AnalysisRequest.model_validate(
            {**REQUEST, "company_row_id": 999}), events.append)
        self.assertEqual(result.outcome, "failed")
        self.assertEqual(events[-1].state, "failed")
        self.assertIn("CompanyIdentityMismatch", result.warnings[-1])
        self.assertFalse(result.insights)

    def test_http_auth_and_response(self):
        app = create_app(settings=ServiceSettings({"ML_FIXTURE_MODE": "true",
                                                  "ML_SERVICE_TOKEN": "test-secret"}),
                         pipeline=pipeline())
        with TestClient(app) as client:
            self.assertEqual(client.get("/health").json()["status"], "ok")
            self.assertEqual(client.post("/internal/analyze", json=REQUEST).status_code, 401)
            self.assertEqual(client.post("/internal/analyze", json={"role": "admin"}).status_code, 401)
            response = client.post("/internal/analyze", json=REQUEST,
                                   headers={"Authorization": "Bearer test-secret"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(AnalysisResult.model_validate(response.json()).mode, "fixture")
            self.assertEqual(client.post("/internal/analyze", json={**REQUEST, "role": "admin"},
                                         headers={"Authorization": "Bearer test-secret"}).status_code, 422)

    def test_disabled_and_local_dev_boundary(self):
        app = create_app(settings=ServiceSettings({"ML_SERVICE_TOKEN": "test-secret"}),
                         pipeline=pipeline())
        with TestClient(app) as client:
            self.assertEqual(client.post("/internal/analyze", json=REQUEST,
                                         headers={"Authorization": "Bearer test-secret"}).status_code, 503)
        self.assertFalse(ServiceSettings({"ML_LOCAL_DEV_MODE": "false"}).local_dev_mode)
        local = create_app(settings=ServiceSettings({"ML_FIXTURE_MODE": "true",
                                                    "ML_LOCAL_DEV_MODE": "true"}),
                           pipeline=pipeline())
        with TestClient(local, client=("127.0.0.1", 50000)) as client:
            self.assertEqual(client.post("/internal/analyze", json=REQUEST).status_code, 200)
        with TestClient(local, client=("192.0.2.1", 50000)) as client:
            self.assertEqual(client.post("/internal/analyze", json=REQUEST).status_code, 401)

    def test_top_level_requires_explicit_fixture_setting(self):
        from unittest.mock import patch
        with patch.dict("os.environ", {"ML_FIXTURE_MODE": "false"}):
            with self.assertRaises(RuntimeError):
                analyze(AnalysisRequest.model_validate(REQUEST))
        with patch.dict("os.environ", {"ML_FIXTURE_MODE": "true"}):
            self.assertEqual(analyze(AnalysisRequest.model_validate(REQUEST)).mode, "fixture")


if __name__ == "__main__":
    unittest.main()
