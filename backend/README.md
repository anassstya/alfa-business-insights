# Backend — Alfa Business Insights (MVP)

Backend на Go и PostgreSQL. Позволяет запускать анализ компаний, получать результаты и общаться с ML в чате. Пока реальный ML не подключён, используется Mock ML.

## Как работает

**Анализ:** `POST` создаeт задачу `pending` → фоновый обработчик переводит её в `running` и вызывает ML/Mock → результат сохраняется в PostgreSQL, статус становится `completed` или `failed`. Результат доступен через `GET`, прогресс — через SSE.

**Чат:** чат привязан к `job_id` завершённого анализа. Backend отправляет вопрос и последние 12 сообщений в ML/Mock, сохраняет вопрос и ответ одной транзакцией. `POST` возвращает `message_id`; ответ читается через `GET` истории. При необходимости ML получает результат анализа через backend `GET /analysis/jobs/{jobID}`.

**Callback:** ML передаёт прогресс и результат анализа через `POST /internal/analysis/events` с токеном `ML_CALLBACK_TOKEN`. Отдельная внутренняя ручка для чтения не требуется: для основного анализа ML читает профили компаний напрямую из PostgreSQL.

## Основные API

Все пути начинаются с `/api/v1`.

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/roles`, `/demo/users` | Роли и демопользователи |
| GET | `/demo/users/{id}/companies`, `/companies`, `/companies/{companyID}` | Компании |
| POST | `/companies/{companyID}/analysis` | Создать анализ |
| GET | `/demo/users/{id}/analysis/jobs` | История анализов |
| GET | `/analysis/jobs/{jobID}` | Статус и результат |
| GET | `/analysis/jobs/{jobID}/events` | SSE прогресса |
| POST / GET | `/analysis/jobs/{jobID}/chat/messages` | Вопрос / история чата |
| POST | `/internal/analysis/events` | Защищённый callback от ML |

`GET /analysis/jobs/{jobID}/chat/events` для MVP не используется и возвращает `503` (стриминга чата нет).

## Локальный запуск без реального ML

Из корня репозитория запустить **отдельную тестовую PostgreSQL**:

```bash
docker compose --env-file /dev/null -f docker-compose.test.yml up -d --wait
```

Затем запустить backend:

```bash
cd backend
DATABASE_URL='postgres://alfa_test:local_test_only@127.0.0.1:55432/alfa_insights_test?sslmode=disable' ML_MODE=mock go run ./cmd
```

Сервер: `http://localhost:8080`. В новой тестовой БД компания и пользователь обычно имеют `id=1` (уточняйте через GET-списки).

Пример создания анализа:

```bash
curl -X POST http://localhost:8080/api/v1/companies/1/analysis \
  -H 'Content-Type: application/json' \
  -d '{"role":"cfo","demo_user_id":1,"goal":"Проверка MVP"}'
```

Сохраните `job_id` из ответа. Затем проверьте:

- `GET /api/v1/analysis/jobs/{jobID}` — ожидается `completed`, `result.mode=fixture`.
- `POST /api/v1/analysis/jobs/{jobID}/chat/messages` с JSON `{"content":"Поясни результат"}`.
- `GET /api/v1/analysis/jobs/{jobID}/chat/messages` — история с ответом Mock (`BACKEND MOCK`).

Тестовая БД не связана с облачной и хранит временные данные. Для остановки из корня:

```bash
docker compose --env-file /dev/null -f docker-compose.test.yml down
```

## Тесты

Из каталога `backend`:

```bash
go test ./...
export TEST_DATABASE_URL='postgres://alfa_test:local_test_only@127.0.0.1:55432/alfa_insights_test?sslmode=disable'
RUN_POSTGRES_INTEGRATION=1 go test -race -timeout 60s ./...
```

В интеграционных тестах используйте **только локальную тестовую БД**, не облачную БД команды.

## Подключение реального ML

- **Backend:** `ML_MODE=http`, `ML_SERVICE_URL`, обязательный `ML_CALLBACK_TOKEN`; `ML_SERVICE_TOKEN` необязателен, если ML принимает запросы без него.
- **ML:** `ML_CHAT_RESULT_SOURCE=backend`, `ML_BACKEND_URL` (адрес backend).
- Обеспечить сетевой доступ в обе стороны, подготовленные `company_contexts` и согласованные токены; выполнить общий тест анализа и чата.

Перед обновлением существующей БД нужно остановить старый backend, сделать резервную копию и **один раз** применить миграцию `database/migrations/007_analysis_recovery.sql`. Она помечает старые незавершённые задачи как `failed`. В новом тестовом контейнере миграции применяются автоматически.

## Важные ограничения MVP

- Анализ — до 6 минут, чат — до 30 секунд. Зависшая задача `running` переходит в `failed` примерно через 7 минут; повторный вызов ML автоматически не выполняется.
- Каждый повторный `POST` анализа создаёт новую задачу.
- `GET` результата анализа в демоверсии не требует авторизации: не открывать публичный доступ к конфиденциальным данным.
- Swagger UI запускается отдельно от Go-сервера.

**Статус:** backend проверен с Mock ML и тестовой PostgreSQL. Осталось подключить реальный ML и проверить его совместную работу с backend.

Подготовка к настоящему ML, локальная конфигурация и smoke-команды: [REAL_ML.md](REAL_ML.md).
