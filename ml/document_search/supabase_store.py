"""Supabase Storage and pgvector persistence for PDF document search."""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Any

import httpx
import numpy as np
from sentence_transformers import SentenceTransformer

from .config import EMBEDDING_MODEL
from .prepare import process_pdf

class SupabaseDocumentStore:
    def __init__(self) -> None:
        self.url = os.getenv("SUPABASE_URL", "").rstrip("/")
        self.key = os.getenv("SUPABASE_SERVICE_KEY", "")
        self.bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "reference-pdfs")
        self.table = "document_chunks"
        self._model: SentenceTransformer | None = None
        if not self.url or not self.key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be configured.")

    @property
    def headers(self) -> dict[str, str]:
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
        }

    def _client(self) -> httpx.Client:
        return httpx.Client(timeout=httpx.Timeout(120.0, connect=20.0), headers=self.headers)

    def _get_model(self) -> SentenceTransformer:
        if self._model is None:
            self._model = SentenceTransformer(EMBEDDING_MODEL)
        return self._model

    def _embed_passages(self, texts: list[str]) -> np.ndarray:
        return np.asarray(
            self._get_model().encode(
                ["passage: " + text for text in texts],
                normalize_embeddings=True,
                batch_size=32,
                show_progress_bar=False,
            ),
            dtype=np.float32,
        )

    def _embed_query(self, question: str) -> list[float]:
        vector = self._get_model().encode(
            ["query: " + question],
            normalize_embeddings=True,
            show_progress_bar=False,
        )[0]
        return np.asarray(vector, dtype=np.float32).tolist()

    def list_storage_pdfs(self) -> list[dict[str, Any]]:
        objects: list[dict[str, Any]] = []
        with self._client() as client:
            offset = 0
            while True:
                response = client.post(
                    f"{self.url}/storage/v1/object/list/{self.bucket}",
                    json={"prefix": "", "limit": 100, "offset": offset},
                )
                response.raise_for_status()
                page = response.json()
                if not page:
                    break
                objects.extend(
                    item for item in page
                    if item.get("name", "").lower().endswith(".pdf")
                )
                if len(page) < 100:
                    break
                offset += len(page)
        return objects

    def download_pdf(self, object_name: str) -> bytes:
        # Quote each path segment while preserving folder separators.
        from urllib.parse import quote
        object_path = "/".join(quote(part, safe="") for part in object_name.split("/"))
        with self._client() as client:
            response = client.get(
                f"{self.url}/storage/v1/object/{self.bucket}/{object_path}"
            )
            response.raise_for_status()
            return response.content

    def upload_pdf(self, object_name: str, content: bytes) -> None:
        from urllib.parse import quote
        object_path = "/".join(quote(part, safe="") for part in object_name.split("/"))
        headers = {**self.headers, "Content-Type": "application/pdf", "x-upsert": "true"}
        with httpx.Client(timeout=120.0, headers=headers) as client:
            response = client.post(
                f"{self.url}/storage/v1/object/{self.bucket}/{object_path}",
                content=content,
            )
            response.raise_for_status()

    def _fetch_all_chunks(self) -> list[dict]:
        fields = "chunk_id,document_id,source,page_start,page_end,chunk_index,extraction_method,content"
        rows: list[dict] = []
        with self._client() as client:
            offset = 0
            while True:
                response = client.get(
                    f"{self.url}/rest/v1/{self.table}",
                    params={"select": fields, "order": "chunk_id.asc", "limit": 1000, "offset": offset},
                )
                response.raise_for_status()
                page = response.json()
                rows.extend(page)
                if len(page) < 1000:
                    break
                offset += len(page)
        return [
            {**row, "text": row.pop("content")}
            for row in rows
        ]

    def _existing_document_ids(self) -> set[str]:
        return {str(row["document_id"]) for row in self._fetch_all_chunks()}

    def document_exists(self, document_id: str) -> bool:
        with self._client() as client:
            response = client.get(
                f"{self.url}/rest/v1/{self.table}",
                params={"select": "chunk_id", "document_id": f"eq.{document_id}", "limit": 1},
            )
            response.raise_for_status()
            return bool(response.json())

    def _upsert_chunks(self, chunks: list[dict]) -> None:
        if not chunks:
            return
        vectors = self._embed_passages([str(chunk["text"]) for chunk in chunks])
        rows = []
        for chunk, vector in zip(chunks, vectors):
            rows.append({
                "chunk_id": chunk["chunk_id"],
                "document_id": chunk["document_id"],
                "source": chunk["source"],
                "page_start": chunk["page_start"],
                "page_end": chunk["page_end"],
                "chunk_index": chunk["chunk_index"],
                "extraction_method": chunk.get("extraction_method", "text"),
                "content": chunk["text"],
                # PostgREST casts this pgvector input representation to extensions.vector.
                "embedding": "[" + ",".join(f"{float(value):.8f}" for value in vector) + "]",
            })
        with self._client() as client:
            for start in range(0, len(rows), 25):
                response = client.post(
                    f"{self.url}/rest/v1/{self.table}",
                    params={"on_conflict": "chunk_id"},
                    headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
                    json=rows[start:start + 25],
                )
                response.raise_for_status()

    def _delete_source_chunks(self, source: str) -> None:
        """Delete only rows belonging to this exact Storage PDF, not the whole table."""
        with self._client() as client:
            response = client.delete(
                f"{self.url}/rest/v1/{self.table}",
                params={"source": f"eq.{source}"},
                headers={"Prefer": "return=minimal"},
            )
            response.raise_for_status()

    def sync_storage(self) -> dict:
        objects = self.list_storage_pdfs()
        existing = self._existing_document_ids()
        reindex = os.getenv("SUPABASE_REINDEX_PDFS", "false").strip().lower() in {"1", "true", "yes"}
        added_documents = 0
        added_chunks = 0
        reindexed_documents = 0
        failures = []
        for item in objects:
            name = item.get("name", "")
            if not name.lower().endswith(".pdf"):
                continue
            try:
                content = self.download_pdf(name)
                document_id = hashlib.sha256(content).hexdigest()
                if document_id in existing and not reindex:
                    continue
                temp_path = Path("/tmp") / f"supabase-{document_id}.pdf"
                temp_path.write_bytes(content)
                try:
                    chunks = process_pdf(temp_path, document_id=document_id)
                finally:
                    temp_path.unlink(missing_ok=True)
                if not chunks:
                    failures.append({"source": name, "error": "No readable text extracted"})
                    continue
                for chunk in chunks:
                    chunk["source"] = name
                # Only replace rows after the new extraction succeeded and produced chunks.
                # Delete by exact source so obsolete chunks from the same PDF cannot remain.
                if reindex:
                    self._delete_source_chunks(name)
                    reindexed_documents += 1
                self._upsert_chunks(chunks)
                existing.add(document_id)
                added_documents += 1
                added_chunks += len(chunks)
                action = "Reindexed" if reindex else "Indexed"
                print(f"{action} Supabase PDF: {name} ({len(chunks)} chunks)")
            except Exception as exc:
                failures.append({"source": name, "error": f"{type(exc).__name__}: {exc}"})
                print(f"WARNING: Supabase PDF indexing failed for {name}: {type(exc).__name__}: {exc}")
        all_chunks = self._fetch_all_chunks()
        return {
            "status": "ok" if not failures else "degraded",
            "storage_pdfs": len(objects),
            "documents_added": added_documents,
            "documents_reindexed": reindexed_documents,
            "reindex_enabled": reindex,
            "chunks_added": added_chunks,
            "indexed_chunks": len(all_chunks),
            "failures": failures,
        }


    def index_uploaded_pdf(self, filename: str, content: bytes) -> tuple[list[dict], str]:
        document_id = hashlib.sha256(content).hexdigest()
        object_name = filename
        temp_path = Path("/tmp") / f"supabase-{document_id}.pdf"
        temp_path.write_bytes(content)
        try:
            chunks = process_pdf(temp_path, document_id=document_id)
        finally:
            temp_path.unlink(missing_ok=True)
        if not chunks:
            raise ValueError("No readable text was extracted from this PDF.")
        for chunk in chunks:
            chunk["source"] = filename
        self.upload_pdf(object_name, content)
        self._delete_source_chunks(filename)
        self._upsert_chunks(chunks)
        return chunks, document_id

    def search(self, question: str, top_k: int = 5) -> list[dict]:
        vector = self._embed_query(question)
        vector_literal = "[" + ",".join(f"{value:.8f}" for value in vector) + "]"
        with self._client() as client:
            response = client.post(
                f"{self.url}/rest/v1/rpc/match_document_chunks",
                json={"query_embedding": vector_literal, "match_count": top_k},
            )
            response.raise_for_status()
            rows = response.json()
        results = []
        for row in rows:
            results.append({
                "text": row["content"],
                "source": row["source"],
                "page_start": row["page_start"],
                "page_end": row["page_end"],
                "extraction_method": row.get("extraction_method") or "text",
                "score": float(row["similarity"]),
                "semantic_score": float(row["similarity"]),
                "bm25_score": 0.0,
            })
        return results
