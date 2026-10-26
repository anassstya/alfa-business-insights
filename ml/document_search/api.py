"""Protected PDF tools mounted into the existing ML app; no second analysis API."""
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from ml.src.bank_research import document_store
from .config import MAX_UPLOAD_BYTES, EMBEDDING_MODEL


class SearchRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)


def create_document_router(authorize):
    router = APIRouter(prefix='/internal/documents', dependencies=[Depends(authorize)])

    @router.post('/search')
    def search_documents(request: SearchRequest):
        try:
            results = document_store().search(request.question, request.top_k)
            return {'question': request.question, 'count': len(results),
                    'search_method': 'supabase_pgvector', 'embedding_model': EMBEDDING_MODEL,
                    'results': results}
        except Exception as exc:
            raise HTTPException(503, detail={'code': 'pdf_search_unavailable',
                                'error_type': type(exc).__name__}) from exc

    @router.post('/sync')
    def sync_documents():
        # Explicit administrative operation, not part of startup or an analysis request.
        try:
            return document_store().sync_storage()
        except Exception as exc:
            raise HTTPException(503, detail={'code': 'pdf_index_unavailable',
                                'error_type': type(exc).__name__}) from exc

    @router.post('/upload')
    def upload_document(file: UploadFile = File(...)):
        filename = Path((file.filename or 'document.pdf').replace('\\', '/')).name
        content = file.file.read(MAX_UPLOAD_BYTES + 1)
        if not filename.lower().endswith('.pdf') or not content:
            raise HTTPException(400, detail='A nonempty PDF is required')
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, detail='PDF exceeds 50 MiB')
        try:
            import pymupdf
            with pymupdf.open(stream=content, filetype='pdf') as pdf:
                if pdf.page_count == 0:
                    raise ValueError('empty PDF')
        except Exception as exc:
            raise HTTPException(400, detail='Invalid PDF') from exc
        try:
            chunks, document_id = document_store().index_uploaded_pdf(filename, content)
            return {'status': 'indexed', 'document_id': document_id, 'filename': filename,
                    'chunks_added': len(chunks), 'storage': 'supabase'}
        except ValueError as exc:
            raise HTTPException(422, detail='No readable PDF text') from exc
        except Exception as exc:
            raise HTTPException(503, detail={'code': 'pdf_index_unavailable',
                                'error_type': type(exc).__name__}) from exc

    return router
