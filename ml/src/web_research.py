"""Public web retrieval, evidence normalization and a small persistent BM25 corpus."""

from __future__ import annotations

import hashlib
import ipaddress
import json
import math
import os
import re
import socket
import time
from collections import Counter
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Protocol
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from xml.etree import ElementTree

import httpx
from dotenv import load_dotenv
from pydantic import BaseModel, Field

from .contracts import EvidenceRecord, SearchTask
from .profile_repository import ROOT


MAX_BODY = 1_000_000
MAX_TEXT = 100_000
TIMEOUT = 8.0
USER_AGENT = "AlfaBusinessInsightsML/1.0 (public evidence reader)"
TRACKING = {"fbclid", "gclid", "yclid", "ref", "source"}


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def canonical_url(url: str) -> str:
    parts = urlsplit(url.strip())
    if parts.scheme.lower() not in ("http", "https") or not parts.hostname or parts.username or parts.password:
        raise ValueError("unsupported_url")
    host = parts.hostname.lower().rstrip(".")
    port = parts.port
    host_netloc = f"[{host}]" if ":" in host else host
    netloc = host_netloc if port is None or (parts.scheme.lower(), port) in (("http", 80), ("https", 443)) else f"{host_netloc}:{port}"
    query = urlencode(sorted((k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
                          if k.lower() not in TRACKING and not k.lower().startswith("utm_")))
    return urlunsplit((parts.scheme.lower(), netloc, parts.path or "/", query, ""))


def public_url(url: str, *, resolver=socket.getaddrinfo) -> str:
    canonical = canonical_url(url)
    parts = urlsplit(canonical)
    host = parts.hostname or ""
    if host in {"localhost", "metadata.google.internal"} or host.endswith((".localhost", ".local", ".internal")):
        raise ValueError("blocked_address")
    try:
        addresses = [ipaddress.ip_address(item[4][0]) for item in resolver(host, parts.port or (443 if parts.scheme == "https" else 80), type=socket.SOCK_STREAM)]
    except (socket.gaierror, ValueError) as exc:
        raise ValueError("unresolvable_address") from exc
    if not addresses or any(not address.is_global for address in addresses):
        raise ValueError("blocked_address")
    return canonical


def parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            result = parsedate_to_datetime(value)
        except (ValueError, TypeError):
            return None
    return result.replace(tzinfo=timezone.utc) if result.tzinfo is None else result


class Candidate(BaseModel):
    title: str
    url: str
    snippet: str = ""
    score: float | None = None
    published_at: datetime | None = None
    publisher: str | None = None


class SourceError(BaseModel):
    code: str
    detail: str


class ProviderResult(BaseModel):
    candidates: list[Candidate] = Field(default_factory=list)
    errors: list[SourceError] = Field(default_factory=list)
    coverage: dict = Field(default_factory=dict)


class NewsProvider(Protocol):
    def search(self, task: SearchTask) -> ProviderResult: ...


def parse_rss_candidates(xml: bytes) -> list[Candidate]:
    """Normalize a saved RSS response; RSS is never an implicit Tavily fallback."""
    root = ElementTree.fromstring(xml[:MAX_BODY])
    items = root.findall(".//item")
    candidates = []
    for item in items:
        url = item.findtext("link")
        if url:
            candidates.append(Candidate(title=(item.findtext("title") or "")[:500], url=url,
                                        snippet=(item.findtext("description") or "")[:4000],
                                        published_at=parse_date(item.findtext("pubDate"))))
    return candidates


class TavilySearchProvider:
    def __init__(self, key: str | None = None, client: httpx.Client | None = None):
        if key is None:
            load_dotenv(ROOT / ".env", override=False)
            key = os.getenv("TAVILY_API")
        self.key = key
        self.client = client or httpx.Client(timeout=TIMEOUT, trust_env=False)

    def search(self, task: SearchTask) -> ProviderResult:
        if not self.key:
            return ProviderResult(errors=[SourceError(code="configuration", detail="TAVILY_API is missing")], coverage={"source": "tavily", "status": "error"})
        if task.source_kind == "bank_research":
            return ProviderResult(errors=[SourceError(code="unsupported_source", detail="bank research is not available")], coverage={"source": "tavily", "status": "error"})
        start, end = parse_date(task.filters.get("start")), parse_date(task.filters.get("end"))
        if start and end and start > end:
            return ProviderResult(errors=[SourceError(code="invalid_window", detail="start is after end")], coverage={"source": "tavily", "status": "error"})
        body = {"query": task.query, "language": "ru", "max_results": min(task.max_results, 8),
                "topic": "news" if task.source_kind == "news" else "general",
                "search_depth": "basic", "auto_parameters": False, "include_answer": False,
                "include_raw_content": False, "include_published_date": True}
        if start:
            body["start_date"] = start.date().isoformat()
        if end:
            body["end_date"] = end.date().isoformat()
        for attempt in range(2):
            try:
                response = self.client.post("https://api.tavily.com/search", json=body,
                                            headers={"Authorization": f"Bearer {self.key}"})
            except httpx.TimeoutException:
                code = "timeout"
            except httpx.HTTPError:
                code = "network_error"
            else:
                if response.status_code == 200:
                    try:
                        data = response.json()
                        items = data.get("results", [])
                        if not isinstance(items, list):
                            raise ValueError("invalid results")
                        candidates = [Candidate(title=str(item.get("title") or "")[:500], url=str(item["url"]),
                                                snippet=str(item.get("content") or "")[:4000],
                                                score=item.get("score"), published_at=parse_date(item.get("published_date")))
                                      for item in items if isinstance(item, dict) and item.get("url")]
                    except (ValueError, TypeError, KeyError):
                        return ProviderResult(errors=[SourceError(code="invalid_response", detail="Tavily response cannot be parsed")], coverage={"source": "tavily", "status": "error"})
                    return ProviderResult(candidates=candidates, coverage={"source": "tavily", "status": "ok", "matches": len(candidates)})
                code = {401: "authentication", 403: "authentication", 429: "rate_limit", 432: "quota_exhausted", 433: "quota_exhausted"}.get(response.status_code, "http_error")
                if response.status_code >= 500:
                    code = "server_error"
            if code not in ("timeout", "network_error", "rate_limit", "server_error") or attempt:
                break
            time.sleep(0.1)
        return ProviderResult(errors=[SourceError(code=code, detail=f"Tavily search failed: {code}")], coverage={"source": "tavily", "status": "error"})


class PageHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.publisher = None
        self.published_at = None
        self.canonical = None
        self.parts = []
        self.skip = 0
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("script", "style", "nav", "footer"):
            self.skip += 1
        if tag == "title":
            self.in_title = True
        if tag == "meta":
            key = (attrs.get("property") or attrs.get("name") or "").lower()
            value = attrs.get("content")
            if key in ("article:published_time", "datepublished", "pubdate", "date") and value:
                self.published_at = self.published_at or parse_date(value)
            if key in ("og:site_name", "application-name") and value:
                self.publisher = value
            if key == "og:title" and value:
                self.title = value
        if tag == "link" and attrs.get("rel", "").lower() == "canonical":
            self.canonical = attrs.get("href")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "nav", "footer") and self.skip:
            self.skip -= 1
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title and not self.title:
            self.title = data.strip()
        if not self.skip and not self.in_title and data.strip():
            self.parts.append(data.strip())


