# Подключение ML к бэкенду

ML исследует компанию и возвращает инсайты. Бэкенд проверяет доступ пользователя,
создаёт задание, сохраняет результат и обслуживает frontend. Изменения backend
не входят в ML-часть; ниже — инструкция для его разработчика.

## 1. Адрес и авторизация

В общей Docker-сети адрес ML: `http://ml:8000`; с хоста: `http://127.0.0.1:8001`.
Все `/internal/*` требуют `Authorization: Bearer <ML_SERVICE_TOKEN>`.
`GET /health` доступен без токена и проверяет только процесс.

## 2. Запуск анализа

Бэкенд создаёт `analysis_jobs` со статусом `pending`, затем в фоновом обработчике
вызывает `POST /internal/analyze-company`:

```json
{
  "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "company_id": 70,
  "role": "cfo",
  "goal": "Оценить риски финансирования"
}
```

| Поле | Что передать |
| --- | --- |
| `company_id` | Обязательно: положительное число `companies.id` или строку `U_…`. Число не передавать строкой. |
| `role` | Обязательно: `accountant`, `ceo`, `cfo`, `decision_maker`, `other_c_level`, `owner`, `treasurer`. |
| `goal` | Необязательно: цель до 1000 символов; можно опустить или передать null. |
| `job_id` | UUID уже созданного backend-задания; нужен для callback. |
| `as_of` | Необязательно: ISO-дата со смещением часового пояса; по умолчанию текущее время. |

Запрос синхронный: соединение открыто до завершения. Для интеграции нужен
фоновый вызов на стороне backend и timeout с запасом сверх 120 секунд,
учитывающий доставку событий. ML не ставит запрос в собственную очередь.
Без `job_id` создаётся только идентификатор запуска: строки в БД не появится.

Полный вариант `POST /internal/analyze` остаётся доступен: требует одновременно
`company_id` (`U_…`), `company_row_id` (число), `job_id`, `role`, `as_of`;
допускает `lookback_days`, `max_insights`, `refresh_web_research`.
Точная схема: [AnalysisRequest.schema.json](contracts/AnalysisRequest.schema.json).

## 3. Получение прогресса и результата

В Docker события уже включены по умолчанию. Эквивалентные настройки:

```dotenv
ML_CALLBACK_ENABLED=true
ML_CALLBACK_URL=http://backend:8080/api/v1/internal/analysis/events
ML_CALLBACK_TOKEN=<общий_секрет_с_бэкендом>
```

У backend `ML_CALLBACK_TOKEN` должен совпадать. Это токен **ML → backend**;
`ML_SERVICE_TOKEN` используется в обратном направлении.

ML отправляет в существующий `POST /api/v1/internal/analysis/events` события:

```json
{
  "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "running",
  "stage": "retrieving"
}
```

Финальное событие имеет тот же envelope и дополнительно `result` — полный
`AnalysisResult`; при ошибке возможно поле `error_message`.
Статусы: `running`, `completed`, `failed`; начальный `pending` ставит backend.
Этапы: `loading_profile`, `mapping_exposures`, `planning`, `retrieving`,
`analyzing`, `validating`, `completed`.

Бэкенд сохраняет `result` в `analysis_jobs.result` и уведомляет frontend своим SSE.
Существующий callback обновляет только созданную строку и возвращает 204.
Максимальный размер события — 1 MiB. Промежуточные события не содержат `result`.
`run_id`, `seq` и trace находятся внутри результата, не в envelope события.

Без callback ML возвращает обычный JSON-ответ; его должен сохранить backend.
HTTP 200 сам по себе не означает успешный анализ: проверить `result.outcome`.
`ok`, `partial`, `no_relevant_evidence` соответствуют статусу `completed`,
`failed` — статусу `failed`. В fixture-режиме `mode=fixture`: это демонстрация.

Если финальный callback не доставлен, ML возвращает 503
`backend_callback_failed` и сохраняет событие в `ml/.cache/callbacks/`.
Переслать его без нового поиска можно командой:
`python -m ml.src.backend_callback --replay <путь_к_файлу>`.
Перед повторным анализом проверить состояние задания: callback мог уже дойти.

## 4. Что отдать фронтенду

Сохранять весь `AnalysisResult`, а для отображения использовать:

| Поле | Назначение |
| --- | --- |
| `insights[].event`, `ai_interpretation` | Событие и пояснение модели. |
| `company_relevance`, `role_relevance`, `impact_chain` | Связь с компанией, ролью и механизм воздействия. |
| `risks`, `opportunities`, `suggested_actions`, `uncertainty` | Риски, возможности, действия и ограничения. |
| `insights[].evidence_sources[]` | Источники: `evidence_id`, `title`, `url`, `publisher`, `published_at`, `quote`, `page_number`. |
| `warnings`, `outcome` | Неполнота данных или ошибка анализа. |

URL берутся из сохранённых evidence. Полная форма результата:
[AnalysisResult.schema.json](contracts/AnalysisResult.schema.json).

## 5. Чат

`POST /internal/chat` принимает `job_id`, `message`, необязательный `history`.
ML читает сохранённый результат из Supabase и отвечает без нового исследования.
Ответ содержит `answer`, ссылки на инсайты/evidence, `sources` и
`insufficient_context`. Историю передаёт и сохраняет backend.

Отдельная инструкция с примерами, лимитами и точками подключения к новым
backend-ручкам: [CHAT_INTEGRATION.md](CHAT_INTEGRATION.md).

## Текущее состояние backend

В новой версии создание задания и фоновый вызов `/internal/analyze-company`
уже реализованы: `StartAnalysis` создаёт запись, `runMLAnalysis` вызывает ML
и сохраняет HTTP-результат. Callback, чтение заданий и SSE тоже существуют.
Настроить `ML_SERVICE_URL=http://ml:8000` и соответствующие сервисные токены.

Чат пока сохраняет только пользовательские сообщения; вызов ML, сохранение
assistant-ответа и chat SSE нужно подключить владельцу backend по инструкции
выше. Код backend в этой задаче не изменялся.
