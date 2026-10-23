import re
from rank_bm25 import BM25Okapi

_TOKEN_RE = re.compile(r"[0-9A-Za-zА-Яа-яЁё]+", re.UNICODE)

def tokenize(text: str) -> list[str]:
    return [word.casefold().replace("ё", "е") for word in _TOKEN_RE.findall(text)]

class DocumentSearch:
    def __init__(self, chunks: list[dict] | None = None):
        self.chunks = []
        self._bm25 = None
        self.replace_chunks(chunks or [])

    def replace_chunks(self, chunks: list[dict]) -> None:
        self.chunks = list(chunks)
        tokenized = [tokenize(chunk.get("text", "")) for chunk in self.chunks]
        self._bm25 = BM25Okapi(tokenized) if any(tokenized) else None

    def search(self, question: str, top_k: int = 5) -> list[dict]:
        tokens = tokenize(question)
        if not tokens or not self.chunks or self._bm25 is None:
            return []
        scores = self._bm25.get_scores(tokens)
        ranked = sorted(enumerate(scores), key=lambda pair: pair[1], reverse=True)
        results = []
        for index, score in ranked:
            if len(results) >= top_k:
                break
            if score <= 0:
                continue
            chunk = self.chunks[index]
            results.append({
                "text": chunk["text"], "source": chunk["source"],
                "page_start": chunk["page_start"], "page_end": chunk["page_end"],
                "extraction_method": chunk.get("extraction_method", "text"),
                "score": float(score),
            })
        return results
