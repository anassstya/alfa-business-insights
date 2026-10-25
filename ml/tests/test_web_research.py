import io
import logging
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi.testclient import TestClient

from ml.src.contracts import SearchTask
from ml.src.service import ServiceSettings, create_app
from ml.src.web_research import (Candidate, FileEvidenceStore, HTTPDocumentFetcher,
                                  ProviderResult, TavilySearchProvider, canonical_url,
                                  parse_rss_candidates, search_news)


NOW = datetime(2026, 10, 25, tzinfo=timezone.utc)
TASK = SearchTask(task_id="test", exposure_ids=[], question="Металлы", query="металлы тариф",
                  source_kind="news", priority=50, reason="test", expected_evidence="article",
                  max_results=5, filters={"start": "2026-10-01T00:00:00+00:00",
                                          "end": "2026-10-25T00:00:00+00:00",
                                          "as_of": "2026-10-25T00:00:00+00:00"})
BODY = "Новый тариф на металлы опубликован сегодня. " * 10


def html(title="Тариф на металлы", date="2026-10-20T09:00:00+03:00", body=BODY):
    meta = f'<meta property="article:published_time" content="{date}">' if date else ""
    return f'<html><head><title>{title}</title><meta property="og:site_name" content="Ведомство">{meta}</head><body><article>{body}</article></body></html>'


def resolver(host, port, **kwargs):
    if host == "private.example":
        address = "127.0.0.1"
    else:
        address = "93.184.215.14"
    return [(2, 1, 6, "", (address, port))]


class StaticProvider:
    def __init__(self, candidates):
        self.candidates = candidates

    def search(self, task):
        return ProviderResult(candidates=self.candidates, coverage={"source": "mock", "status": "ok", "matches": len(self.candidates)})


