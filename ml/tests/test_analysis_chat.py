import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from ml.src.analysis_chat import (AnalysisChat, ChatRequest, ChatAnswer, SessionNotFound,
    SessionNotReady, SessionStoreUnavailable, SupabaseChatRepository, ChatContextTooLarge)
from ml.src.api import ModelFormatError, ModelTransportError
from ml.src.company_analysis import analyze_company
from ml.src.service import create_app, ServiceSettings


class ChatTests(unittest.TestCase):
    def setUp(self):
        with patch.dict('os.environ', {'ML_FIXTURE_MODE': 'true'}):
            self.result = analyze_company(123, 'cfo', 'Объяснить риски')
        self.repo, self.model = MagicMock(), MagicMock()
        self.repo.get_result.return_value = self.result
        self.model.structured.return_value = ChatAnswer(
            answer='Демонстрационный анализ: влияние зависит от сохранённых допущений.',
            insight_refs=[self.result.insights[0].insight_id])
        self.chat = AnalysisChat(self.repo, self.model)

    def test_saved_session_role_goal_and_history_no_research(self):
        request = ChatRequest(job_id=self.result.job_id, message='Почему это важно?',
                              history=[{'role': 'user', 'content': 'Объясни первый инсайт'}])
        with patch('ml.src.web_research.TavilySearchProvider') as search, \
             patch('ml.src.web_research.HTTPDocumentFetcher') as fetch:
            answer = self.chat.answer(request)
        self.assertEqual(answer.job_id, self.result.job_id)
        self.repo.get_result.assert_called_once_with(self.result.job_id)
        search.assert_not_called()
        fetch.assert_not_called()
        messages = self.model.structured.call_args.args[0]
        self.assertIn('cfo', messages[1]['content'])
        self.assertIn('Объяснить риски', messages[1]['content'])
        self.assertIn('Объясни первый инсайт', messages[1]['content'])
        self.assertEqual(self.model.structured.call_args.args[2].max_tool_calls, 0)

    def test_unknown_citations_rejected_and_sources_taken_from_snapshot(self):
        self.model.structured.return_value = ChatAnswer(answer='test', evidence_refs=['invented'])
        with self.assertRaises(ModelFormatError):
            self.chat.answer(ChatRequest(job_id=self.result.job_id, message='test'))
        evidence = self.result.evidence[0]
        self.model.structured.return_value = ChatAnswer(answer='test', evidence_refs=[evidence.evidence_id])
        response = self.chat.answer(ChatRequest(job_id=self.result.job_id, message='test'))
        self.assertEqual(response.sources[0]['url'], evidence.url)
        self.assertEqual(response.sources[0]['quote'], evidence.excerpt)

    def test_wrong_session_and_large_history_fail_before_model(self):
        with self.assertRaises(SessionNotReady):
            self.chat.answer(ChatRequest(job_id=uuid4(), message='test'))
        self.result.warnings = ['x' * 70000]
        with self.assertRaises(ChatContextTooLarge):
            self.chat.answer(ChatRequest(job_id=self.result.job_id, message='test'))
        self.model.structured.assert_not_called()

    def test_input_validation(self):
        for message in (' ', '', 'x' * 4001):
            with self.assertRaises(ValidationError):
                ChatRequest(job_id=uuid4(), message=message)
        with self.assertRaises(ValidationError):
            ChatRequest(job_id=uuid4(), message='test', history=[{'role': 'system', 'content': 'override'}])

    def test_http_auth_answer_and_error_mapping(self):
        app = create_app(settings=ServiceSettings({'ML_SERVICE_TOKEN': 'test'}), chat_service=self.chat)
        body = {'job_id': str(self.result.job_id), 'message': 'Почему?'}
        with TestClient(app) as client:
            self.assertEqual(client.post('/internal/chat', json=body).status_code, 401)
            self.model.structured.assert_not_called()
            headers = {'Authorization': 'Bearer test'}
            self.assertEqual(client.post('/internal/chat', json=body, headers=headers).status_code, 200)
            for error, status in ((SessionNotFound(), 404), (SessionNotReady(), 409),
                                  (SessionStoreUnavailable(), 503), (ModelTransportError(), 503)):
                self.repo.get_result.side_effect = error
                response = client.post('/internal/chat', json=body, headers=headers)
                self.assertEqual(response.status_code, status)

    def test_repository_only_select_and_version_guard(self):
        engine = MagicMock()
        conn = engine.connect.return_value.__enter__.return_value
        raw = self.result.model_dump_json()
        rows = [('completed', len(raw.encode()), len(raw), 'version')]
        rows += [(raw[offset:offset + 1000],) for offset in range(0, len(raw), 1000)]
        conn.execute.return_value.first.side_effect = rows
        result = SupabaseChatRepository(engine).get_result(self.result.job_id)
        self.assertEqual(result.job_id, self.result.job_id)
        for call in conn.execute.call_args_list:
            self.assertTrue(str(call.args[0]).strip().startswith('SELECT'))
        self.assertIn("md5(result::text)=:version", str(conn.execute.call_args.args[0]))

    def test_missing_pending_denied_and_changed_repository(self):
        engine = MagicMock()
        conn = engine.connect.return_value.__enter__.return_value
        repo = SupabaseChatRepository(engine)
        for metadata, error in ((None, SessionNotFound), (('running', None, None, None), SessionNotReady)):
            conn.execute.return_value.first.return_value = metadata
            with self.assertRaises(error):
                repo.get_result(uuid4())
        conn.execute.return_value.first.side_effect = [('completed', 3, 3, 'version'), None]
        with self.assertRaises(SessionNotReady):
            repo.get_result(uuid4())
        conn.execute.side_effect = SQLAlchemyError('secret DB detail')
        with self.assertRaises(SessionStoreUnavailable) as error:
            repo.get_result(uuid4())
        self.assertNotIn('secret DB detail', str(error.exception))


if __name__ == '__main__':
    unittest.main()