class FetchedPage(BaseModel):
    url: str
    title: str
    publisher: str | None = None
    published_at: datetime | None = None
    text: str = ""
    status: str = "full_text"


class DocumentFetcher(Protocol):
    def fetch(self, candidate: Candidate) -> FetchedPage: ...


class HTTPDocumentFetcher:
    def __init__(self, client: httpx.Client | None = None, *, resolver=socket.getaddrinfo):
        self.client = client or httpx.Client(timeout=TIMEOUT, follow_redirects=False, trust_env=False)
        self.resolver = resolver

    def fetch(self, candidate: Candidate) -> FetchedPage:
        url = canonical_url(candidate.url)
        if urlsplit(url).path.lower().endswith(".pdf"):
            return FetchedPage(url=url, title=candidate.title, status="unsupported_pdf")
        for attempt in range(2):
            try:
                current = url
                for _ in range(4):
                    public_url(current, resolver=self.resolver)
                    with self.client.stream("GET", current, headers={"User-Agent": USER_AGENT}) as response:
                        if response.status_code in (301, 302, 303, 307, 308):
                            current = canonical_url(urljoin(current, response.headers.get("location", "")))
                            continue
                        if response.status_code in (401, 403):
                            return FetchedPage(url=current, title=candidate.title, status="paywall")
                        response.raise_for_status()
                        content_type = response.headers.get("content-type", "").lower()
                        if "pdf" in content_type:
                            return FetchedPage(url=current, title=candidate.title, status="unsupported_pdf")
                        if "html" not in content_type:
                            return FetchedPage(url=current, title=candidate.title, status="unsupported_content")
                        chunks, size = [], 0
                        for chunk in response.iter_bytes():
                            size += len(chunk)
                            if size > MAX_BODY:
                                raise ValueError("body_too_large")
                            chunks.append(chunk)
                        parser = PageHTML()
                        parser.feed(b"".join(chunks).decode(response.encoding or "utf-8", errors="replace"))
                        text = re.sub(r"\s+", " ", " ".join(parser.parts)).strip()[:MAX_TEXT]
                        page_url = current
                        if parser.canonical:
                            proposed = canonical_url(urljoin(current, parser.canonical))
                            if urlsplit(proposed).hostname == urlsplit(current).hostname:
                                page_url = proposed
                        return FetchedPage(url=page_url, title=(parser.title or candidate.title)[:500],
                                           publisher=(parser.publisher or urlsplit(current).hostname),
                                           published_at=parser.published_at, text=text,
                                           status="full_text" if len(text) >= 100 else "excerpt_only")
                return FetchedPage(url=current, title=candidate.title, status="redirect_limit")
            except (httpx.TimeoutException, httpx.TransportError):
                if attempt == 0:
                    time.sleep(0.1)
                    continue
                return FetchedPage(url=url, title=candidate.title, status="fetch_failed")
            except (ValueError, httpx.HTTPStatusError) as exc:
                status = str(exc) if isinstance(exc, ValueError) else "fetch_failed"
                return FetchedPage(url=url, title=candidate.title, status=status)
        return FetchedPage(url=url, title=candidate.title, status="fetch_failed")


