# Веб-исследование: итерация 4

`POST /internal/news/search` принимает существующий `SearchTask` v1.
Python pipeline вызывает `search_news(task, provider=..., fetcher=..., store=...)`
напрямую. Ответ содержит `candidates` (метаданные и сниппеты Tavily),
`evidence` (`EvidenceRecord` с ID), `errors` и `coverage`. Статус
`coverage.status=ok` с пустым массивом означает ноль совпадений;
`status=error` и код ошибки означают сбой источника. Ручки требуют тот же
`ML_SERVICE_TOKEN`, что и `/internal/analyze`.

```powershell
$env:ML_SERVICE_TOKEN = '<уже настроенный токен>'
python -m uvicorn ml.src.service:app --host 127.0.0.1 --port 8001
```

Пример тела запроса (передавать с `Authorization: Bearer <ML_SERVICE_TOKEN>`):

```json
{"schema_version":"1.0","task_id":"steel-2026-10","exposure_ids":[],"question":"Изменились ли тарифы на металл?","query":"официальные тарифы металл Россия","source_kind":"news","filters":{"start":"2026-10-01T00:00:00+03:00","end":"2026-10-25T00:00:00+03:00","as_of":"2026-10-25T00:00:00+03:00"},"priority":50,"reason":"Проверка отраслевого фактора","expected_evidence":"Публикация с датой и текстом","max_results":3}
```

Текст разрешается через `GET /internal/evidence/{evidence_id}`. Поиск в
локальном корпусе: `FileEvidenceStore(cache_path).search("тариф", start=...,
end=..., publisher=...)`. Кэш по умолчанию в `ml/.cache/web/`, его можно
перенести через `ML_EVIDENCE_CACHE`. Исходные профили продолжают читаться из
Supabase. Реестр `sources.json` хранит домен, URL, тип и темы источника.
Записи документов лежат отдельно с полным прочитанным текстом.

Tavily получает `TAVILY_API` из окружения или корневого `.env` и выполняет
один ограниченный поиск с `include_answer=false` и без raw content.
Сниппет выдачи остаётся кандидатом. HTML parser отдельно получает текст и
метаданные. `published_at` страницы имеет приоритет над датой Tavily;
если дата есть только в выдаче, `coverage.date_from_search_only` показывает
число непроверенных дат. `retrieved_at` — время обращения. Записи без даты
исключаются по умолчанию; `filters.allow_unknown_dates=true` включает их
явно. Записи после `as_of` и вне окна исключаются. PDF, включая PDF по
Content-Type, пропускается. HTTP 401/403 страницы даёт
`content_status=paywall`, остальные сбои чтения — `fetch_failed`; для них сохраняется только поисковый
фрагмент, если дата проходит фильтр. `content_status=excerpt_only` также
означает, что полного текста нет. Ни один такой фрагмент не достраивается
моделью. Кэш дедуплицирует канонические URL и совпадающий хэш полного текста,
в том числе явные перепечатки с одинаковым текстом; URL перепечаток и их
основной evidence ID записываются в `reprints.json`.

Проверка без внешних запросов:

```powershell
python -m unittest ml.tests.test_web_research ml.tests.test_service -v
```

Ограничения: это небольшой локальный корпус, синхронный fetcher и простой
HTML parser. Динамически сформированные страницы могут дать неполный текст.
Поиск не анализирует PDF и не вызывает LLM. `bank_research` в контракте
зарезервирован до промпта 7. Полный веб-проход и генерация инсайтов относятся
к следующим итерациям.
