import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from ml.src.budget import BudgetManager
from ml.src.contracts import AnalysisRequest
from ml.src.impact import ImpactResponse, validate_candidate
from ml.src.profile_repository import JsonCompanyProfileRepository
from ml.src.research_context_repository import (JsonResearchContextRepository,
    ResearchContextPermissionError, SupabaseResearchContextRepository)
from ml.src.research_pipeline import ProposedPlan, ResearchPipeline
from ml.src.service import ServiceSettings, create_app
from ml.src.web_pipeline import WebAnalysisPipeline, make_scope
from ml.src.web_research import Candidate, FetchedPage, FileEvidenceStore, ProviderResult, SourceError

NOW = datetime(2026, 10, 25, tzinfo=timezone.utc)


class Model:
    def __init__(self, candidate=None):
        self.settings = type("Settings", (), {"model": "deepseek/deepseek-v4.1-flash"})()
        self.candidate = candidate
        self.calls = []

    def structured(self, messages, schema, budget, output_tokens):
        budget.reserve_llm(200, output_tokens)
        self.calls.append(schema.__name__)
        if schema is ProposedPlan:
            return ProposedPlan.model_validate({"tasks": [{"exposure_ids": ["loan_product"],
                "question": "How did lending conditions change?", "query": "lending conditions news",
                "source_kind": "news", "priority": 80, "reason": "Loan product may be exposed",
                "expected_evidence": "Dated lending report", "max_results": 1}]})
        return ImpactResponse.model_validate({"insights": [self.candidate] if self.candidate else []})


class Provider:
    def __init__(self, fail=False, empty=False):
        self.fail, self.empty, self.calls = fail, empty, 0

    def search(self, task):
        self.calls += 1
        if self.fail:
            return ProviderResult(errors=[SourceError(code="unavailable", detail="provider down")])
        if self.empty:
            return ProviderResult(candidates=[])
        return ProviderResult(candidates=[Candidate(title="Lending conditions", url="https://example.org/news",
            published_at=NOW, snippet="Lending terms changed on 25 October 2026.")])


class Fetcher:
    def fetch(self, candidate):
        return FetchedPage(url=candidate.url, title=candidate.title, published_at=NOW,
                           text="Lending terms changed on 25 October 2026. " * 4)


class WebPipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.path = root / "company.json"
        self.payload = {"company_id": "U_EXAMPLE", "base_information": {
            "profile": {"industry": {}, "geography": {}},
            "banking": {"products": {"loans": True, "loan_rate": None}},
            "market_position": {}, "corporate_group": {}, "payments": {},
            "person_links": {}, "data_quality": {}},
            "alfa_analytics": {"status": "untouched"}, "other": 7}
        self.path.write_text(json.dumps(self.payload), encoding="utf-8")
        profile_path = root / "profiles.json"
        profile_path.write_text(json.dumps([self.payload]), encoding="utf-8")
        self.repo = JsonCompanyProfileRepository(profile_path, identity_rows={"U_EXAMPLE": [123]})
        self.writer = JsonResearchContextRepository(self.path)
        self.store = FileEvidenceStore(root / "evidence")
        self.request = AnalysisRequest(job_id=uuid4(), company_row_id=123,
            company_id="U_EXAMPLE", role="cfo", as_of=NOW)
        self.candidate = {"event": "Lending terms changed on 25 October 2026",
            "confirmed_signal": "Lending terms changed on 25 October 2026.",
            "conditional_mechanism": "If future financing is needed, terms may affect its cost",
            "consequence": "Future financing decisions may need review",
            "ai_interpretation": "Potential financing sensitivity, subject to actual terms",
            "company_relevance": "A loan product is recorded; debt size and rate are unknown",
            "role_relevance": "CFO should assess any upcoming financing decisions",
            "risks": ["Possible higher future funding cost"], "opportunities": [],
            "suggested_actions": [], "assumptions": ["Current borrowing is unknown"],
            "uncertainty": "No current rate or debt size is available",
            "evidence_refs": [], "evidence_quotes": {},
            "feature_refs": ["/base_information/banking/products/loans"]}

    def runner(self, provider=None, candidate=None):
        model = Model(candidate)
        provider = provider or Provider()
        research = ResearchPipeline(self.repo, model, provider, Fetcher(), self.store)
        return WebAnalysisPipeline(research, self.writer), model, provider

    def with_evidence(self):
        runner, model, provider = self.runner()
        context = runner.research.run(self.request)
        ref = context.evidence[0].evidence_id
        candidate = {**self.candidate, "evidence_refs": [ref],
                     "evidence_quotes": {ref: "Lending terms changed on 25 October 2026."}}
        return candidate, context

    def test_first_write_refresh_scope_and_snapshot(self):
        candidate, context = self.with_evidence()
        runner, model, provider = self.runner(candidate=candidate)
        first = runner.analyze(self.request)
        self.assertEqual(first.outcome, "ok")
        self.assertEqual(first.insights[0].bank_view.status, "unavailable")
        self.assertEqual(first.insights[0].evidence_sources[0]["url"], "https://example.org/news")
        self.assertEqual(first.insights[0].ai_interpretation, candidate["ai_interpretation"])
        self.assertEqual(json.loads(self.path.read_text())["alfa_analytics"], self.payload["alfa_analytics"])
        self.assertEqual(json.loads(self.path.read_text())["base_information"], self.payload["base_information"])
        again = runner.analyze(self.request)
        self.assertEqual(provider.calls, 1)
        self.assertEqual(again.outcome, "ok")
        refresh = self.request.model_copy(update={"refresh_web_research": True})
        runner.analyze(refresh)
        self.assertEqual(provider.calls, 2)
        self.assertEqual(len(json.loads(self.path.read_text())["web_research"]["context"]["evidence"]), 1)
        ceo = self.request.model_copy(update={"role": "ceo"})
        runner.analyze(ceo)
        self.assertEqual(provider.calls, 3)
        self.assertEqual(self.writer.get_web_research("U_EXAMPLE").scope.role, "ceo")
        self.assertEqual(first.research_context.evidence[0].evidence_id, context.evidence[0].evidence_id)
        old_id = first.research_context.evidence[0].evidence_id
        saved = self.writer.get_web_research("U_EXAMPLE")
        self.writer.replace_web_research("U_EXAMPLE", saved.context.model_copy(update={"evidence": []}), saved.scope)
        self.assertEqual(first.research_context.evidence[0].evidence_id, old_id)
        self.assertEqual(self.writer.get_web_research("U_EXAMPLE").context.evidence, [])

    def test_invalid_ref_and_honest_empty(self):
        candidate, context = self.with_evidence()
        bad = {**candidate, "evidence_refs": ["missing"], "evidence_quotes": {"missing": "text"}}
        runner, _, _ = self.runner(candidate=bad)
        result = runner.analyze(self.request)
        self.assertEqual(result.outcome, "partial")
        self.assertEqual(result.insights, [])
        self.assertIn("unknown_evidence_id", result.warnings[0])
        self.assertTrue(validate_candidate(ImpactResponse.model_validate({"insights": [bad]}).insights[0],
                                           context, self.repo.get_company_profile("U_EXAMPLE", 123)))
        wrong_quote = {**candidate, "evidence_quotes": {candidate["evidence_refs"][0]: "Not in source"}}
        errors = validate_candidate(ImpactResponse.model_validate({"insights": [wrong_quote]}).insights[0],
                                    context, self.repo.get_company_profile("U_EXAMPLE", 123))
        self.assertTrue(any(e.startswith("quote_mismatch") for e in errors))
        wrong_feature = {**candidate, "feature_refs": ["/base_information/banking/nonexistent"]}
        errors = validate_candidate(ImpactResponse.model_validate({"insights": [wrong_feature]}).insights[0],
                                    context, self.repo.get_company_profile("U_EXAMPLE", 123))
        self.assertTrue(any(e.startswith("unknown_feature_ref") for e in errors))
        empty_runner, _, _ = self.runner(provider=Provider(empty=True))
        empty = empty_runner.analyze(self.request.model_copy(update={"refresh_web_research": True}))
        self.assertEqual(empty.outcome, "no_relevant_evidence")
        self.assertEqual(empty.insights, [])
        self.assertEqual(self.writer.get_web_research("U_EXAMPLE").context.evidence, [])

    def test_all_sources_failed_preserves_context_and_budget(self):
        candidate, _ = self.with_evidence()
        good, _, _ = self.runner(candidate=candidate)
        good.analyze(self.request)
        before = self.writer.get_web_research("U_EXAMPLE")
        failed, _, _ = self.runner(provider=Provider(fail=True), candidate=candidate)
        result = failed.analyze(self.request.model_copy(update={"refresh_web_research": True}))
        self.assertEqual(result.outcome, "partial")
        self.assertEqual(self.writer.get_web_research("U_EXAMPLE").refreshed_at, before.refreshed_at)
        self.assertIn("all_web_sources_unavailable", result.warnings)
        limited, _, _ = self.runner(candidate=candidate)
        no_budget = limited.analyze(self.request.model_copy(update={"refresh_web_research": True}),
                                    budget=BudgetManager(max_search_tasks=0))
        self.assertEqual(no_budget.outcome, "failed")
        self.path.write_text(json.dumps(self.payload), encoding="utf-8")
        fresh_failure, _, _ = self.runner(provider=Provider(fail=True), candidate=candidate)
        failed_result = fresh_failure.analyze(self.request)
        self.assertEqual(failed_result.outcome, "failed")
        self.assertIsNone(self.writer.get_web_research("U_EXAMPLE"))

    def test_http_live_with_injected_pipeline(self):
        candidate, _ = self.with_evidence()
        runner, _, _ = self.runner(candidate=candidate)
        app = create_app(settings=ServiceSettings({"ML_SERVICE_TOKEN": "test"}), web_pipeline=runner)
        with TestClient(app) as client:
            response = client.post("/internal/analyze", json=self.request.model_dump(mode="json"),
                                   headers={"Authorization": "Bearer test"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["outcome"], "ok")

    def test_one_news_cfo_and_ceo_share_facts_with_role_specific_view(self):
        candidate, _ = self.with_evidence()
        class RoleModel(Model):
            def structured(self, messages, schema, budget, output_tokens):
                if schema is ImpactResponse:
                    role = json.loads(messages[1]["content"])["role"]
                    self.candidate = {**candidate, "role_relevance":
                        "Review funding options" if role == "cfo" else "Review strategy exposure"}
                return super().structured(messages, schema, budget, output_tokens)
        model = RoleModel()
        provider = Provider()
        research = ResearchPipeline(self.repo, model, provider, Fetcher(), self.store)
        runner = WebAnalysisPipeline(research, self.writer)
        cfo = runner.analyze(self.request)
        ceo = runner.analyze(self.request.model_copy(update={"role": "ceo"}))
        self.assertEqual(cfo.outcome, "ok")
        self.assertEqual(ceo.outcome, "ok")
        self.assertEqual(cfo.insights[0].event, ceo.insights[0].event)
        self.assertNotEqual(cfo.insights[0].role_relevance, ceo.insights[0].role_relevance)

    def test_no_update_privilege_blocks_writer_before_mutation(self):
        class Connection:
            def execute(self, statement):
                return self
            def scalar_one(self):
                return False
            def __enter__(self):
                return self
            def __exit__(self, *_):
                pass
        class Engine:
            def connect(self):
                return Connection()
            def begin(self):
                raise AssertionError("UPDATE must not be attempted")
        _, context = self.with_evidence()
        scope = make_scope(self.request, model="deepseek/deepseek-v4.1-flash",
                           provider="Provider", search_task_limit=6)
        with self.assertRaises(ResearchContextPermissionError):
            SupabaseResearchContextRepository(Engine()).replace_web_research(
                "U_EXAMPLE", context, scope)


if __name__ == "__main__":
    unittest.main()