class WebResearchTests(unittest.TestCase):
    def test_tavily_body_and_normalization(self):
        requests = []
        def handler(request):
            requests.append(request)
            return httpx.Response(200, json={"results": [{"title": "Тариф", "url": "https://news.example/a",
                "content": "Поисковый фрагмент", "score": 0.7, "published_date": "2026-10-20T09:00:00Z"}]})
        client = httpx.Client(transport=httpx.MockTransport(handler))
        result = TavilySearchProvider("test-key", client).search(TASK)
        self.assertEqual(result.coverage["status"], "ok")
        self.assertEqual(result.candidates[0].snippet, "Поисковый фрагмент")
        self.assertEqual(result.candidates[0].published_at.date().isoformat(), "2026-10-20")
        body = __import__("json").loads(requests[0].content)
        self.assertEqual(requests[0].headers["Authorization"], "Bearer test-key")
        self.assertEqual(body["language"], "ru")
        self.assertEqual(body["topic"], "news")
        self.assertEqual(body["search_depth"], "basic")
        self.assertFalse(body["include_answer"])
        self.assertFalse(body["include_raw_content"])
        self.assertFalse(body["auto_parameters"])
        self.assertEqual((body["start_date"], body["end_date"]), ("2026-10-01", "2026-10-25"))
        self.assertEqual(TavilySearchProvider("", client).search(TASK).errors[0].code, "configuration")
        general = TASK.model_copy(update={"source_kind": "official_release"})
        TavilySearchProvider("test-key", client).search(general)
        self.assertEqual(__import__("json").loads(requests[-1].content)["topic"], "general")

    def test_tavily_errors_timeout_and_no_secret_in_logs(self):
        stream = io.StringIO()
        handler = logging.StreamHandler(stream)
        logger = logging.getLogger("ml.src.web_research")
        logger.addHandler(handler)
        try:
            for status, code in [(401, "authentication"), (429, "rate_limit"),
                                 (432, "quota_exhausted"), (433, "quota_exhausted")]:
                client = httpx.Client(transport=httpx.MockTransport(lambda request, s=status: httpx.Response(s)))
                self.assertEqual(TavilySearchProvider("private-test-key", client).search(TASK).errors[0].code, code)
            def timeout(request):
                raise httpx.ReadTimeout("timed out")
            client = httpx.Client(transport=httpx.MockTransport(timeout))
            self.assertEqual(TavilySearchProvider("private-test-key", client).search(TASK).errors[0].code, "timeout")
            self.assertNotIn("private-test-key", stream.getvalue())
        finally:
            logger.removeHandler(handler)

    def test_import_dedup_dates_bm25_and_http_endpoint(self):
        pages = {"/a": html(), "/copy": html(title="Перепечатка"),
                 "/unknown": html(date=""), "/future": html(date="2026-11-01T00:00:00Z")}
        def handler(request):
            return httpx.Response(200, text=pages[request.url.path], headers={"content-type": "text/html"})
        fetcher = HTTPDocumentFetcher(httpx.Client(transport=httpx.MockTransport(handler)), resolver=resolver)
        candidates = [Candidate(title=path, url=f"https://news.example{path}", snippet="snippet")
                      for path in pages]
        candidates.append(Candidate(title="duplicate", url="https://news.example/a?utm_source=x", snippet="snippet"))
        with tempfile.TemporaryDirectory() as temp:
            store = FileEvidenceStore(Path(temp))
            provider = StaticProvider(candidates)
            result = search_news(TASK, provider=provider, fetcher=fetcher, store=store, now=NOW)
            self.assertEqual(len(result.evidence), 1)  # exact URL and copied full text
            self.assertEqual(result.coverage["excluded_unknown_date"], 1)
            self.assertEqual(result.coverage["excluded_future"], 1)
            self.assertEqual(result.evidence[0].page_number, None)
            self.assertEqual(result.evidence[0].publisher, "Ведомство")
            self.assertEqual(result.evidence[0].content_status, "full_text")
            self.assertIn("Новый тариф", store.get(result.evidence[0].evidence_id)[1])
            self.assertEqual(len(store.search("тариф", start=NOW.replace(day=1), end=NOW)), 1)
            self.assertEqual(store.search("тариф", publisher="другой"), [])
            again = search_news(TASK, provider=provider, fetcher=fetcher, store=store, now=NOW)
            self.assertEqual(again.evidence[0].evidence_id, result.evidence[0].evidence_id)
            self.assertEqual(len(list((Path(temp) / "documents").glob("*.json"))), 1)
            self.assertIn("https://news.example/copy", (Path(temp) / "reprints.json").read_text(encoding="utf-8"))
            app = create_app(settings=ServiceSettings({"ML_SERVICE_TOKEN": "service", "ML_EVIDENCE_CACHE": temp}),
                             news_provider=provider, document_fetcher=fetcher, evidence_store=store)
            with TestClient(app) as client:
                self.assertEqual(client.post("/internal/news/search", json=TASK.model_dump(mode="json")).status_code, 401)
                response = client.post("/internal/news/search", json=TASK.model_dump(mode="json"),
                                       headers={"Authorization": "Bearer service"})
                self.assertEqual(response.status_code, 200)
                ref = response.json()["evidence"][0]["evidence_id"]
                resolved = client.get(f"/internal/evidence/{ref}", headers={"Authorization": "Bearer service"})
                self.assertIn("Новый тариф", resolved.json()["text"])

    def test_redirect_private_pdf_timeout_and_empty_results(self):
        def handler(request):
            if request.url.path == "/redirect":
                return httpx.Response(302, headers={"location": "http://private.example/internal"})
            if request.url.path == "/paywall":
                return httpx.Response(403)
            if request.url.path == "/timeout":
                raise httpx.ReadTimeout("timed out")
            return httpx.Response(200, text=html(), headers={"content-type": "text/html"})
        fetcher = HTTPDocumentFetcher(httpx.Client(transport=httpx.MockTransport(handler)), resolver=resolver)
        with tempfile.TemporaryDirectory() as temp:
            store = FileEvidenceStore(Path(temp))
            candidates = [Candidate(title="bad", url="https://news.example/redirect"),
                          Candidate(title="pdf", url="https://news.example/file.pdf"),
                          Candidate(title="timeout", url="https://news.example/timeout", published_at=NOW),
                          Candidate(title="paywall", url="https://news.example/paywall", published_at=NOW)]
            result = search_news(TASK, provider=StaticProvider(candidates), fetcher=fetcher, store=store, now=NOW)
            self.assertEqual(result.errors[0].code, "blocked_address")
            self.assertEqual(result.coverage["unsupported_pdf"], 1)
            self.assertEqual(result.coverage["fetch_failures"], 1)
            self.assertEqual(result.coverage["paywalls"], 1)
            self.assertIn("paywall", [item.content_status for item in result.evidence])
            empty = search_news(TASK, provider=StaticProvider([]), fetcher=fetcher, store=store, now=NOW)
            self.assertEqual(empty.coverage["status"], "ok")
            self.assertEqual(empty.errors, [])
            self.assertEqual(empty.evidence, [])
        self.assertEqual(canonical_url("https://NEWS.example/a?utm_source=x#t"), "https://news.example/a")
        self.assertEqual(parse_rss_candidates(b"<rss><channel></channel></rss>"), [])


if __name__ == "__main__":
    unittest.main()