def normalize_evidence(candidate: Candidate, page: FetchedPage, source_kind: str,
                       retrieved_at: datetime) -> tuple[EvidenceRecord, str]:
    url = canonical_url(page.url)
    content = page.text if page.text and page.status in ("full_text", "excerpt_only") else candidate.snippet
    content = re.sub(r"\s+", " ", content).strip()[:MAX_TEXT]
    content_hash = digest(content)
    document_id = "web-" + digest(url)[:32]
    evidence_id = "ev-" + digest(url + ":" + content_hash)[:32]
    # Page metadata wins over search metadata; a search-only date remains unverified.
    published_at = page.published_at or candidate.published_at
    status = page.status if page.status in ("full_text", "excerpt_only", "paywall") else "fetch_failed"
    record = EvidenceRecord(evidence_id=evidence_id, document_id=document_id,
                            source_kind=source_kind, title=(page.title or candidate.title)[:500],
                            publisher=(page.publisher or candidate.publisher or urlsplit(url).hostname),
                            url=url, published_at=published_at, retrieved_at=retrieved_at,
                            excerpt=content[:4000], content_hash=content_hash,
                            page_number=None, date_status="known" if published_at else "unknown",
                            content_status=status)
    return record, content


class EvidenceStore(Protocol):
    def put(self, record: EvidenceRecord, text: str, *, topic: str = "") -> EvidenceRecord: ...
    def get(self, evidence_id: str) -> tuple[EvidenceRecord, str] | None: ...
    def search(self, query: str, *, start: datetime | None = None, end: datetime | None = None,
               publisher: str | None = None, limit: int = 8) -> list[tuple[EvidenceRecord, float]]: ...


