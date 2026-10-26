# Supabase-backed PDF tool

This module is integrated into the existing ML service (`ml.src.service:app`).
It is not a separate analysis server. Setup, data flow, limitations and API:
[Bank PDF integration](../docs/BANK_PDF_INTEGRATION.md).

The shared root `.env` needs SUPABASE_URL, SUPABASE_SERVICE_KEY and optionally
SUPABASE_STORAGE_BUCKET (default reference-pdfs). The bucket is the source of
PDF files; document_chunks + match_document_chunks provide pgvector retrieval.
SQL setup: [supabase_schema.sql](supabase_schema.sql). Never run schema/index
writes automatically during a normal company-analysis request.

Protected tools on the existing ML port: POST /internal/documents/search,
POST /internal/documents/sync, POST /internal/documents/upload. All require the
same ML_SERVICE_TOKEN as analysis. Indexing is explicit; no startup sync or
local corpus fallback. e5-small produces 384-dimensional vectors. Missing
publication metadata remains unknown, not inferred from a document title.
