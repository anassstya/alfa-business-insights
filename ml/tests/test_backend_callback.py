import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock
from uuid import uuid4

import httpx
from fastapi.testclient import TestClient

from ml.src.backend_callback import (
    BackendCallbackClient, CallbackError, CallbackEvent, CallbackSettings,
    MAX_CALLBACK_BYTES, analyze_with_callback,
)
from ml.src.contracts import AnalysisRequest, AnalysisResult, EvidenceRecord, Insight, StageEvent
from ml.src.result_sources import resolve_result_sources
from ml.src.service import ServiceSettings, create_app


def example():
    now = datetime.now(timezone.utc)
    request = AnalysisRequest(job_id=uuid4(), company_row_id=70,
                              company_id="U_1", role="cfo", as_of=now)
    evidence = EvidenceRecord(
        evidence_id="ev-news", document_id="doc-news", source_kind="news",
        title="Изменились условия финансирования", publisher="Проверенный источник",
        url="https://example.org/news", published_at=now, retrieved_at=now,
        excerpt="Условия нового финансирования изменились.", content_hash="a" * 64,
        date_status="known", content_status="full_text",
    )
    insight = Insight(
        insight_id="impact-1", event=evidence.title,
        ai_interpretation="Возможное влияние зависит от потребности в новом кредите",
        company_relevance="У компании есть кредитный продукт",
        role_relevance="CFO может проверить планы рефинансирования",
        impact_chain=["Изменение условий", "Кредитный продукт", "Возможное влияние"],
        uncertainty="Сумма долга и условия договоров неизвестны",
        evidence_refs=[evidence.evidence_id], feature_refs=["/base_information/banking"],
        evidence_sources=[{"evidence_id": evidence.evidence_id,
                           "url": "https://untrusted.example/invented", "quote": evidence.excerpt}], rank=1,
    )
    result = AnalysisResult(
        job_id=request.job_id, run_id=uuid4(), company_id=request.company_id,
        company_row_id=request.company_row_id, role=request.role, as_of=now,
        outcome="ok", insights=[insight], evidence=[evidence],
    )
    return request, result


class CallbackTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.outbox = Path(self.temp.name)

    def client(self, handler):
        transport = httpx.Client(transport=httpx.MockTransport(handler))
        self.addCleanup(transport.close)
        return BackendCallbackClient(CallbackSettings(enabled=True, token="callback-test-token"), transport)

    def test_exact_go_envelope_progress_and_frontend_sources(self):
        request, result = example()
        received = []
        def backend(req):
            self.assertEqual(req.url.path, "/api/v1/internal/analysis/events")
            self.assertEqual(req.headers["authorization"], "Bearer callback-test-token")
            body = json.loads(req.content)
            self.assertLessEqual(set(body), {"job_id", "status", "stage", "result", "error_message"})
            self.assertEqual(body["job_id"], str(request.job_id))
            received.append(body)
            return httpx.Response(204)
        callback = self.client(backend)
        def run(report):
            for seq, stage in enumerate(("loading_profile", "planning", "retrieving", "completed",
                                         "analyzing", "validating", "completed"), 1):
                report(StageEvent(job_id=request.job_id, run_id=result.run_id, seq=seq,
                                  stage=stage, state="completed", at=request.as_of, summary=stage))
            return result
        restored = analyze_with_callback(request, run, callback, outbox=self.outbox)
        self.assertEqual([b["stage"] for b in received],
                         ["loading_profile", "planning", "retrieving", "analyzing", "validating", "completed"])
        self.assertTrue(all(b["status"] == "running" and "result" not in b for b in received[:-1]))
        self.assertEqual(received[-1]["status"], "completed")
        source = received[-1]["result"]["insights"][0]["evidence_sources"][0]
        self.assertEqual(source["url"], result.evidence[0].url)
        self.assertEqual(source["title"], result.evidence[0].title)
        self.assertEqual(source["quote"], result.evidence[0].excerpt)
        self.assertEqual(restored.insights[0].evidence_sources[0]["url"], result.evidence[0].url)
        self.assertEqual(list(self.outbox.glob("*.json")), [])

    def test_unknown_job_stops_before_search_or_model_calls(self):
        request, _ = example()
        run = MagicMock()
        callback = self.client(lambda _: httpx.Response(404))
        with self.assertRaisesRegex(CallbackError, "callback_http_404"):
            analyze_with_callback(request, run, callback, outbox=self.outbox)
        run.assert_not_called()

    def test_authentication_error_is_not_retried_and_does_not_leak_token(self):
        request, _ = example()
        calls = []
        callback = self.client(lambda r: (calls.append(r), httpx.Response(401, text="private response"))[1])
        with self.assertRaises(CallbackError) as caught:
            callback.send(CallbackEvent(job_id=request.job_id, status="running"))
        self.assertEqual(len(calls), 1)
        self.assertNotIn("callback-test-token", str(caught.exception))
        self.assertNotIn("private response", str(caught.exception))

    def test_temporary_error_has_one_bounded_retry(self):
        request, _ = example()
        calls = []
        def handler(req):
            calls.append(req)
            return httpx.Response(500 if len(calls) == 1 else 204)
        self.client(handler).send(CallbackEvent(job_id=request.job_id, status="running"))
        self.assertEqual(len(calls), 2)

    def test_terminal_delivery_failure_keeps_replayable_result_without_token(self):
        request, result = example()
        received = []
        def handler(req):
            body = json.loads(req.content)
            received.append(body)
            return httpx.Response(500 if body["status"] == "completed" else 204)
        with self.assertRaises(CallbackError):
            analyze_with_callback(request, lambda _: result, self.client(handler), outbox=self.outbox)
        pending = list(self.outbox.glob("*.json"))
        self.assertEqual(len(pending), 1)
        text = pending[0].read_text(encoding="utf-8")
        self.assertNotIn("callback-test-token", text)
        event = CallbackEvent.model_validate_json(text)
        self.assertEqual(event.status, "completed")
        self.assertEqual(event.result.insights[0].evidence_sources[0]["url"], result.evidence[0].url)
        self.client(lambda _: httpx.Response(204)).send(event)

    def test_analysis_failure_is_reported_without_private_exception_text(self):
        request, _ = example()
        events = []
        callback = self.client(lambda req: (events.append(json.loads(req.content)), httpx.Response(204))[1])
        def run(_):
            raise RuntimeError("private connection details")
        result = analyze_with_callback(request, run, callback, outbox=self.outbox)
        self.assertEqual(result.outcome, "failed")
        self.assertEqual(events[-1]["status"], "failed")
        self.assertNotIn("private connection details", json.dumps(events))
        self.assertIn("result", events[-1])

    def test_partial_analysis_has_completed_status_and_preserves_outcome(self):
        request, result = example()
        result = result.model_copy(update={"outcome": "partial"})
        events = []
        callback = self.client(lambda req: (events.append(json.loads(req.content)), httpx.Response(204))[1])
        analyze_with_callback(request, lambda _: result, callback, outbox=self.outbox)
        self.assertEqual(events[-1]["status"], "completed")
        self.assertEqual(events[-1]["result"]["outcome"], "partial")

    def test_oversize_payload_is_rejected_before_http(self):
        request, _ = example()
        calls = []
        callback = self.client(lambda r: (calls.append(r), httpx.Response(204))[1])
        with self.assertRaises(CallbackError):
            callback.send(CallbackEvent(job_id=request.job_id, status="failed",
                                        error_message="x" * MAX_CALLBACK_BYTES))
        self.assertEqual(calls, [])

    def test_http_service_uses_callback_without_accessing_analysis_jobs(self):
        request, result = example()
        events = []
        callback = self.client(lambda req: (events.append(json.loads(req.content)), httpx.Response(204))[1])
        runner = MagicMock()
        runner.analyze.return_value = result
        app = create_app(settings=ServiceSettings({"ML_SERVICE_TOKEN": "test"}),
                         web_pipeline=runner, callback_client=callback)
        with TestClient(app) as client:
            response = client.post("/internal/analyze", json=request.model_dump(mode="json"),
                                   headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(events[-1]["result"]["job_id"], response.json()["job_id"])
        self.assertEqual(response.json()["insights"][0]["evidence_sources"][0]["title"],
                         result.evidence[0].title)

    def test_enabled_callback_without_token_fails_before_pipeline(self):
        request, _ = example()
        runner = MagicMock()
        app = create_app(settings=ServiceSettings({"ML_SERVICE_TOKEN": "test",
                                                  "ML_CALLBACK_ENABLED": "true"}), web_pipeline=runner)
        with TestClient(app) as client:
            response = client.post("/internal/analyze", json=request.model_dump(mode="json"),
                                   headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 503)
        runner.analyze.assert_not_called()

    def test_missing_evidence_and_false_quotes_are_rejected(self):
        _, result = example()
        bad = result.model_copy(deep=True)
        bad.insights[0].evidence_refs = ["unknown"]
        with self.assertRaises(ValueError):
            resolve_result_sources(bad)
        bad = result.model_copy(deep=True)
        bad.insights[0].evidence_sources[0]["quote"] = "Never in the evidence"
        with self.assertRaises(ValueError):
            resolve_result_sources(bad)


if __name__ == "__main__":
    unittest.main()
