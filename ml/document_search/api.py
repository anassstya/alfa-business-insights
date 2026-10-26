import hashlib
from pathlib import Path

import pymupdf as fitz
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from .config import MAX_UPLOAD_BYTES, EMBEDDING_MODEL
from .supabase_store import SupabaseDocumentStore
from analysis_service import VALID_ROLES, run_analysis

app = FastAPI(
    title="Document Search API",
    description="PDF retrieval using Supabase Storage and pgvector as the source of truth.",
    version="1.2.0",
)

supabase_store: SupabaseDocumentStore | None = None
supabase_sync_status: dict = {"status": "not_started"}


@app.on_event("startup")
def connect_supabase() -> None:
    """Connect to the authoritative remote store; never fall back to local document data."""
    global supabase_store, supabase_sync_status
    try:
        store = SupabaseDocumentStore()
        result = store.sync_storage()
        supabase_store = store
        supabase_sync_status = {key: value for key, value in result.items() if key != "chunks"}
        print(
            f"Supabase index ready: {result['indexed_chunks']} chunks; "
            f"{result['documents_added']} new PDFs indexed."
        )
        if result.get("failures"):
            print(f"WARNING: some Supabase PDFs could not be indexed: {result['failures']}")
    except Exception as exc:
        supabase_store = None
        supabase_sync_status = {"status": "error", "error": f"{type(exc).__name__}: {exc}"}
        print(f"ERROR: Supabase connection/index initialization failed: {type(exc).__name__}: {exc}")


def _require_store() -> SupabaseDocumentStore:
    if supabase_store is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase document storage is unavailable. Local document fallback is disabled.",
        )
    return supabase_store


class SearchRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)


@app.get("/health")
def health():
    status = dict(supabase_sync_status)
    return {
        "status": "ok" if status.get("status") == "ok" else "error",
        "service": "document-search",
        "indexed_chunks": status.get("indexed_chunks", 0),
        "search_method": "supabase_pgvector",
        "embedding_model": EMBEDDING_MODEL,
        "supabase": status,
    }


@app.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    store = _require_store()
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
    if store.document_exists(document_id):
        return {
            "status": "already_indexed",
            "document_id": document_id,
            "filename": filename,
            "chunks_added": 0,
            "storage": "supabase",
        }
    try:
        new_chunks, document_id = store.index_uploaded_pdf(filename, content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {type(exc).__name__}") from exc
    return {
        "status": "indexed",
        "document_id": document_id,
        "filename": filename,
        "pages": len({chunk["page_start"] for chunk in new_chunks}),
        "chunks_added": len(new_chunks),
        "storage": "supabase",
        "search_method": "supabase_pgvector",
        "embedding_model": EMBEDDING_MODEL,
    }


@app.post("/documents/search")
def search_documents(request: SearchRequest):
    store = _require_store()
    try:
        results = store.search(request.question, request.top_k)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Document search failed: {type(exc).__name__}") from exc
    return {
        "question": request.question,
        "count": len(results),
        "search_method": "supabase_pgvector",
        "embedding_model": EMBEDDING_MODEL,
        "results": results,
    }


class AnalysisRequest(BaseModel):
    job_id: str = Field(min_length=1, max_length=128)
    company_id: str = Field(min_length=1, max_length=128)
    role: str = Field(min_length=1, max_length=64)


@app.post("/analysis/jobs", status_code=202)
def start_analysis(request: AnalysisRequest, background_tasks: BackgroundTasks):
    store = _require_store()
    role = request.role.strip().lower()
    if role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail={
            "message": "Unsupported role", "allowed_roles": sorted(VALID_ROLES)
        })
    background_tasks.add_task(
        run_analysis, request.job_id, request.company_id.strip(), role, store
    )
    return {"job_id": request.job_id, "status": "accepted"}
