import hashlib
import json
import os
import tempfile
from pathlib import Path

import fitz
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from .config import CHUNKS_PATH, MAX_UPLOAD_BYTES, PDF_DIR, PROCESSED_DIR
from .prepare import process_pdf
from .search import DocumentSearch

app = FastAPI(title="Document Search API", description="PDF retrieval with BM25; no embedding model.", version="1.0.0")
PDF_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

def _load_chunks() -> list[dict]:
    if not CHUNKS_PATH.exists():
        return []
    chunks = []
    with CHUNKS_PATH.open("r", encoding="utf-8") as file:
        for line_no, line in enumerate(file, 1):
            if line.strip():
                try:
                    chunks.append(json.loads(line))
                except json.JSONDecodeError as exc:
                    raise RuntimeError(f"Invalid JSON in index at line {line_no}") from exc
    return chunks

def _save_chunks(chunks: list[dict]) -> None:
    CHUNKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=CHUNKS_PATH.parent, delete=False, suffix=".tmp") as tmp:
        for chunk in chunks:
            tmp.write(json.dumps(chunk, ensure_ascii=False) + "\n")
        temporary_path = Path(tmp.name)
    os.replace(temporary_path, CHUNKS_PATH)

search_engine = DocumentSearch(_load_chunks())

class SearchRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)

@app.get("/health")
def health():
    return {"status": "ok", "service": "document-search", "indexed_chunks": len(search_engine.chunks), "search_method": "BM25"}

@app.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    filename = Path(file.filename or "document.pdf").name
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="PDF exceeds the 50 MB limit.")
    try:
        with fitz.open(stream=content, filetype="pdf") as document:
            if document.page_count == 0:
                raise HTTPException(status_code=400, detail="PDF has no pages.")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="File is not a valid PDF.") from exc

    document_id = hashlib.sha256(content).hexdigest()
    if any(c.get("document_id") == document_id for c in search_engine.chunks):
        return {"status": "already_indexed", "document_id": document_id, "filename": filename, "chunks_added": 0}

    stored_path = PDF_DIR / f"{document_id}.pdf"
    stored_path.write_bytes(content)
    try:
        new_chunks = process_pdf(stored_path, document_id=document_id)
        if not new_chunks:
            stored_path.unlink(missing_ok=True)
            raise HTTPException(status_code=422, detail="No readable text was extracted from this PDF.")
        for chunk in new_chunks:
            chunk["source"] = filename
        combined = search_engine.chunks + new_chunks
        _save_chunks(combined)
        search_engine.replace_chunks(combined)
    except HTTPException:
        raise
    except Exception as exc:
        stored_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {type(exc).__name__}") from exc
    return {"status": "indexed", "document_id": document_id, "filename": filename, "pages": len({c["page_start"] for c in new_chunks}), "chunks_added": len(new_chunks), "search_method": "BM25"}

@app.post("/documents/search")
def search_documents(request: SearchRequest):
    results = search_engine.search(request.question, request.top_k)
    return {"question": request.question, "count": len(results), "search_method": "BM25", "results": results}
