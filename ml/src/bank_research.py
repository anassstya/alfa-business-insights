"""Adapt Grisha's PDF store to the existing source-grounded research contract."""

from __future__ import annotations

import hashlib
import os
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from datetime import datetime, timezone
from pathlib import PurePosixPath
from threading import Lock

from .contracts import CompanyResearchContext, EvidenceRecord
from .runtime_environment import load_runtime_environment

BANK_VERSION = 'supabase-pdf-1'
_pdf_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='bank-pdf')
_pdf_inflight = Lock()


def enrich_with_timeout(provider, request, profile, context, budget):
    """One optional lookup at a time; slow model downloads cannot block web impacts."""
    timeout = min(20.0, budget.remaining() - 30.0)
    if timeout <= 0 or budget.tool_calls >= budget.max_tool_calls or not _pdf_inflight.acquire(blocking=False):
        raise TimeoutError('optional PDF lookup skipped: busy or insufficient budget')

    def run():
        try:
            return provider.enrich(request, profile, context, budget)
        finally:
            _pdf_inflight.release()

    return _pdf_executor.submit(run).result(timeout=timeout)


@lru_cache(maxsize=1)
def document_store():
    """Lazy imports keep the web service usable without PDF configuration/deps."""
    load_runtime_environment()
    from ml.document_search.supabase_store import SupabaseDocumentStore
    return SupabaseDocumentStore()


class BankResearchProvider:
    def __init__(self, store_factory=document_store):
        self.store_factory = store_factory

    def enrich(self, request, profile, context, budget):
        budget.reserve_tool()
        query = ' '.join([e.factor for e in context.exposures[:5]] +
                         [topic for e in context.exposures[:3] for topic in e.search_topics[:2]])
        if not query.strip():
            query = 'инфляция процентные ставки финансирование отраслевые риски'
        # No synthetic company IDs, person IDs, raw payments or user instructions in search.
        rows = self.store_factory().search(query[:1000], top_k=4)
        budget.remaining()
        evidence, seen = [], set()
        gaps = []
        for row in rows:
            content = str(row.get('text') or '').strip()[:4000]
            source = str(row.get('source') or '').strip()
            try:
                page = int(row['page_start'])
                if page < 1 or not content or not source or not source.lower().endswith('.pdf'):
                    raise ValueError
                score = float(row.get('score', 0))
                if not 0.3 <= score <= 1:
                    continue
            except (ValueError, TypeError, KeyError):
                gaps.append('invalid_pdf_search_result')
                continue
            digest = hashlib.sha256((source + ':' + str(page) + ':' + content).encode()).hexdigest()
            if digest in seen:
                continue
            seen.add(digest)
            # The current index has no publication dates. Never infer one from a filename.
            evidence.append(EvidenceRecord(
                evidence_id='bank-' + digest[:32],
                document_id=str(row.get('document_id') or hashlib.sha256(source.encode()).hexdigest())[:80],
                source_kind='bank_research', title=PurePosixPath(source).name[:500],
                publisher='Банковская аналитика: настроенный PDF-корпус', url=None,
                retrieved_at=datetime.now(timezone.utc), published_at=None,
                page_number=page, excerpt=content, content_hash=hashlib.sha256(content.encode()).hexdigest(),
                date_status='unknown', content_status='excerpt_only'))
        return CompanyResearchContext(
            company_id=context.company_id, profile_hash=profile.profile_hash,
            as_of=context.as_of, window=context.window, exposures=context.exposures,
            evidence=evidence, coverage={'status': 'ok' if evidence else 'empty',
                                         'provider': 'supabase_pgvector', 'matches': len(evidence)},
            gaps=list(dict.fromkeys(gaps + (['pdf_publication_dates_unknown'] if evidence else []))),
            versions={'bank': BANK_VERSION})


def configured_bank_provider():
    load_runtime_environment()
    if os.getenv('SUPABASE_URL') and os.getenv('SUPABASE_SERVICE_KEY'):
        return BankResearchProvider()
    return None
