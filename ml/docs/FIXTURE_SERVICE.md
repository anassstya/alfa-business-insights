# Fixture milestone: внутренний ML-сервис

Из корня репозитория установите `python -m pip install -r ml/requirements.txt`.
Для текущего шага явно установите `ML_FIXTURE_MODE=true` и `ML_SERVICE_TOKEN`
в окружении процесса. Затем запустите `python -m uvicorn ml.src.service:app
--host 127.0.0.1 --port 8000`. `GET /health` сообщает о процессе и режиме.
`POST /internal/analyze` требует `Authorization: Bearer <ML_SERVICE_TOKEN>`.
Без токена запрос получает 401. Альтернатива только для локальной разработки:
явно включить `ML_LOCAL_DEV_MODE=true`; пропуск токена разрешается лишь клиенту
с loopback-адресом. При включённом fixture режиме процесс использует только
`ml/fixtures/company_profiles.json`; соответствие `U_EXAMPLE` и числового ID 123
существует только в этой демонстрации. Без `ML_FIXTURE_MODE=true` анализ
возвращает 503: live pipeline появится в следующих итерациях.

Пример запроса: [fixture_request.json](fixture_request.json). Ответ в
[fixture_response.json](fixture_response.json) получен тем же pipeline; реальные
`run_id` и временные метки событий меняются при каждом запуске. Все данные
evidence и insight являются гипотетическим сценарием. `source_kind=fixture`,
`mode=fixture`, предупреждение и `bank_view.status=unavailable` обязательны.
`outcome=ok` означает успешное прохождение демонстрационного сценария, а не
подтверждение реального события. PDF банка и внешний поиск не используются.

CLI запускает ту же функцию и пишет `StageEvent` в stderr, результат в stdout:

```powershell
$env:ML_FIXTURE_MODE='true'
python -m ml.src.analyze_cli ml/docs/fixture_request.json
```

В [mock_backend_consumer.py](mock_backend_consumer.py) показан вызов HTTP и
локальные переходы `pending -> running -> completed/failed`. Запуск:
`python -m ml.docs.mock_backend_consumer`. Это память процесса, не запись в БД.
Синхронный HTTP возвращает только полный `AnalysisResult`. Промежуточные события
передаются в `on_event` и CLI; потоковый HTTP предусмотрен следующими шагами.

Граница интеграции: бэкенд аутентифицирует конечного пользователя, проверяет его
право на числовой `companies.id`, разрешает `synthetic_u`, создаёт
`analysis_jobs.id` и посылает оба ID в ML. После вызова бэкенд своим соединением
сохраняет **весь** JSON-результат в `analysis_jobs.result`, обновляет `updated_at`
и ставит `status=completed` для `ok`, `partial` или `no_relevant_evidence`, либо
`status=failed` для `failed` или транспортной ошибки. `result.outcome` и
`analysis_jobs.status` имеют разный смысл. Бэкенд не должен считать
`mode=fixture` реальным исследованием. ML не читает и не пишет `analysis_jobs`,
`roles` и `demo_users`. Текущая демонстрация не обновляет `company_contexts`.
