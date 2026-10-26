"""Session-bound explanations of saved analysis results; no research tools."""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Literal
from uuid import UUID

import httpx
from dotenv import load_dotenv
from pydantic import Field, field_validator
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .api import GatewayClient, ModelSettings
from .budget import BudgetManager
from .contracts import AnalysisResult, Contract
from .profile_repository import ROOT, SupabaseSettings


class SessionNotFound(Exception):
    pass


class SessionNotReady(Exception):
    pass


class SessionStoreUnavailable(Exception):
    pass


class ChatContextTooLarge(Exception):
    pass


class ChatTurn(Contract):
    role: Literal['user', 'assistant']
    content: str = Field(min_length=1, max_length=8000)
    # Accept the existing backend ChatMessage JSON without dropping its metadata.
    id: UUID | None = None
    created_at: datetime | None = None

    @field_validator('content')
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError('history content must not be blank')
        return value.strip()


class ChatRequest(Contract):
    job_id: UUID
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)

    @field_validator('message')
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError('message must not be blank')
        return value.strip()


class ChatAnswer(Contract):
    answer: str = Field(min_length=1, max_length=8000)
    insight_refs: list[str] = Field(default_factory=list, max_length=5)
    evidence_refs: list[str] = Field(default_factory=list, max_length=48)
    insufficient_context: bool = False

    @field_validator('answer')
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError('answer must not be blank')
        return value.strip()


class ChatSource(Contract):
    evidence_id: str
    title: str
    url: str | None
    publisher: str | None
    published_at: datetime | None
    page_number: int | None
    quote: str


class ChatResponse(ChatAnswer):
    job_id: UUID
    sources: list[ChatSource] = Field(default_factory=list)
    mode: Literal['saved_analysis'] = 'saved_analysis'


class BackendChatRepository:
    """Read the existing backend endpoint; the backend owns analysis_jobs."""

    def __init__(self, base_url: str, client=None, token: str | None = None):
        self.base_url = base_url.rstrip('/')
        self.client = client
        self.token = token
        if not self.base_url.startswith(('http://', 'https://')):
            raise SessionStoreUnavailable('invalid ML_BACKEND_URL')

    def get_result(self, job_id: UUID) -> AnalysisResult:
        client = self.client or httpx.Client(timeout=10, follow_redirects=False, trust_env=False)
        try:
            headers = {'Authorization': f'Bearer {self.token}'} if self.token else {}
            with client.stream('GET', f'{self.base_url}/api/v1/analysis/jobs/{job_id}',
                               headers=headers) as response:
                if response.status_code == 404:
                    raise SessionNotFound('analysis session not found')
                if response.status_code != 200:
                    raise SessionStoreUnavailable('backend result endpoint unavailable')
                raw = bytearray()
                for chunk in response.iter_bytes():
                    raw.extend(chunk)
                    if len(raw) > 2 * 1024 * 1024:
                        raise ChatContextTooLarge('backend job exceeds 2 MiB')
            job = json.loads(raw)
            if UUID(job['job_id']) != job_id or job.get('status') != 'completed' or not job.get('result'):
                raise SessionNotReady('analysis is not completed or has no matching result')
            result = AnalysisResult.model_validate(job['result'])
            if result.job_id != job_id:
                raise SessionNotReady('saved result does not match session')
            return result
        except httpx.HTTPError as exc:
            raise SessionStoreUnavailable('backend result endpoint unreachable') from exc
        except (ValueError, KeyError, TypeError) as exc:
            raise SessionNotReady('backend job has an unsupported format') from exc
        finally:
            if self.client is None:
                client.close()


class SupabaseChatRepository:
    """SELECT only. Never creates/updates jobs or chat messages."""

    def __init__(self, engine):
        self.engine = engine

    def get_result(self, job_id: UUID) -> AnalysisResult:
        params = {'id': str(job_id)}
        try:
            with self.engine.connect() as conn:
                meta = conn.execute(text("""SELECT status, octet_length(result::text),
                    length(result::text), md5(result::text) FROM public.analysis_jobs
                    WHERE id=CAST(:id AS uuid)"""), params).first()
            if meta is None:
                raise SessionNotFound('analysis session not found')
            if meta[0] != 'completed' or meta[1] is None:
                raise SessionNotReady('analysis session is not completed or has no result')
            if meta[1] > 1024 * 1024:
                raise ChatContextTooLarge('saved result exceeds 1 MiB')
            # Bound individual wire responses for the Supabase transaction pooler.
            parts = []
            for offset in range(1, meta[2] + 1, 1000):
                with self.engine.connect() as conn:
                    row = conn.execute(text("""SELECT substring(result::text FROM :offset FOR 1000)
                        FROM public.analysis_jobs WHERE id=CAST(:id AS uuid)
                        AND status='completed' AND md5(result::text)=:version"""),
                        {**params, 'offset': offset, 'version': meta[3]}).first()
                if row is None:
                    raise SessionNotReady('analysis changed during reading; retry')
                parts.append(row[0])
            result = AnalysisResult.model_validate_json(''.join(parts))
            if result.job_id != job_id:
                raise SessionNotReady('saved result does not match session')
            return result
        except SQLAlchemyError as exc:
            # Log/return no DSN, SQL parameters or credentials.
            raise SessionStoreUnavailable('analysis_jobs read unavailable; check SELECT permission and RLS') from exc
        except ValueError as exc:
            raise SessionNotReady('saved result has an unsupported format') from exc


