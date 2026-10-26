# ML: поиск по PDF и анализ компании

## Архитектура

Supabase — единственный постоянный источник данных для поиска по PDF:

- исходные PDF находятся в Storage bucket `reference-pdfs`;
- очищенные текстовые фрагменты, метаданные источника и embeddings находятся в таблице `public.document_chunks`;
- поиск выполняется функцией `public.match_document_chunks` с помощью pgvector.

При старте ML-контейнер подключается к Supabase и индексирует только новые документы (если `SUPABASE_REINDEX_PDFS=false`). При обработке нового PDF файл временно записывается в `/tmp` внутри контейнера для OCR, после чего временный файл удаляется

Модель `intfloat/multilingual-e5-small` загружается с Hugging Face. Docker volume `model_cache` хранит только файлы модели

## Запуск

Из корня репозитория:

```bash
docker compose up -d --build ml
docker compose logs -f ml
```

В корневом `.env` должны быть заданы:

- `SUPABASE_URL` — URL проекта Supabase;
- `SUPABASE_SERVICE_KEY` — серверный service-role ключ; не публикуйте его и не коммитьте `.env`;
- `SUPABASE_STORAGE_BUCKET=reference-pdfs`;
- `SUPABASE_REINDEX_PDFS=false` — не переиндексировать все PDF при каждом запуске;
- `MODEL_API_KEY` — ключ API модели, используемой для генерации инсайтов;
- `DATABASE_URL` — строка подключения к PostgreSQL/Supabase, используемая backend и инструментами анализа;
- `BACKEND_EVENTS_URL` — по умолчанию `http://backend:8080/api/v1/internal/analysis/events`;
- `MODEL_NAME` — модель для анализа, по умолчанию `deepseek/deepseek-v4.1-flash`.

PDF нужно загружать в Supabase Storage bucket `reference-pdfs`, а не копировать в репозиторий. Для добавления PDF через API используйте `POST /documents/upload` с multipart-полем `file`; файл будет сохранён в Supabase Storage и проиндексирован в `document_chunks`.

## Проверка поиска

Проверка состояния:

`GET http://localhost:8000/health`

Поиск:

`POST http://localhost:8000/documents/search`

```json
{"question":"Какие риски связаны со снижением спроса?","top_k":5}
```

## Запуск анализа

`POST /analysis/jobs` принимает задачу и возвращает `202 Accepted`:

```json
{"job_id":"<uuid от бэкенда>","company_id":"U_14366","role":"cfo"}
```

Результаты поиска для анализа также извлекаются непосредственно из Supabase. Прогресс и результат отправляются на `BACKEND_EVENTS_URL`. Сейчас фоновые задачи выполняются через FastAPI `BackgroundTasks` и не восстанавливаются после перезапуска контейнера.

## Схема Supabase

В `public.document_chunks` должны быть поля `chunk_id`, `document_id`, `source`, `page_start`, `page_end`, `chunk_index`, `extraction_method`, `content`, `embedding`, `created_at`; `embedding` должен иметь размерность 384. RPC-функция `public.match_document_chunks(query_embedding, match_count)` должна возвращать текст, источник, страницы и similarity.
