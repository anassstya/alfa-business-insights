# alfa-business-insights  
## Запуск приложения  
Для запуска всего приложения необходимо прописать docker-compose up.  
Можно каждый сервис запустить отдельной командой docker-compose up <название сервиса>.  
В случае, если необходимо подключиться к бд во время разработки требуется в docker-compose.yml заменить expose на ports, тогда подключение будет доступно за пределами сети
#### TODO: Дописать docker-compose
##### SUGGEST: Безопасно не пробрасывать порты бд и бэковских приложений наружу без надобности, тут придется прокинуть backend наружу, так как фронт не будет работать без этого (связано с тем как браузер рендерит СПА)

Подтнять бекенд:
1) В корне проекта создать .env (по примеру .env.example) и заменить пароль
2) Из корня проекта: docker compose up -d --build backend

(БД отдельно запускать не надо: backend автоматически подключается к общей PostgreSQL в Supabase через DATABASE_URL)

Как запустить Swagger UI:
Из корня проекта выполнить:
1) docker run -d --name swagger-ui -p 8081:8080 -e SWAGGER_JSON=/api/openapi.yaml -v "$(pwd)/backend/api:/api:ro" swaggerapi/swagger-ui
2) Перейти на http://localhost:8081

Интеграция ML и запуск без модели: [backend/ML_INTEGRATION.md](backend/ML_INTEGRATION.md).

Локальная PostgreSQL, интеграционные тесты и ручная проверка API с Mock ML: [backend/POSTGRES_TESTING.md](backend/POSTGRES_TESTING.md).

Надёжность фонового анализа, миграция 007 и восстановление после рестарта: [backend/ANALYSIS_RECOVERY.md](backend/ANALYSIS_RECOVERY.md).

Синхронный чат анализа с Mock ML: [backend/CHAT.md](backend/CHAT.md).