class AnalysisChat:
    def __init__(self, repository, model):
        self.repository = repository
        self.model = model

    def answer(self, request: ChatRequest) -> ChatResponse:
        result = self.repository.get_result(request.job_id)
        if result.job_id != request.job_id:
            raise SessionNotReady('saved result does not match session')
        if result.outcome == 'failed':
            raise SessionNotReady('analysis failed')
        if not result.insights and not result.evidence and not result.research_context:
            return ChatResponse(job_id=request.job_id, insufficient_context=True,
                                answer='В этой сессии нет сохранённых инсайтов и источников. '
                                       'Пояснить результат по имеющимся данным невозможно.')
        evidence = {e.evidence_id: e for e in result.evidence}
        if result.research_context:
            evidence.update((e.evidence_id, e) for e in result.research_context.evidence)
        context = {
            'job_id': str(result.job_id), 'company_id': result.company_id,
            'role': result.role, 'goal': result.goal, 'as_of': result.as_of.isoformat(),
            'analysis_mode': result.mode, 'outcome': result.outcome,
            'insights': [i.model_dump(mode='json') for i in result.insights],
            'evidence': [e.model_dump(mode='json') for e in evidence.values()],
            'warnings': result.warnings,
            'profile': result.profile_snapshot.model_dump(mode='json') if result.profile_snapshot else None,
        }
        # Never silently truncate the evidence of an answer.
        content = json.dumps({'saved_analysis': context,
                              'history': [t.model_dump(mode='json') for t in request.history],
                              'question': request.message}, ensure_ascii=False)
        if len(content) > 65000:
            raise ChatContextTooLarge('session context and history exceed chat input limit')
        prompt = (Path(__file__).resolve().parents[1] / 'prompts' / 'chat_analyst.md').read_text(encoding='utf-8')
        answer = self.model.structured(
            [{'role': 'system', 'content': prompt}, {'role': 'user', 'content': content}],
            ChatAnswer, BudgetManager(max_llm_calls=2, max_input_tokens=48000,
                                     max_output_tokens=6000, max_tool_calls=0, max_search_tasks=0),
            output_tokens=3000)
        known_insights = {i.insight_id for i in result.insights}
        if not set(answer.insight_refs) <= known_insights or not set(answer.evidence_refs) <= evidence.keys():
            from .api import ModelFormatError
            raise ModelFormatError('chat answer references unknown session evidence or insight')
        sources = []
        for ref in dict.fromkeys(answer.evidence_refs):
            e = evidence[ref]
            sources.append({'evidence_id': ref, 'title': e.title, 'url': e.url,
                            'publisher': e.publisher, 'published_at': e.published_at,
                            'page_number': e.page_number, 'quote': e.excerpt})
        return ChatResponse(job_id=request.job_id, **answer.model_dump(), sources=sources)


def answer_analysis_question(job_id: UUID | str, message: str, *,
                             history: list[dict] | None = None) -> ChatResponse:
    """Explain one saved session. Does not search, persist messages or update jobs."""
    request = ChatRequest(job_id=job_id, message=message, history=history or [])
    load_dotenv(ROOT / '.env', override=False)
    source = os.getenv('ML_CHAT_RESULT_SOURCE', 'supabase')
    engine = None
    model = None
    try:
        if source == 'backend':
            repository = BackendChatRepository(os.getenv('ML_BACKEND_URL', 'http://127.0.0.1:8080'),
                                               token=os.getenv('ML_BACKEND_TOKEN'))
        elif source == 'supabase':
            engine = SupabaseSettings().create_engine()
            repository = SupabaseChatRepository(engine)
        else:
            raise SessionStoreUnavailable('ML_CHAT_RESULT_SOURCE must be backend or supabase')
        model = GatewayClient(ModelSettings.from_environment())
        return AnalysisChat(repository, model).answer(request)
    finally:
        if engine is not None:
            engine.dispose()
        if model is not None:
            model.client.close()
