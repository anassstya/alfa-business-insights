# Docker для ML

Используется отдельный `ml/docker-compose.yml`. Он запускает только ML и
подключается к сети `alfa-business-insights_hack_network` существующего проекта.
Корневой Compose, backend и frontend менять не требуется.

## Настройка

Рабочие параметры Supabase (`POSTGRES_*`) и `MODEL_API_KEY` берутся из корневого
`.env`. Локальный PostgreSQL не нужен. Порт и режим подключения должны
соответствовать удалённому Supabase; для текущего pooler используется
`POSTGRES_PORT=6543`, `POSTGRES_CONNECTION_MODE=transaction`.

Дополнительные настройки положить в локальный `ml/docker.example`:

```dotenv
TAVILY_API=<ключ_Tavily>
ML_SERVICE_TOKEN=<секрет_для_вызовов_backend_в_ML>
ML_PORT=8001
ML_FIXTURE_MODE=false
ML_CALLBACK_ENABLED=true
ML_CALLBACK_URL=http://backend:8080/api/v1/internal/analysis/events
ML_CALLBACK_TOKEN=<такой_же_как_у_backend>
```

`ml/docker.example` исключён из Git. Не добавлять рабочие секреты в публичные
шаблоны. Если backend ещё не готов, поставить `ML_CALLBACK_ENABLED=false`:
анализ будет возвращать JSON без отправки событий и сохранения задания.

## Запуск из корня репозитория

```powershell
docker compose --env-file .env --env-file ml/docker.example -f ml/docker-compose.yml up -d --build ml
```

| Откуда | Адрес |
| --- | --- |
| Хост | `http://127.0.0.1:8001` |
| Backend в общей Docker-сети | `http://ml:8000` |
| Проверка процесса | `GET /health` без токена |
| Запуск анализа | `POST /internal/analyze-company` с Bearer-токеном |

`localhost` внутри контейнера backend указывает на сам backend, поэтому для ML
нужно использовать имя `ml`. При другом `COMPOSE_PROJECT_NAME` оба Compose должны
использовать одинаковое значение, чтобы совпала сеть.

Логи: `docker compose --env-file .env --env-file ml/docker.example -f ml/docker-compose.yml logs --tail 100 ml`.
Остановить только ML: та же команда с `stop ml` вместо `logs --tail 100 ml`.
Не использовать `--remove-orphans` для соседних сервисов проекта.

Контейнер работает без root. Кэш материалов и недоставленные callback сохраняются
в volume `ml_cache`. Секреты передаются окружением, а не встраиваются в образ.
`/health` не проверяет доступность БД, Tavily или модели.

## Готовность

Предыдущая версия ML поднята и проверена в Docker: health, доступ из общей сети,
Supabase и Tavily. Новые изменения чата ещё не пересобраны и не развёрнуты;
не считать черновой чат доступным в работающем контейнере.
Сейчас обновляется документация, без перезапуска сервисов.

Формат вызова и callback: [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md).
