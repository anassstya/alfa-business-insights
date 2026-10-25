import unittest
import json
from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

from fastapi.testclient import TestClient

from ml.src.analysis_job_repository import (
    AnalysisJobConflict, AnalysisJobPermissionError, AnalysisJobStoreError,
    SupabaseAnalysisJobRepository, analyze_and_save, resolve_result_sources,
)
from ml.src.contracts import AnalysisRequest, AnalysisResult, EvidenceRecord, Insight
from ml.src.service import ServiceSettings, create_app
from ml.src.jsonb_storage import CHUNK_BYTES, JsonbWriteConflict, update_jsonb, utf8_chunks


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
        insight_id="impact-1", event="Изменились условия финансирования",
        ai_interpretation="Возможное влияние зависит от потребности в новом кредите",
        company_relevance="У компании есть кредитный продукт",
        role_relevance="CFO может проверить планы рефинансирования",
        impact_chain=["Изменение условий", "Кредитный продукт", "Возможное влияние"],
        uncertainty="Сумма долга и условия действующих договоров неизвестны",
        evidence_refs=[evidence.evidence_id], feature_refs=["/base_information/banking"],
        evidence_sources=[{"evidence_id": evidence.evidence_id,
                           "url": "https://untrusted.example/invented",
                           "quote": "Условия нового финансирования изменились."}], rank=1,
    )
    result = AnalysisResult(
        job_id=request.job_id, run_id=uuid4(), company_id=request.company_id,
        company_row_id=request.company_row_id, role=request.role, as_of=now,
        outcome="ok", insights=[insight], evidence=[evidence],
    )
    return request, result


