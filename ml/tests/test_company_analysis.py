import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient
from pydantic import ValidationError

from ml.src.company_analysis import CompanyAnalysisInput, analyze_company
from ml.src.service import ServiceSettings, create_app


class CompanyAnalysisTests(unittest.TestCase):
    def test_three_argument_function_resolves_numeric_and_synthetic_fixture_ids(self):
        with patch.dict("os.environ", {"ML_FIXTURE_MODE": "true", "ML_CALLBACK_ENABLED": "true"}), \
             patch("ml.src.company_analysis.BackendCallbackClient") as callback, \
             patch("ml.src.company_analysis.SupabaseCompanyProfileRepository.from_env") as database:
            first = analyze_company(123, "cfo")
            second = analyze_company("U_EXAMPLE", "ceo", "Оценить спрос")
        self.assertEqual(first.company_id, "U_EXAMPLE")
        self.assertEqual(first.company_row_id, 123)
        self.assertEqual(first.mode, "fixture")
        self.assertEqual(first.outcome, "ok")
        self.assertEqual(second.role, "ceo")
        self.assertEqual(second.goal, "Оценить спрос")
        self.assertNotEqual(first.job_id, second.job_id)
        callback.assert_not_called()  # Local trace IDs are not backend jobs.
        database.assert_not_called()

    def test_short_http_request_auth_optional_goal_and_unknown_company(self):
        app = create_app(settings=ServiceSettings({"ML_FIXTURE_MODE": "true",
                                                  "ML_SERVICE_TOKEN": "test-token"}))
        with TestClient(app) as client:
            body = {"company_id": 123, "role": "cfo"}
            self.assertEqual(client.post("/internal/analyze-company", json=body).status_code, 401)
            response = client.post("/internal/analyze-company", json=body,
                                   headers={"Authorization": "Bearer test-token"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["company_id"], "U_EXAMPLE")
            self.assertIsNone(response.json()["goal"])
            self.assertEqual(response.json()["mode"], "fixture")
            self.assertEqual(client.post("/internal/analyze-company",
                json={"company_id": 999, "role": "cfo"},
                headers={"Authorization": "Bearer test-token"}).status_code, 404)

    def test_backend_created_job_id_is_forwarded_to_callback(self):
        callback = MagicMock()
        job_id = uuid4()
        app = create_app(settings=ServiceSettings({"ML_FIXTURE_MODE": "true",
                                                  "ML_SERVICE_TOKEN": "test"}), callback_client=callback)
        with TestClient(app) as client:
            response = client.post("/internal/analyze-company",
                json={"company_id": 123, "role": "cfo", "job_id": str(job_id)},
                headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["job_id"], str(job_id))
        final = callback.send.call_args.args[0]
        self.assertEqual(final.job_id, job_id)
        self.assertEqual(final.status, "completed")
        self.assertEqual(final.result.mode, "fixture")

    def test_invalid_inputs_fail_before_lookup(self):
        for company_id in (True, 0, -1, "70", "F_1", "", "U_"):
            with self.subTest(company_id=company_id), self.assertRaises(ValidationError):
                CompanyAnalysisInput(company_id=company_id, role="cfo")
        with self.assertRaises(ValidationError):
            CompanyAnalysisInput(company_id=70, role="admin")
        with self.assertRaises(ValidationError):
            CompanyAnalysisInput(company_id=70, role="cfo", goal="x" * 1001)


if __name__ == "__main__":
    unittest.main()
