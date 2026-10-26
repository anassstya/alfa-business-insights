# ML-сервис новостной аналитики

Сервис получает компанию, роль пользователя и необязательную цель, ищет новости
через Tavily и формирует до пяти инсайтов о возможном влиянии событий на компанию.
Роль и цель влияют на поиск и объяснение результатов.

## Как работает

1. По ID компании загружает готовый профиль из Supabase `company_contexts.payload`.
2. По признакам профиля определяет потенциальные факторы влияния — exposures.
3. Планирует веб-поиск, собирает материалы, даты, цитаты и ссылки.
4. Сохраняет актуальное исследование в `payload.web_research` либо использует
   свежий совместимый контекст. При обновлении заменяет этот блок, сохраняя базу.
5. LLM объясняет влияние событий; код проверяет формат, ссылки на evidence,
   цитаты и признаки, затем ранжирует инсайты.
6. Возвращает JSON. При включённом callback передаёт этапы и результат бэкенду.

PDF-инструмент интегрирован как дополнение к веб-поиску. При наличии
SUPABASE_URL / SUPABASE_SERVICE_KEY найденные банковские фрагменты обогащают
контекст перед генерацией инсайтов; без них веб-проход сохраняется.
Judge пока не подключён. [Настройка PDF](docs/BANK_PDF_INTEGRATION.md).

## Как вызвать

В общей Docker-сети: `POST http://ml:8000/internal/analyze-company`.
Заголовки: `Authorization: Bearer <ML_SERVICE_TOKEN>`, `Content-Type: application/json`.

```json
{
  "company_id": 70,
  "role": "cfo",
  "goal": "Оценить риски финансирования",
  "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

`company_id` и `role` обязательны. `70` — пример, нужен ID реальной компании.
`goal` можно опустить; `job_id` нужен для связи с уже созданным backend-заданием
и доставки callback. Без `job_id` сервис возвращает результат без создания записи.
Python-вызов: `ml.src.company_analysis.analyze_company(company_id, role, goal=None)`.

## Что возвращает и где хранится

`AnalysisResult`: `job_id`, `outcome`, `insights`, `evidence`, снимки контекста,
предупреждения и trace. Для карточек источников использовать
`insights[].evidence_sources[]` — там есть `title`, `url`, дата и `quote`.

ML обновляет только исследовательский блок профиля. Задание создаёт бэкенд;
он же сохраняет результат в **`analysis_jobs.result`** и передаёт его фронтенду.
ML не выполняет INSERT/UPDATE в `analysis_jobs`. Отдельной таблицы инсайтов нет.

## Запуск и подключение

```powershell
docker compose --env-file .env -f ml/docker-compose.yml up -d --build ml
```

Общий запуск frontend, backend и ML из корневого `.env`:

```powershell
docker compose --env-file .env -f docker-compose.yml -f ml/docker-compose.root.yml up -d --build
```

Локально: `http://127.0.0.1:8001`; проверка процесса: `GET /health`.
Корневой Compose, backend и frontend не требуется менять для запуска ML.

- [Как подключить бэкенд: запросы, события, результат](docs/BACKEND_INTEGRATION.md).
- [Запуск Docker](docs/DOCKER.md) и [минимальные env-настройки](docs/ENVIRONMENT.md).
- [Данные и контракты](docs/DATA_CONTRACTS.md).
- [Текущее состояние и следующие шаги, включая чат](docs/IMPLEMENTATION_PLAN.md).

Чат: `POST /internal/chat` принимает `job_id`, текущий `message` и `history`.
ML читает результат из Supabase и отвечает по сохранённым инсайтам и источникам,
без нового веб-поиска. История и сохранение ответа остаются у backend.
Контракт и подключение: [docs/CHAT_INTEGRATION.md](docs/CHAT_INTEGRATION.md).
