import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx
from fastapi.testclient import TestClient

from ml.src.bank_research import BankResearchProvider, configured_bank_provider
from ml.src.budget import BudgetManager
from ml.src.contracts import EvidenceRecord
from ml.src.impact import ImpactResponse, validate_candidate
from ml.src.research_context_repository import ResearchContextPermissionError
from ml.src.result_sources import resolve_result_sources
from ml.src.service import ServiceSettings, create_app
from ml.tests import test_web_pipeline as fixtures


class BankResearchTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.WebPipelineTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.candidate, self.context = self.fixture.with_evidence()
        self.profile = self.fixture.repo.get_company_profile('U_EXAMPLE', 123)
        self.store = MagicMock()
        self.store.search.return_value = [{'text': 'Bank report explains the financing mechanism.',
            'source': 'bank-report.pdf', 'page_start': 3, 'page_end': 3,
            'score': .85, 'document_id': 'report-1'}]
        self.provider = BankResearchProvider(lambda: self.store)
        self.bank = self.provider.enrich(self.fixture.request, self.profile, self.context, BudgetManager())

    def bank_candidate(self):
        ref = self.bank.evidence[0].evidence_id
        return {**self.candidate,
                'evidence_refs': self.candidate['evidence_refs'] + [ref],
                'evidence_quotes': {**self.candidate['evidence_quotes'], ref: self.bank.evidence[0].excerpt},
                'bank_view': {'status': 'available', 'text': 'Financing mechanism from the bank PDF.',
                              'report_at': None, 'evidence_refs': [ref]}}

    def test_adapter_ids_pages_unknown_dates_no_private_search_input(self):
        source = self.bank.evidence[0]
        self.assertEqual(source.source_kind, 'bank_research')
        self.assertEqual(source.page_number, 3)
        self.assertIsNone(source.published_at)
        self.assertIsNone(source.url)
        query = self.store.search.call_args.args[0]
        self.assertNotIn('U_EXAMPLE', query)
        self.store.search.return_value *= 2
        self.assertEqual(len(self.provider.enrich(self.fixture.request, self.profile,
                                                 self.context, BudgetManager()).evidence), 1)
        self.assertEqual(self.provider.enrich(self.fixture.request, self.profile,
                         self.context, BudgetManager()).evidence[0].evidence_id, source.evidence_id)
        self.store.search.return_value = [{'text': 'bad', 'source': 'fake.pdf', 'page_start': 0, 'score': .9},
                                          {'text': 'low score', 'source': 'x.pdf', 'page_start': 1, 'score': .1}]
        self.assertFalse(self.provider.enrich(self.fixture.request, self.profile,
                                             self.context, BudgetManager()).evidence)

    def test_optional_config_does_not_break_web_only(self):
        with patch.dict('os.environ', {'SUPABASE_URL': '', 'SUPABASE_SERVICE_KEY': ''}):
            self.assertIsNone(configured_bank_provider())

    def test_busy_pdf_worker_does_not_block_web_insights(self):
        runner, _, _ = self.fixture.runner(candidate=self.candidate)
        runner.bank_provider = MagicMock()
        with patch('ml.src.bank_research._pdf_inflight') as lock:
            lock.acquire.return_value = False
            result = runner.analyze(self.fixture.request)
        self.assertTrue(result.insights)
        runner.bank_provider.enrich.assert_not_called()
        self.assertIn('bank_research_unavailable:TimeoutError', result.warnings)

    def test_pipeline_persists_separate_bank_block_and_returns_sources(self):
        runner, model, _ = self.fixture.runner(candidate=self.bank_candidate())
        runner.bank_provider = self.provider
        result = resolve_result_sources(runner.analyze(self.fixture.request))
        self.assertEqual(result.outcome, 'ok')
        self.assertEqual(result.insights[0].bank_view.status, 'available')
        pdf = next(s for s in result.insights[0].evidence_sources if s['source_kind'] == 'bank_research')
        self.assertEqual(pdf['page_number'], 3)
        self.assertIsNone(pdf['published_at'])
        self.assertTrue(any('PDF' in a for a in result.insights[0].assumptions))
        saved = json.loads(self.fixture.path.read_text(encoding='utf-8'))
        self.assertEqual(saved['base_information'], self.fixture.payload['base_information'])
        self.assertTrue(all(e['source_kind'] != 'bank_research' for e in saved['web_research']['context']['evidence']))
        self.assertEqual(saved['alfa_analytics']['context']['evidence'][0]['page_number'], 3)
        # Reusing web research still retrieves current PDF background, without mutating old snapshots.
        first_ref = result.research_context.evidence[-1].evidence_id
        again = runner.analyze(self.fixture.request)
        self.assertEqual(len(again.research_context.evidence), len(result.research_context.evidence))
        self.assertEqual(result.research_context.evidence[-1].evidence_id, first_ref)

    def test_pdf_outage_keeps_existing_web_insights(self):
        runner, _, _ = self.fixture.runner(candidate=self.candidate)
        runner.bank_provider = MagicMock()
        runner.bank_provider.enrich.side_effect = RuntimeError('private secret must not be exposed')
        result = runner.analyze(self.fixture.request)
        self.assertEqual(result.outcome, 'partial')
        self.assertTrue(result.insights)
        self.assertEqual(result.insights[0].bank_view.status, 'unavailable')
        self.assertIn('bank_research_unavailable:RuntimeError', result.warnings)
        self.assertNotIn('private secret', str(result.warnings))

    def test_pdf_persistence_failure_keeps_retrieved_context(self):
        runner, _, _ = self.fixture.runner(candidate=self.bank_candidate())
        runner.bank_provider = self.provider
        runner.context_repository.replace_alfa_analytics = MagicMock(side_effect=ResearchContextPermissionError())
        result = runner.analyze(self.fixture.request)
        self.assertEqual(result.outcome, 'partial')
        self.assertEqual(result.insights[0].bank_view.status, 'available')
        self.assertTrue(any('bank_context_save_failed' in w for w in result.warnings))

    def test_bank_cannot_replace_web_event_or_invent_report_date(self):
        context = self.context.model_copy(update={'evidence': self.context.evidence + self.bank.evidence})
        candidate = self.bank_candidate()
        parsed = ImpactResponse.model_validate({'insights': [candidate]}).insights[0]
        self.assertEqual(validate_candidate(parsed, context, self.profile), [])
        parsed.bank_view.report_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.assertIn('invented_bank_report_date', validate_candidate(parsed, context, self.profile))
        parsed.bank_view.report_at = None
        parsed.evidence_refs = self.bank.evidence and [self.bank.evidence[0].evidence_id]
        parsed.evidence_quotes = {self.bank.evidence[0].evidence_id: self.bank.evidence[0].excerpt}
        self.assertIn('missing_web_event_source', validate_candidate(parsed, context, self.profile))
        parsed.bank_view.evidence_refs = ['invented']
        self.assertIn('bank_view_requires_pdf', validate_candidate(parsed, context, self.profile))

    def test_bank_sources_are_available_to_session_chat(self):
        from ml.src.analysis_chat import AnalysisChat, ChatRequest, ChatAnswer
        runner, _, _ = self.fixture.runner(candidate=self.bank_candidate())
        runner.bank_provider = self.provider
        result = runner.analyze(self.fixture.request)
        repository, model = MagicMock(), MagicMock()
        repository.get_result.return_value = result
        model.structured.return_value = ChatAnswer(answer='Explanation from saved PDF.',
            evidence_refs=[self.bank.evidence[0].evidence_id])
        answer = AnalysisChat(repository, model).answer(ChatRequest(job_id=result.job_id, message='Explain'))
        self.assertEqual(answer.sources[0].page_number, 3)

    def test_pdf_routes_require_service_auth_and_use_same_app(self):
        app = create_app(settings=ServiceSettings({'ML_SERVICE_TOKEN': 'test'}))
        with TestClient(app) as client, patch('ml.document_search.api.document_store', return_value=self.store):
            self.assertEqual(client.post('/internal/documents/search', json={'question': 'rates'}).status_code, 401)
            response = client.post('/internal/documents/search', json={'question': 'rates'},
                                   headers={'Authorization': 'Bearer test'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['count'], 1)
            self.store.search.side_effect = RuntimeError('secret')
            response = client.post('/internal/documents/search', json={'question': 'rates'},
                                   headers={'Authorization': 'Bearer test'})
            self.assertEqual(response.status_code, 503)
            self.assertNotIn('secret', response.text)
            self.assertEqual(client.post('/analysis/jobs', json={}).status_code, 404)

    def test_grisha_store_rpc_preserves_document_and_chunk_identity(self):
        from ml.document_search.supabase_store import SupabaseDocumentStore
        row = {'chunk_id': 'chunk-1', 'document_id': 'doc-1', 'source': 'bank.pdf',
               'page_start': 2, 'page_end': 2, 'content': 'text', 'similarity': .8}
        def handler(request):
            self.assertEqual(request.url.path, '/rest/v1/rpc/match_document_chunks')
            return httpx.Response(200, json=[row])
        with patch.dict('os.environ', {'SUPABASE_URL': 'https://test.supabase.co', 'SUPABASE_SERVICE_KEY': 'test'}):
            store = SupabaseDocumentStore()
        store._embed_query = lambda q: [0.] * 384
        store._client = lambda: httpx.Client(transport=httpx.MockTransport(handler))
        rows = store.search('rates')
        self.assertEqual(rows[0]['document_id'], 'doc-1')
        self.assertEqual(rows[0]['chunk_id'], 'chunk-1')


if __name__ == '__main__':
    unittest.main()
