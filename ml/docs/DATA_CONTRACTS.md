# Данные и контракты ML

## Где что хранится

| Место | Назначение | Кто использует/изменяет |
| --- | --- | --- |
| `companies` | Числовой `id`, строковый `synthetic_u` и данные компании. | ML читает для проверки идентификаторов. |
| `company_contexts.payload.base_information` | Готовый базовый профиль компании. | ML читает; не пересчитывает при каждом запросе. |
| `company_contexts.payload.web_research` | Актуальное веб-исследование: context, scope, refreshed_at. | ML читает и заменяет блок при обновлении. |
| `company_contexts.payload.alfa_analytics` | Место для будущего контекста банковских PDF. | Пока не используется pipeline. |
| `analysis_jobs.result` | Полный результат отдельного запуска: инсайты, источники и снимки контекста. | Создаёт и записывает backend. |
| `ml/.cache/web` | Прочитанные тексты, метаданные и локальный поиск evidence. | ML; в Docker хранится в volume. |
| `ml/.cache/callbacks` | Финальные события, ожидающие повторной доставки. | ML; не замена таблице заданий. |

Также существуют `demo_users`, `roles`, `payments`, `person_company_links`.
Пользователи и доступы относятся к backend; исходные платежи и связи участвуют
в подготовке профиля, а не требуют полной выгрузки при каждом анализе.

`company_contexts.company_id` — строка `U_…`; `analysis_jobs.company_id` — число
`companies.id`. Это разные идентификаторы. `analysis_jobs.id` — UUID задания.
Поле результата называется **`result`**, в единственном числе.

## Зачем JSON Schema

Файлы [contracts/](contracts/) описывают формы Python/HTTP-данных, а не новые
таблицы. `BaseCompanyProfile` — загруженный профиль; `Exposure` — фактор влияния;
`SearchTask` — задача поиска; `CompanyResearchContext` — собранное исследование;
`EvidenceRecord` — источник/фрагмент; `Insight` — вывод; `AnalysisRequest`,
`AnalysisResult`, `StageEvent` — вход, результат и событие pipeline.

Evidence хранятся в файловом кэше и включаются в исследовательский контекст и
результат. Источники для frontend уже развёрнуты в
`insights[].evidence_sources[]`; отдельной таблицы evidence или инсайтов нет.
Снимок внутри старого `result` не меняется при обновлении профиля компании.

## Доступы

Текущая ML-роль читает профили и может обновлять исследовательский блок.
Чтение `analysis_jobs` теперь разрешено: чат выполняет только SELECT по UUID
завершённой сессии. INSERT/UPDATE из ML не выполняются: записи заданий и
результатов принадлежат backend. Историю `chat_messages` читает backend и
передаёт её в запросе чата. [Контракт чата](CHAT_INTEGRATION.md).

Вход API, роли и формат результата: [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md).
