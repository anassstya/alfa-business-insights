# Запуск backend с настоящим ML

## Что готово

ML_MODE=http поддерживает анализ и чат. ML_SERVICE_TOKEN необязателен по
уточнению команды: если он пуст, заголовок Authorization вообще не отправляется;
если задан — отправляется Bearer. Mock и публичные API сохранены.

ML_CALLBACK_TOKEN по-прежнему обязателен при запуске backend в HTTP-режиме,
даже если ML не отправляет callback. Авторизация callback не изменялась.
При включённых callback значение должно совпадать у backend и ML.
ML_BACKEND_TOKEN на стороне ML для чтения результатов не обязателен:
существующий GET /api/v1/analysis/jobs/{jobID} в demo доступен без авторизации.

**Расхождение с версией ML в репозитории:** ml/src/service.py всё ещё требует
сервисный токен либо ML_LOCAL_DEV_MODE=true и loopback-адрес клиента.
ml/docker-compose.yml требует ML_SERVICE_TOKEN и отключает local dev mode.
Поэтому пустой токен теперь допустим у backend, но не гарантирует доступ
к этой сборке ML. Команда должна подтвердить режим авторизации развёрнутого
сервиса или выдать токен. Файлы ML не изменялись.

## Минимальный .env для backend на хосте

Используйте отдельную локальную PostgreSQL, не рабочую облачную БД:

```dotenv
DATABASE_URL=postgres://alfa_test:local_test_only@127.0.0.1:55432/alfa_insights_test?sslmode=disable
ML_MODE=http
ML_SERVICE_URL=http://127.0.0.1:8001
ML_SERVICE_TOKEN=
ML_CALLBACK_TOKEN=replace-with-local-callback-secret
ML_HTTP_TIMEOUT=8m
```

Замените callback placeholder на свой локальный секрет и сообщите его ML-команде
для настройки callback. Не публикуйте заполненный .env. ML_SERVICE_URL — адрес
фактически запущенного сервиса, без /internal/... в конце. Адрес выше — пример
из документации, не подтверждённый работающий сервис.

Go сам не читает .env. Из корня сначала запустите только тестовую PostgreSQL:

```sh
docker compose --env-file /dev/null -f docker-compose.test.yml up -d --wait
```

Миграции 001, 003–007 применяются при создании тестового кластера. Не
пересоздавайте контейнер с нужными данными: tmpfs очищается при остановке.
Если тестовая БД осталась от старой версии, проверьте применение миграции 007
до запуска обработчика. Рабочую облачную БД эти команды не используют.

В отдельном терминале экспортируйте именно локальные значения и запустите:

```sh
export DATABASE_URL='postgres://alfa_test:local_test_only@127.0.0.1:55432/alfa_insights_test?sslmode=disable'
export ML_MODE=http
export ML_SERVICE_URL='http://127.0.0.1:8001'
export ML_SERVICE_TOKEN=''
export ML_CALLBACK_TOKEN='replace-with-local-callback-secret'
export ML_HTTP_TIMEOUT=8m
cd backend
go run ./cmd
```

Здесь также замените callback placeholder. При запуске backend в Docker вместо
localhost нужны адреса, доступные из контейнера: например ML_SERVICE_URL=http://ml:8000
в общей сети. DATABASE_URL должен указывать на отдельную тестовую БД, доступную
из контейнера. Существующий корневой compose использует эти же переменные:

```sh
docker compose --env-file .env up -d --build backend
```

Не используйте команду Docker с host-конфигурацией localhost:55432 без исправления
адреса БД: localhost контейнера — сам контейнер.

## Что настроить на стороне ML (через команду, без изменения исходников)

- Сервис анализа/чата действительно запущен; подтвердить токен или работу без него.
- ML_CHAT_RESULT_SOURCE=backend; ML_BACKEND_URL должен указывать на backend:
  http://127.0.0.1:8080 для процессов на одном хосте либо http://backend:8080
  в общей Docker-сети. Для смешанного запуска адрес согласовать отдельно.