class AnalysisJobsTests(unittest.TestCase):
    def test_large_json_upload_preserves_utf8_and_publishes_only_after_chunks(self):
        document = json.dumps({"text": "Новость 💼 " * 4000}, ensure_ascii=False)
        chunks = list(utf8_chunks(document))
        self.assertEqual("".join(chunks), document)
        self.assertTrue(all(len(chunk.encode("utf-8")) <= CHUNK_BYTES for chunk in chunks))
        engine = MagicMock()
        execute = engine.connect.return_value.__enter__.return_value.execute
        execute.return_value.first.return_value = ("job",)
        update_jsonb(engine, table="analysis_jobs", column="result", where="id=:id",
                     params={"id": "job"}, document=document, updates={"status": "completed"})
        calls = execute.call_args_list
        self.assertEqual("".join(c.args[1]["chunk"] for c in calls[:-1]), document)
        self.assertTrue(all("status=" not in str(c.args[0]) for c in calls[:-1]))
        self.assertIn("status=:finish_status", str(calls[-1].args[0]))
        self.assertIn("string_agg", str(calls[-1].args[0]))
        self.assertIn("upload_id", str(calls[-1].args[0]))

    def test_interrupted_upload_does_not_publish_completed_result(self):
        engine = MagicMock()
        execute = engine.connect.return_value.__enter__.return_value.execute
        execute.return_value.first.side_effect = [("job",), None]
        with self.assertRaises(JsonbWriteConflict):
            update_jsonb(engine, table="analysis_jobs", column="result", where="id=:id",
                         params={"id": "job"}, document=json.dumps({"text": "x" * 30000}),
                         updates={"status": "completed"})
        self.assertTrue(all("status=" not in str(c.args[0]) for c in execute.call_args_list))

    def test_saved_result_contains_inline_sources_from_evidence(self):
        request, result = example()
        runner, jobs = MagicMock(), MagicMock()
        runner.analyze.return_value = result
        saved = analyze_and_save(runner, request, jobs)
        jobs.start.assert_called_once_with(request)
        jobs.save.assert_called_once_with(request, saved)
        restored = AnalysisResult.model_validate_json(saved.model_dump_json())
        source = restored.insights[0].evidence_sources[0]
        self.assertEqual(source["url"], result.evidence[0].url)
        self.assertEqual(source["title"], result.evidence[0].title)
        self.assertEqual(source["publisher"], result.evidence[0].publisher)
        self.assertEqual(source["quote"], result.evidence[0].excerpt)
        self.assertEqual(restored.insights[0].evidence_refs, [restored.evidence[0].evidence_id])
        self.assertEqual(result.insights[0].evidence_sources[0]["url"],
                         "https://untrusted.example/invented")  # Original snapshot is unchanged.

    def test_invalid_reference_and_quote_are_not_persisted_as_valid_insights(self):
        request, result = example()
        bad = result.model_copy(deep=True)
        bad.insights[0].evidence_refs = ["unknown"]
        with self.assertRaises(AnalysisJobStoreError):
            resolve_result_sources(bad)
        bad = result.model_copy(deep=True)
        bad.insights[0].evidence_sources[0]["quote"] = "This text was never in the evidence"
        with self.assertRaises(AnalysisJobStoreError):
            resolve_result_sources(bad)

    def test_permission_failure_happens_before_paid_pipeline(self):
        request, _ = example()
        engine, runner = MagicMock(), MagicMock()
        engine.connect.return_value.__enter__.return_value.execute.return_value.scalar_one.return_value = False
        jobs = SupabaseAnalysisJobRepository(engine)
        with self.assertRaises(AnalysisJobPermissionError):
            analyze_and_save(runner, request, jobs)
        runner.analyze.assert_not_called()
        engine.begin.assert_not_called()

    def test_result_identity_mismatch_does_not_write(self):
        request, result = example()
        engine = MagicMock()
        jobs = SupabaseAnalysisJobRepository(engine)
        for changes in ({"job_id": uuid4()}, {"company_row_id": 999}, {"role": "ceo"}):
            with self.subTest(changes=changes), self.assertRaises(AnalysisJobConflict):
                jobs.save(request, result.model_copy(update=changes))
        engine.begin.assert_not_called()

    def test_unexpected_pipeline_error_is_saved_as_failed_job(self):
        request, _ = example()
        jobs, runner = MagicMock(), MagicMock()
        runner.analyze.side_effect = RuntimeError("do not expose private diagnostic text")
        result = analyze_and_save(runner, request, jobs)
        self.assertEqual(result.outcome, "failed")
        self.assertEqual(result.warnings, ["analysis_exception:RuntimeError"])
        jobs.save.assert_called_once_with(request, result)

    def test_http_persistence_success_and_failure(self):
        request, result = example()
        jobs, runner = MagicMock(), MagicMock()
        runner.analyze.return_value = result
        app = create_app(settings=ServiceSettings({"ML_SERVICE_TOKEN": "test"}),
                         web_pipeline=runner, job_repository=jobs)
        with TestClient(app) as client:
            response = client.post("/internal/analyze", json=request.model_dump(mode="json"),
                                   headers={"Authorization": "Bearer test"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["insights"][0]["evidence_sources"][0]["title"],
                             result.evidence[0].title)
            jobs.save.side_effect = AnalysisJobStoreError("result save failed")
            response = client.post("/internal/analyze", json=request.model_dump(mode="json"),
                                   headers={"Authorization": "Bearer test"})
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.json()["detail"]["code"], "analysis_jobs_persistence_failed")

    def test_http_permission_and_duplicate_job_do_not_run_pipeline(self):
        request, _ = example()
        jobs, runner = MagicMock(), MagicMock()
        app = create_app(settings=ServiceSettings({"ML_SERVICE_TOKEN": "test"}),
                         web_pipeline=runner, job_repository=jobs)
        with TestClient(app) as client:
            for error, status in ((AnalysisJobPermissionError("access denied"), 503),
                                  (AnalysisJobConflict("already running"), 409)):
                jobs.start.side_effect = error
                response = client.post("/internal/analyze", json=request.model_dump(mode="json"),
                                       headers={"Authorization": "Bearer test"})
                self.assertEqual(response.status_code, status)
        runner.analyze.assert_not_called()


if __name__ == "__main__":
    unittest.main()
