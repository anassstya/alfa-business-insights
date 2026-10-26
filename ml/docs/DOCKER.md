# Docker для ML

Используется отдельный `ml/docker-compose.yml`. Он запускает только ML и
подключается к сети `alfa-business-insights_hack_network` существующего проекта.
Корневой Compose, backend и frontend менять не требуется.

## Настройка и общий запуск

Основные настройки backend и ML хранятся в корневом `.env`: DATABASE_URL,
ML_SERVICE_URL, ML_SERVICE_TOKEN, ML_CALLBACK_TOKEN, POSTGRES_*, MODEL_API_KEY,
TAVILY_API. События прогресса включены в Docker по умолчанию; адрес callback —
http://backend:8080/api/v1/internal/analysis/events. [Подробности и defaults](ENVIRONMENT.md).

Из корня репозитория запустить все три сервиса одной командой:

```powershell
docker compose --env-file .env -f docker-compose.yml -f ml/docker-compose.root.yml up -d --build
```

Дополнение `ml/docker-compose.root.yml` добавляет ML, не меняя корневой Compose.
Общая сеть и сервисные токены согласованы. Без второго файла обычный
`docker compose up` не запускает ML.

Только ML с тем же env:

```powershell
docker compose --env-file .env -f ml/docker-compose.yml up -d --build ml
```

Для standalone-разработки доступен `ml/docker.example`; при запуске Python
он используется только если корневого `.env` нет. Публичный Tavily-ключ
в example сохранён по запросу владельца. Не смешивать разные env-файлы ML
и backend при интеграционном запуске.

| Откуда | Адрес |
| --- | --- |
| Хост | `http://127.0.0.1:8001` |
| Backend в общей Docker-сети | `http://ml:8000` |
| Проверка процесса | `GET /health` без токена |
| Запуск анализа | `POST /internal/analyze-company` с Bearer-токеном |

`localhost` внутри контейнера backend указывает на сам backend, поэтому для ML
нужно использовать имя `ml`. При другом `COMPOSE_PROJECT_NAME` оба Compose должны
использовать одинаковое значение, чтобы совпала сеть.

Логи: `docker compose --env-file .env -f ml/docker-compose.yml logs --tail 100 ml`.
Остановить только ML: та же команда с `stop ml` вместо `logs --tail 100 ml`.
Не использовать `--remove-orphans` для соседних сервисов проекта.

Контейнер работает без root. Кэш материалов и недоставленные callback сохраняются
в volume `ml_cache`. Секреты передаются окружением, а не встраиваются в образ.
`/health` не проверяет доступность БД, Tavily или модели.

## Готовность

Предыдущая версия ML поднята и проверена в Docker: health, доступ из общей сети,
Supabase и Tavily. В образ включены модуль и prompt чата. По умолчанию
`ML_CHAT_RESULT_SOURCE=supabase`: нужны SELECT к `analysis_jobs` и существующий
ключ модели. `/internal/chat` использует тот же `ML_SERVICE_TOKEN`.

26 октября Engine восстановил доступность; ML-образ пересобран и контейнер
обновлён, статус healthy. Все 67 тестов проходят в Linux-образе без сети.
Проверены авторизация и чтение Supabase через работающий endpoint чата;
на демонстрационной сессии внутри контейнера получен ответ настоящей модели
с учётом истории и контекста. Реальная завершённая сессия пока отсутствует
в `analysis_jobs`. [Подключение чата](CHAT_INTEGRATION.md).

Формат вызова и callback: [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md).

PDF-инструмент включён в тот же образ: CPU PyTorch/e5, PyMuPDF и Tesseract rus/eng.
78 тестов прошли в обновлённом образе; настоящие embeddings проверены (384).
Health показывает bank_research_configured: это наличие API-настроек, не проверка
самого индекса. [Настройка PDF](BANK_PDF_INTEGRATION.md).
