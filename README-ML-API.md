# ML document-search service

The service extracts text from PDFs, uses Tesseract OCR as a fallback for scanned pages, splits text into page-aware chunks, and ranks results with BM25.

This implementation does **not** use `multilingual-e5-small`, embedding vectors, `embeddings.npy`, or any additional language model.

## Endpoints

- `GET /health` — service status and indexed chunk count.
- `POST /documents/upload` — upload one PDF as multipart field `file`.
- `POST /documents/search` — JSON body, for example `{"question":"выручка компании","top_k":5}`.

Search results include text, source filename, page numbers, extraction method, and BM25 score.

## Docker Compose

Run from the repository root:

```bash
docker compose up -d --build ml
docker compose ps
docker compose logs -f ml
```

Open `http://localhost:8000/docs` for interactive API docs or `http://localhost:8000/health` for health status.

The service starts with an empty index. PDFs and the JSONL index persist in `/app/data` through the `ml_data` volume.

## Notes

- Maximum upload size is 50 MB.
- BM25 is lexical search, not semantic search; synonyms and very different formulations may match less well.
- OCR requires the Tesseract language packs included in the image.
- This service retrieves evidence fragments; it does not generate LLM answers and does not replace `ml/api.py`.
