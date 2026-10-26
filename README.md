# alfa-business-insights

Сервис аналитики бизнеса на основе банковских данных и ML.

## Архитектура

Проект состоит из следующих компонентов:

- **Frontend** — веб-интерфейс приложения.
- **Backend (Go)** — REST API, управление компаниями, заданиями анализа и чатом.
- **ML (Python)** — анализ компаний, поиск внешних данных, генерация инсайтов и ответов в чате.
- **PostgreSQL (Supabase)** — общая база данных для хранения компаний, пользователей, заданий анализа и сообщений чата.

Схема взаимодействия:

```text
Frontend
   |
   v
Go Backend :8080
   |
   +----> Supabase PostgreSQL
   |
   +----> Python ML :8000 (Docker)
                |
                +----> ML-модели и внешние сервисы
                |
                +----> Callback в Go Backend
```

Локальную PostgreSQL для обычного запуска поднимать не нужно — backend подключается к общей Supabase через `DATABASE_URL`.

## 1. Подготовка окружения

Необходимо установить:

- Git
- Docker и Docker Compose
- Node.js и npm — для локального запуска frontend

Склонировать репозиторий:

```bash
git clone git@github.com:anassstya/alfa-business-insights.git
cd alfa-business-insights
```

В корне проекта создать `.env` на основе `.env.example` и заполнить актуальными значениями.

Основные переменные:

```dotenv
DATABASE_URL=<Supabase PostgreSQL connection string>

ML_MODE=http
ML_SERVICE_URL=http://ml:8000
ML_SERVICE_TOKEN=<shared token>
ML_CALLBACK_TOKEN=<callback token>
```

Для ML дополнительно могут потребоваться ключи внешних API и параметры Supabase Storage:

```dotenv
SUPABASE_URL=<Supabase project URL>
SUPABASE_SERVICE_KEY=<service key>
SUPABASE_STORAGE_BUCKET=reference-pdfs
```

Остальные параметры ML необходимо настроить согласно его конфигурации.


## 2. Запуск backend

Из корня проекта:

```bash
docker compose --env-file .env up -d --build --no-deps backend
```

Backend будет доступен по адресу:

```text
http://localhost:8080
```

Проверка:

```bash
curl http://localhost:8080/api/v1/roles
```

Ожидаемый результат — JSON со списком доступных ролей пользователей.

## 3. Запуск ML

Для запуска настоящего ML используется отдельная Docker Compose конфигурация:

```bash
docker compose \
  --env-file .env \
  --env-file ml/docker.example \
  -f ml/docker-compose.yml \
  up -d --build --no-deps ml
```

Перед запуском необходимо убедиться, что в окружении указаны действительные ключи и токены.

Проверка:

```bash
curl http://localhost:8001/health
```

Пример успешного ответа:

```json
{
  "status": "ok",
  "fixture_mode": false,
  "bank_research_configured": true
}
```

Первоначальная сборка ML может занимать значительное время из-за установки Python-зависимостей.

Backend должен иметь сетевой доступ к ML по адресу `http://ml:8000` внутри Docker.

## 4. Проверка интеграции

Получить компании демо-пользователя:

```bash
curl http://localhost:8080/api/v1/demo/users/1/companies
```

Компании фильтруются на backend по следующим условиям:

- Компания является клиентом банка (`CLIENT`).
- Выручка компании заполнена и не равна значению-заглушке `1000`.
- Компания входит в группу с суммарной выручкой более 15 млрд.

Для обращения к API используется **числовой `id` компании**. Идентификатор `synthetic_u` используется для сопоставления компании с данными ML.

Пример запуска анализа:

```bash
curl -i -X POST \
  http://localhost:8080/api/v1/companies/31259/analysis \
  -H "Content-Type: application/json" \
  -d '{
    "demo_user_id": 1,
    "role": "cfo",
    "goal": "Оценить финансовые риски компании"
  }'
```

При успешном создании задания API возвращает `202 Accepted` и `job_id`.

Проверить результат:

```text
GET /api/v1/analysis/jobs/{jobID}
```

Получить историю анализов:

```text
GET /api/v1/demo/users/{id}/analysis/jobs
```

### Чат по анализу

Получить историю сообщений:

```text
GET /api/v1/analysis/jobs/{jobID}/chat/messages
```

Отправить сообщение:

```text
POST /api/v1/analysis/jobs/{jobID}/chat/messages
```

Пример тела:

```json
{
  "content": "Какие финансовые риски есть у компании?"
}
```

Ответ ассистента сохраняется в истории чата. Для получения обновлений также предусмотрен SSE.

## 5. Swagger UI

Из корня проекта:

```bash
docker run -d \
  --name swagger-ui \
  -p 8081:8080 \
  -e SWAGGER_JSON=/api/openapi.yaml \
  -v "$(pwd)/backend/api:/api:ro" \
  swaggerapi/swagger-ui
```

После запуска открыть:

http://localhost:8081

При повторном использовании существующего остановленного контейнера:

```bash
docker start swagger-ui
```

## 6. Полезные команды Docker

Просмотреть работающие контейнеры:

```bash
docker ps
```

Просмотреть логи backend:

```bash
docker logs -f backend
```

Просмотреть логи ML:

```bash
docker compose -f ml/docker-compose.yml logs -f ml
```

Пересобрать backend после изменений:

```bash
docker compose --env-file .env up -d --build --no-deps backend
```

## 7. Тестирование backend

Для запуска Go-тестов:

```bash
cd backend
go test ./...
```

Для проверки API рекомендуется использовать Swagger UI или `curl`.

## 8. Известные ограничения

- ML-контексты подготовлены не для всех компаний в общей базе.
- Фильтрация компаний на backend повторяет основные условия отбора ML, но не гарантирует существование каждого подготовленного профиля.
- Некоторые анализы могут завершаться с `outcome=partial` и без инсайтов при недоступности внешних исследовательских сервисов.
- Для реального анализа необходимы действительные API-ключи и доступ к внешним сервисам.