class FileEvidenceStore:
    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.documents = self.root / "documents"
        self.documents.mkdir(exist_ok=True)
        self.registry = self.root / "sources.json"
        self.reprints = self.root / "reprints.json"

    def _items(self):
        for path in self.documents.glob("ev-*.json"):
            data = json.loads(path.read_text(encoding="utf-8"))
            yield EvidenceRecord.model_validate(data["record"]), data["text"]

    def put(self, record: EvidenceRecord, text: str, *, topic: str = "") -> EvidenceRecord:
        for existing, stored_text in self._items():
            if (existing.url == record.url and existing.content_hash == record.content_hash) or (existing.content_status == "full_text" and
                                              record.content_status == "full_text" and
                                              existing.content_hash == record.content_hash):
                if existing.url != record.url:
                    reprints = json.loads(self.reprints.read_text(encoding="utf-8")) if self.reprints.exists() else {}
                    reprints[record.url] = existing.evidence_id
                    self.reprints.write_text(json.dumps(reprints, ensure_ascii=False, indent=2), encoding="utf-8")
                return existing
        path = self.documents / f"{record.evidence_id}.json"
        if not path.exists():
            payload = {"record": record.model_dump(mode="json"), "text": text}
            path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        sources = json.loads(self.registry.read_text(encoding="utf-8")) if self.registry.exists() else {}
        host = urlsplit(record.url or "").hostname
        if host:
            entry = sources.setdefault(host, {"url": f"https://{host}/", "types": [], "topics": []})
            if record.source_kind not in entry["types"]:
                entry["types"].append(record.source_kind)
            if topic and topic not in entry["topics"]:
                entry["topics"].append(topic)
            self.registry.write_text(json.dumps(sources, ensure_ascii=False, indent=2), encoding="utf-8")
        return record

    def get(self, evidence_id: str) -> tuple[EvidenceRecord, str] | None:
        if not re.fullmatch(r"ev-[0-9a-f]{32}", evidence_id):
            return None
        path = self.documents / f"{evidence_id}.json"
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return EvidenceRecord.model_validate(data["record"]), data["text"]

    def search(self, query: str, *, start: datetime | None = None, end: datetime | None = None,
               publisher: str | None = None, limit: int = 8) -> list[tuple[EvidenceRecord, float]]:
        terms = re.findall(r"\w+", query.lower())
        if not terms:
            return []
        docs = [(record, Counter(re.findall(r"\w+", (record.title + " " + text).lower())))
                for record, text in self._items()
                if record.content_status == "full_text" and record.published_at and
                (start is None or record.published_at >= start) and
                (end is None or record.published_at <= end) and
                (publisher is None or (record.publisher or "").lower() == publisher.lower())]
        if not docs:
            return []
        avg_len = sum(sum(freq.values()) for _, freq in docs) / len(docs)
        result = []
        for record, freq in docs:
            score = 0.0
            length = sum(freq.values())
            for term in set(terms):
                df = sum(term in other for _, other in docs)
                count = freq[term]
                if count:
                    idf = math.log(1 + (len(docs) - df + 0.5) / (df + 0.5))
                    score += idf * count * 2.2 / (count + 1.2 * (0.25 + 0.75 * length / avg_len))
            if score:
                result.append((record, score))
        return sorted(result, key=lambda item: (-item[1], item[0].evidence_id))[:limit]


class WebSearchResult(BaseModel):
    candidates: list[Candidate] = Field(default_factory=list)
    evidence: list[EvidenceRecord] = Field(default_factory=list)
    errors: list[SourceError] = Field(default_factory=list)
    coverage: dict = Field(default_factory=dict)


def search_news(task: SearchTask, *, provider: NewsProvider, fetcher: DocumentFetcher,
                store: EvidenceStore, now: datetime | None = None) -> WebSearchResult:
    """Shared HTTP/pipeline entry point. Unknown dates are excluded unless explicitly opted in."""
    now = now or datetime.now(timezone.utc)
    found = provider.search(task)
    result = WebSearchResult(candidates=found.candidates, errors=found.errors,
                             coverage={**found.coverage, "retrieved": 0, "excluded_unknown_date": 0,
                                       "excluded_future": 0, "fetch_failures": 0, "unsupported_pdf": 0,
                                       "date_from_search_only": 0, "paywalls": 0})
    if found.errors:
        return result
    as_of = parse_date(task.filters.get("as_of")) or now
    start = parse_date(task.filters.get("start"))
    end = parse_date(task.filters.get("end")) or as_of
    for candidate in found.candidates:
        try:
            page = fetcher.fetch(candidate)
            if page.status == "unsupported_pdf":
                result.coverage["unsupported_pdf"] += 1
                continue
            if page.status in ("blocked_address", "unresolvable_address", "unsupported_url", "redirect_limit"):
                result.errors.append(SourceError(code=page.status, detail="Document URL could not be fetched safely"))
                continue
            record, text = normalize_evidence(candidate, page, task.source_kind, now)
            if page.published_at is None and candidate.published_at is not None:
                result.coverage["date_from_search_only"] += 1
            if record.published_at is None and not task.filters.get("allow_unknown_dates", False):
                result.coverage["excluded_unknown_date"] += 1
                continue
            if record.published_at and (record.published_at > as_of or record.published_at > end):
                result.coverage["excluded_future"] += 1
                continue
            if start and record.published_at and record.published_at < start:
                result.coverage.setdefault("excluded_before_start", 0)
                result.coverage["excluded_before_start"] += 1
                continue
            if record.content_status == "fetch_failed":
                result.coverage["fetch_failures"] += 1
            if record.content_status == "paywall":
                result.coverage["paywalls"] += 1
            saved = store.put(record, text, topic=task.question)
            if saved.evidence_id not in {item.evidence_id for item in result.evidence}:
                result.evidence.append(saved)
                result.coverage["retrieved"] += 1
        except ValueError as exc:
            result.errors.append(SourceError(code="candidate_error", detail=str(exc)[:100]))
    return result
