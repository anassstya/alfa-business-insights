# Общий env для backend и ML

Основной файл — **корневой `.env`**. В нём можно хранить набор, присланный
backend-разработчиком: DATABASE_URL, ML_SERVICE_URL, два согласованных токена,
POSTGRES_*, MODEL_API_KEY и TAVILY_API. Файл исключён из Git.
Пример структуры: [../.env.example](../.env.example).

`DATABASE_URL` использует backend; `POSTGRES_*` — ML. Supabase session pooler
на 5432 и transaction pooler на 6543 могут использоваться одновременно.
`ML_MODE=http` текущий backend и ML не читают: строку можно убрать.
`ML_SERVICE_URL=http://ml:8000` корректен для общей Docker-сети.

Для событий прогресса Docker уже подставляет следующие значения, их можно
не дублировать в корневом env:

```dotenv
ML_CALLBACK_ENABLED=true
ML_CALLBACK_URL=http://backend:8080/api/v1/internal/analysis/events
```

Секреты `ML_SERVICE_TOKEN` (backend → ML) и `ML_CALLBACK_TOKEN` (ML → backend)
должны совпадать на обеих сторонах. Согласованные значения уже записаны
в локальный корневой `.env`; в документации их повторять не требуется.
События анализа включены в Docker по умолчанию, переключать режим перед
каждым запросом не нужно. Явный ML_CALLBACK_ENABLED=false нужен только для
диагностики; без callback backend сохраняет финальный HTTP-результат анализа.

## Один запуск из корня

```powershell
docker compose --env-file .env -f docker-compose.yml -f ml/docker-compose.root.yml up -d --build
```

Первый файл — существующий backend/frontend Compose. Второй добавляет ML через
extends, сохраняя корректный build context и общую сеть. Исходный Compose
и код backend не меняются. Обычный `docker compose up` без второго файла
запускает только сервисы исходного Compose, то есть backend и frontend.

Только ML, с тем же корневым env:

```powershell
docker compose --env-file .env -f ml/docker-compose.yml up -d --build ml
```

## Приоритет и standalone

В контейнер настройки передаются окружением. При обычном Python-запуске
настройки читаются из корневого `.env`. Окружение процесса всегда приоритетнее
файла. `ml/docker.example` используется только если корневой `.env` отсутствует;
он не дополняет и не перекрывает существующий корневой файл.

Для отдельной ML-разработки сохранён запуск
`docker compose --env-file ml/docker.example -f ml/docker-compose.yml up -d --build ml`.
Не использовать этот вариант для общего запуска с другим env backend.
Tavily-ключ в публичном `docker.env.example` сохранён по запросу владельца.

Defaults не требуется переписывать в env: порт ML 8001, live-режим,
чат через Supabase, модель deepseek/deepseek-v4.1-flash, timeout модели 60 секунд,
callback timeout 5 секунд. Резервные ML_BACKEND_URL / ML_BACKEND_TOKEN нужны
только при ML_CHAT_RESULT_SOURCE=backend. Основной чат использует Supabase.

Проверено на присланном env: все три контейнера запущены; ML healthy; backend
читает роли из БД; frontend отвечает; ключ LLM принят; callback с общим токеном
проходит авторизацию (404 для отсутствующего задания). 67 тестов проходят
на хосте и в Docker. Полный live-анализ компании этой проверкой не запускался.
