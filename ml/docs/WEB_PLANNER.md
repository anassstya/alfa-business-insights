# Веб-планировщик: итерация 5

Запуск HTTP-сервиса из корня репозитория:

```powershell
python -m uvicorn ml.src.service:app --host 127.0.0.1 --port 8001
```

Отправить один `AnalysisRequest` на `POST /internal/research` с заголовком
`Authorization: Bearer <ML_SERVICE_TOKEN>`. Тело имеет ту же форму, что
`ml/docs/fixture_request.json`, но `company_id` должен быть реальным строковым
`synthetic_u`, а `company_row_id` — соответствующим числовым `companies.id`.
Например, после подстановки собственной проверенной пары ID:

```powershell
$body = Get-Content ml/docs/fixture_request.json -Raw
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8001/internal/research -Headers @{Authorization="Bearer $env:ML_SERVICE_TOKEN"} -ContentType 'application/json' -Body $body
```

Файл примера содержит искусственную пару ID, поэтому для Supabase её нужно
заменить. Ручка читает профиль из Supabase в read-only транзакции и возвращает
`CompanyResearchContext`; запись в БД отсутствует. `MODEL_API_KEY`, `ML_MODEL`
(по умолчанию `deepseek/deepseek-v4.1-flash`), `TAVILY_API` и параметры Supabase
читаются из окружения или существующего корневого `.env`. `ML_MODEL_TIMEOUT`
задаёт timeout одного LLM-вызова. Нативный JSON Schema отключён, пока его
поддержка шлюзом не подтверждена; только тогда можно включить
`ML_NATIVE_SCHEMA_CONFIRMED=true`.

Один запуск ограничен 120 секундами, 3 LLM-попытками, резервом 18 000 входных и
6 000 выходных токенов, 6 поисковыми задачами и 6 вызовами инструмента. Резерв
не равен фактическому usage: ответ шлюза учитывается отдельно. Денежная оценка
не вычисляется без подтверждённого тарифа; локальный счётчик не обеспечивает
общий лимит команды. При timeout или отмене между внешними вызовами работа
останавливается; уже начатый синхронный HTTP-вызов ограничивается timeout
клиента, поэтому deadline может быть немного превышен.

Planner получает только безопасную компактную часть профиля, exposures, роль,
цель, дату и пробелы. ID компаний и физлиц, исходные платежи и имена
контрагентов в поисковый запрос не попадают. Код валидирует `source_kind`,
окно дат, фильтры и текст, удаляет дубли и назначает ID задач. Новости —
непроверенный контент: их инструкции не становятся командами модели или кода.
При сбое Planner `coverage.planner=fallback` и `fallback_reason` объясняют
шаблонный план. Сбои поиска попадают в `source_errors` и `gaps`, без фиктивных
evidence. `bank_research` пока зарезервирован и не выполняется.

Проверка без внешних запросов:

```powershell
python -m unittest discover -s ml/tests -v
```