- Если нужен прогресс: ML_CALLBACK_ENABLED=true,
  ML_CALLBACK_URL=http://backend:8080/api/v1/internal/analysis/events в общей сети
  (для процессов на хосте — http://127.0.0.1:8080/api/v1/internal/analysis/events),
  ML_CALLBACK_TOKEN совпадает с backend. Без callback результат сохранится из HTTP.
- Для настоящего анализа нужны настройки модели/поиска и **изолированный**
  источник подготовленных профилей, согласованный с backend companies.id/synthetic_u.
  Даже при локальном backend ML способен читать и обновлять собственную облачную БД!
  До smoke-теста команда должна подтвердить безопасный тестовый источник.
- В текущем ML SupabaseSettings запрещает loopback POSTGRES_HOST и требует TLS.
  Обычная PostgreSQL из docker-compose.test.yml без TLS сама по себе не подходит
  этому загрузчику ML. Нужен согласованный отдельный тестовый источник с TLS
  либо поддерживаемый командой безопасный режим загрузки профиля.

## Совместимость контрактов

Backend → ML: POST /internal/analyze-company, поля job_id (UUID), company_id
(число companies.id), role, необязательный goal. HTTP-запрос синхронный, вызов
выполняет фоновый обработчик backend. Полный AnalysisResult сохраняется в JSONB;
outcome ok/partial/no_relevant_evidence → completed, failed → failed.

ML → backend: POST /api/v1/internal/analysis/events с обязательным Bearer
ML_CALLBACK_TOKEN; поля job_id, status, stage, result, error_message. Промежуточный
callback не продлевает фиксированный recovery deadline; финальная запись защищена
от перезаписи. Уже закрытое failed не оживляется поздним callback.

Backend → ML чат: POST /internal/chat, job_id, message и последние 12 сообщений
history. ML читает result через GET /api/v1/analysis/jobs/{jobID}; backend сохраняет
user/assistant одной транзакцией. Ответ чата должен содержать совпадающий job_id
и непустой answer. Форматы соответствуют текущим исходникам ML; реальный сервис
в этой проверке не запускался.

Лимиты: анализ — 6 минут, восстановление running — 7 минут, чат — 30 секунд.
HTTP-ответ ML до 8 MiB, callback до 1 MiB, ML читает AnalysisJob до 2 MiB;
message до 4000 символов, answer до 8000. Проверить на реальных данных.

## Smoke-команды

Сначала только read-only проверка процесса ML (не подтверждает готовность модели):

```sh
curl --fail-with-body --connect-timeout 3 --max-time 5 http://127.0.0.1:8001/health
```

Ниже выполняйте POST **только после подтверждения изолированного источника ML**.
В свежей локальной БД компания U_LOCAL_TEST имеет id=1. Сначала получите список:

```sh
curl --fail-with-body http://localhost:8080/api/v1/companies
```

Команда ML должна подготовить синтетический профиль с тем же id/synthetic_u
в своём тестовом источнике. Без этого анализ ожидаемо завершится ошибкой;
не подставляйте ID рабочей компании ради обхода проверки.

```sh
COMPANY_ID=1
curl --fail-with-body -X POST "http://localhost:8080/api/v1/companies/$COMPANY_ID/analysis" \
  -H 'Content-Type: application/json' \
  -d '{"role":"cfo","goal":"Smoke-тест синтетической компании"}'
```

Скопируйте job_id из ответа, дождитесь completed через GET/SSE:

```sh
JOB_ID='<UUID из ответа POST>'
curl --fail-with-body "http://localhost:8080/api/v1/analysis/jobs/$JOB_ID"
curl -N "http://localhost:8080/api/v1/analysis/jobs/$JOB_ID/events"
```

Остановите SSE через Ctrl+C, затем для completed:

```sh
curl --fail-with-body --max-time 35 -X POST \
  "http://localhost:8080/api/v1/analysis/jobs/$JOB_ID/chat/messages" \
  -H 'Content-Type: application/json' -d '{"content":"Поясни ограничения результата анализа"}'
curl --fail-with-body "http://localhost:8080/api/v1/analysis/jobs/$JOB_ID/chat/messages"
```

Ожидается 201 и история user/assistant без BACKEND MOCK. Смотрите result.mode:
fixture на стороне настоящего HTTP-сервиса означает демонстрационный pipeline,
а не успешную проверку настоящей модели. При failed/502 не повторяйте анализ
бесконечно: проверьте авторизацию ML, профили и состояние задания.

## Фактически проверено

Локальный адрес из документации http://127.0.0.1:8001/health недоступен
(connection refused). Другой подтверждённый адрес и безопасный источник профилей
не предоставлены. Реальный smoke-тест анализа/чата не выполнен.
Автотесты проверяют HTTP с токеном и без него на локальном тестовом сервере;
это проверка адаптера, не подтверждение интеграции с настоящим ML.
