# Supabase-backed PDF document search

The ML service reads PDF files from the Supabase Storage bucket and stores searchable text chunks and 384-dimensional multilingual-e5-small vectors in `public.document_chunks`.

## Required environment variables

Set these in the root `.env` (do not commit or share the file):

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=YOUR_SERVER_SIDE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=reference-pdfs
```

The Compose ML service already passes these variables to the container. Keep the service key server-side only.

## Supabase setup

The `document_chunks` table and `match_document_chunks` RPC function should already exist. The full repeatable SQL is in `ml/document_search/supabase_schema.sql`. Run it in Supabase SQL Editor if you need to recreate the schema/function.

## Start and verify

From the repository root:

```bash
docker compose up -d --build ml
docker compose logs -f ml
```

On first startup, the service lists PDFs in the configured Storage bucket, downloads documents not yet indexed, extracts page text (OCR fallback), creates embeddings, and upserts chunks into Supabase. It then loads indexed chunks for the existing analysis pipeline. Later startups skip documents whose content hash is already in the table.

Check service status:

```bash
curl http://localhost:8000/health
```

Search:

```bash
curl -X POST http://localhost:8000/documents/search ^
  -H "Content-Type: application/json" ^
  -d "{\"question\":\"Какие факторы влияют на инфляцию?\",\"top_k\":5}"
```

Each result includes `source`, `page_start`, `page_end`, `extraction_method`, and a vector similarity score.

Upload a PDF through `POST /documents/upload` (multipart field name `file`). When Supabase is configured, the file is uploaded to the Storage bucket and indexed in Supabase.

## Notes

- Vectors are generated with `intfloat/multilingual-e5-small`, which has 384 dimensions. Do not change the model without rebuilding the index.
- Existing table rows are not deleted automatically. Replacing a file with changed contents creates a new `document_id`; old chunks remain until explicitly cleaned up.
- The API currently uses Supabase vector similarity for document search. BM25 remains available as the local fallback when Supabase credentials are absent.
