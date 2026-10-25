# Данные и контракты ML

Состояние данных проверено 24 октября 2026 года; план хранения расширенного контекста обновлён 25 октября по запросу пользователя. Разделы 1–4 описывают существующие данные и код. Разделы 5–8 описывают ML-контракт; модели и загрузчик реализованы в `ml/src/contracts.py` и `ml/src/profile_repository.py`. Fixture HTTP API итерации 2 реализовано в `ml/src/service.py`; пример — в [FIXTURE_SERVICE.md](FIXTURE_SERVICE.md). Эти модели не являются схемой таблиц Supabase.

## 1. Что проверено

Прочитаны материалы в `ml/context/`, архитектурные заметки пользователя, код `ml/`, миграция `database/migrations/001_init.sql`, `backend/api/openapi.yaml` и локальный JSON. Дополнительно выполнены запросы к Supabase с `SET TRANSACTION READ ONLY`, SSL и ограничением времени выполнения. Данные, политики и схемы БД не менялись.

| Таблица | Структура | Объём | Роль в решении |
| --- | --- | --- | --- |
| `companies` | 25 колонок | 85 525 строк, проверено SELECT | Исходные признаки и связь числового ID с `synthetic_u` |
| `company_contexts` | 4 колонки | 10 146 строк, доступных текущей роли, проверено SELECT | Готовый базовый профиль |
| `payments` | 5 колонок | Около 1 380 585, оценка пользователя | Исходные платёжные связи, агрегируются заранее |
| `person_company_links` | 5 колонок | Около 12 514, оценка пользователя | Обезличенные связи через физлиц |
| `analysis_jobs` | 11 колонок | Около 0, оценка пользователя | Задания, статус, результат; владелец — бэкенд |
| `roles` | 2 колонки | Около 7, оценка пользователя | Справочник ролей |
| `demo_users` | 4 колонки | Около 3, оценка пользователя | Пользователи демо; вне ML |

Локальный `company_context.json` содержит 10 146 уникальных профилей. Во всех присутствует `base_information`; маркер незавершённой загрузки отсутствует. В доступных удалённых контекстах также не обнаружены незавершённые записи. Оценка интерфейса Supabase 10 148 не равна проверенному числу строк. Совпадение количества локальных и удалённых профилей не доказывает равенство всех их значений.

В `companies` 85 514 различных `synthetic_u` на 85 525 строк: идентификатор не уникален. Это 11 лишних строк относительно числа уникальных ID, а не доказательство ровно 11 конфликтующих компаний. Нельзя выбирать первую попавшуюся строку при конфликте.

У 115 строк `companies` выручка строго больше 15 млрд в исходных единицах. Генератор контекстов сейчас отбирает **клиентов из групп с суммарной выручкой выше порога**, предварительно исключая `revenue_company = 1000` и записи без группы. Это другое условие, чем выручка каждой компании выше 15 млрд. Период и валюта выручки в таблице не указаны.

## 2. Фактические таблицы

`NULL` разрешён, если не указано `NOT NULL`. Отсутствие внешнего ключа не означает отсутствия логической связи.

### companies

| Колонка | Тип и ограничения | Значение |
| --- | --- | --- |
| `id` | bigint, PK, sequence | Числовой ID записи |
| `synthetic_u` | text, NOT NULL, обычный индекс | Обезличенный ID компании `U_…`; нет UNIQUE |
| `org_type` | text | Тип организации |
| `okfs_name` | text | Форма собственности |
| `company_age_years_gradation` | text | Интервал возраста |
| `eco_mark_label` | text | Стадия развития из датасета |
| `mainokved_code` | text | Код ОКВЭД |
| `mainokved_name` | text | Название деятельности |
| `negativemark` | numeric | В кейсе — признак ключевого собственника; кодировка не раскрыта |
| `amount_workers_fns_gradation` | text | Интервал численности по ФНС |
| `amount_workers_spark_gradation` | text | Интервал численности по СПАРК |
| `cl_type` | text | Клиентский статус |
| `cl_product_rko_mark` | numeric | Признак РКО |
| `cl_product_gar_mark` | numeric | Признак гарантий |
| `cl_product_loa_mark` | numeric | Признак кредитного продукта |
| `cl_product_lea_mark` | numeric | Признак лизинга |
| `cl_product_dep_mark` | numeric | Признак депозита |
| `cl_product_zpp_mark` | numeric | Признак зарплатного проекта |
| `fts_flag` | numeric | Наличие сведений ФТС |
| `fts_country_name` | text | Страны из сведений ФТС |
| `factoring_mark` | numeric | Признак факторинга |
| `revenue_company` | numeric | Годовая выручка; год и валюта неизвестны |
| `group_id` | text | Группа по исходной классификации |
| `city` | text | Город регистрации |
| `region` | text | Регион регистрации |

### company_contexts

| Колонка | Тип и ограничения |
| --- | --- |
| `company_id` | text, PK; соответствует `synthetic_u`, а не `companies.id` |
| `payload` | jsonb, NOT NULL |
| `created_at` | timestamptz, NOT NULL, default `now()` |
| `updated_at` | timestamptz, NOT NULL, default `now()` |

Внешнего ключа к `companies.synthetic_u` нет. Наличие default у `updated_at` само по себе не означает автоматического обновления при UPDATE: текущий writer обновляет его явно.

### payments

| Колонка | Тип и ограничения |
| --- | --- |
| `id` | bigint, PK, sequence |
| `beneficiary` | text, NOT NULL, индекс; ID получателя |
| `payer` | text, NOT NULL, индекс; ID плательщика |
| `pay_amt` | numeric; агрегированный объём |
| `pay_cnt` | bigint; число платежей |

Периода, валюты и назначения операций нет. `payer` и `beneficiary` логически связаны с `synthetic_u`, но FK не объявлены; часть контрагентов может не иметь профиля. Самоплатежи исключаются генератором из входящих и исходящих агрегатов.

### person_company_links

| Колонка | Тип и ограничения |
| --- | --- |
| `id` | bigint, PK, sequence |
| `synthetic_f` | text, NOT NULL, индекс |
| `city_name` | text |
| `rc_name` | text |
| `synthetic_u` | text, NOT NULL, индекс |

Роль человека и факт владения не заданы. Совпадение физлица — сигнал связи, не доказательство собственника или директора.

### analysis_jobs

Структура прочитана из `pg_catalog`: текущая ML-роль не имеет SELECT на таблицу.

| Колонка | Тип и ограничения |
| --- | --- |
| `id` | uuid, PK, default отсутствует |
| `company_id` | bigint, NOT NULL, FK → `companies.id`, индекс |
| `demo_user_id` | bigint, FK → `demo_users.id` |
| `role` | text, NOT NULL |
| `status` | text, NOT NULL, default `'pending'` |
| `stage` | text |
| `result` | jsonb |
| `error_message` | text |
| `created_at` | timestamptz, NOT NULL, default `now()` |
| `updated_at` | timestamptz, NOT NULL, default `now()` |
| `goal` | text |

CHECK на значения `status` и FK от `role` к `roles` в прочитанных ограничениях не обнаружены. Предлагаемые состояния ниже нужно согласовать как интеграционный контракт, а не считать существующей реализацией бэкенда.

### roles и demo_users

- `roles.code`: text, PK. `roles.full_name`: text, NOT NULL.
- `demo_users.id`: bigint, PK, sequence. `synthetic_f`: text, NOT NULL, UNIQUE. `first_name`, `last_name`: text, NOT NULL.
- Строки этих таблиц текущая роль читать не может. Коды ролей получены из заметок пользователя: `accountant`, `ceo`, `cfo`, `decision_maker`, `other_c_level`, `owner`, `treasurer`. Это не результат чтения удалённого справочника.

## 3. Доступ и идентификаторы

Проверенные права SELECT: разрешены `companies`, `company_contexts`, `payments`, `person_company_links`; запрещены `analysis_jobs`, `roles`, `demo_users`.

RLS включён у `company_contexts` и `analysis_jobs`. Для `company_contexts` видны политики `ml_context_select`, `ml_context_insert`, `ml_context_update` для роли `ml_agent` с условием `true`. Для `analysis_jobs` политики при проверке не обнаружены. Политика RLS и табличные GRANT — разные условия доступа; все права записи в рамках аудита не проверялись. Отключать RLS или переходить на административный ключ ради MVP не требуется.

Предлагаемая граница: ML читает базовые профили и отдельным writer обновляет расширенные блоки `company_contexts.payload`; бэкенд сохраняет задания и результаты своими учётными данными. ML не должен обращаться к `analysis_jobs` с нынешними настройками. Наличие UPDATE-политики не доказывает табличный GRANT: перед включением writer проверить права, не расширять их молча.

Имена в новом ML-коде:

```text
company_id: str         = companies.synthetic_u = company_contexts.company_id
company_row_id: int     = companies.id = analysis_jobs.company_id
job_id: UUID            = analysis_jobs.id
run_id: UUID            = конкретная попытка выполнения задания
session_id: UUID        = job_id для первого MVP и его уточняющего чата
```

Бэкенд получает числовую запись компании, разрешает её `synthetic_u` и передаёт оба значения в ML. Если переданы оба ID, ML проверяет соответствие. Если `synthetic_u` неоднозначен, возвращает `AmbiguousCompanyIdentity`, а не объединяет записи молча. Для тестового CLI достаточно строкового ID из однозначной фикстуры.

## 4. Существующий JSON профиля

```text
company_id
base_information
  profile
    org_type, ownership_form, age_band, development_stage, annual_revenue
    industry: okved_code, okved_name, industry_category, industry_category_source
    employees: fns_band, spark_band
    geography: city, region, fts_flag, fts_countries[]
    negative_mark_raw
  banking: client_type, products.{rko,guarantees,loans,leasing,deposits,payroll,factoring}
  market_position
    comparison_okved, comparison_level, industry_peer_count
    industry_revenue_total_in_dataset, revenue_share_in_dataset
    revenue_percentile, revenue_rank, revenue_to_industry_median
    calculation_scope, percentile_method
  corporate_group
    group_id, member_count, member_ids[], group_revenue_sum
    group_revenue_is_consolidated, group_industries[], group_regions[], top_members[]
  payments
    incoming, outgoing
      total_amount, payment_count, unique_counterparties, top1_share, top5_share
      same_group_payment_amount, same_group_payment_share
      counterparties_with_profile, counterparties_without_profile
      payment_amount_with_known_counterparty_profile
      top_counterparties[]: company_id, okved_code, okved_name, region,
        annual_revenue, same_group, profile_available, payment_amount, payment_count, share
      known_counterparty_industries[], known_counterparty_regions[]
    unique_external_counterparties
  person_links
    linked_person_count, linked_person_ids[], linked_people[]
    related_company_count, related_companies[]
  data_quality
    sources, payment_period, payment_currency, revenue_reporting_period, revenue_currency
    market_share_is_dataset_relative, has_unresolved_company_id_conflict
    self_payments_excluded, excluded_self_payment_rows, excluded_self_payment_amount
    excluded_self_payment_count, group_revenue_is_not_consolidated
    person_link_role_unspecified, payment_purpose_unspecified
    counterparty_profile_coverage_incoming, counterparty_profile_coverage_outgoing
web_research: {}
alfa_analytics: {}
```

Подробные значения вложенных полей есть в `database/data/README_json.md`. Фактический генератор использует источники `companies`, `payments`, `person_company_links`, `calculation_scope="companies_table_only"` и `industry_category_source="derived_from_okved_section_not_from_database"`. Старый README местами описывает CSV и другой литерал источника категории.

`unique_external_counterparties` в текущем коде исключает собственный ID, но **включает другие компании своей группы**. Слово external нельзя интерпретировать как «вне группы». Доли top-1/top-5 также включают внутригрупповые связи. Точную концентрацию только вне группы нельзя в общем случае пересчитать из усечённого top-10.

## 5. Предлагаемые модели v1

Сначала реализовать типизированные модели и JSON Schema. Примеры ниже определяют смысл контрактов; окончательный машинный формат фиксируется в промпте 1.

| Модель | Минимальное содержание |
| --- | --- |
| `BaseCompanyProfile` | `schema_version`, `company_id`, `base_information`, `source`, `source_updated_at`, `profile_hash`, `warnings[]` |
| `Exposure` | `exposure_id`, `factor`, `feature_refs[]`, `observed_values`, `rule_id`, `rule_version`, `reason`, `assumptions[]`, `missing_fields[]`, `priority` |
| `SearchTask` | `task_id`, `exposure_ids[]`, `question`, `query`, `source_kind`, `filters`, `priority`, `reason`, `expected_evidence`, `max_results` |
| `EvidenceRecord` | `evidence_id`, `document_id`, `source_kind`, `title`, `publisher`, `url`, `published_at`, `retrieved_at`, `event_at`, `excerpt`, `content_hash`, `page_number`, `date_status`, `content_status` |
| `CompanyResearchContext` | `schema_version`, `company_id`, `profile_hash`, `as_of`, `window`, `exposures[]`, `tasks[]`, `evidence[]`, `coverage`, `gaps[]`, `versions`, `expires_at` |
| `Insight` | `insight_id`, `event`, `ai_interpretation`, `company_relevance`, `role_relevance`, `impact_chain[]`, `bank_view`, `risks[]`, `opportunities[]`, `suggested_actions[]`, `assumptions[]`, `uncertainty`, `evidence_refs[]`, `evidence_sources[]`, `feature_refs[]`, `rank` |
| `AnalysisResult` | `schema_version`, `job_id`, `run_id`, `company_id`, `company_row_id`, `role`, `goal`, `as_of`, `mode`, `outcome`, `insights[]`, `evidence[]`, `profile_snapshot`, `research_context`, `warnings[]`, `trace[]`, `usage`, `versions` |

Правила:

- `get_company_profile(company_id: str) -> BaseCompanyProfile` одинаков для JSON и Supabase. Выбор адаптера — в конфигурации. `source_updated_at` — версия хранения, не отчётный период выручки. Для локального JSON без бизнес-даты она может быть `null`; хэш остаётся доступен.
- Отсутствующий контекст существующей компании — `ProfileNotPrepared`; отсутствующая компания — `CompanyNotFound`; сбой сети — `ProfileStoreUnavailable`. Не запускать пакетный генератор автоматически.
- Getter не переписывает JSON ради новой оболочки. Отдельный writer обновляет `web_research` и позже `alfa_analytics` в существующем payload. `profile_hash` вычисляется только по канонизированному базовому содержимому, без временных меток и результатов поиска; обновление исследования не меняет этот хэш.
- `feature_refs` — проверяемые пути в снимке профиля, например `/base_information/banking/products/loans`. Это не веб-ссылки.
- `source_kind` различает `news`, `official_release`, `bank_research`, `fixture`. Факт события, позиция банка и AI-интерпретация — отдельные поля результата, даже если используют общий источник.
- `published_at`, `event_at`, `page_number` допускают `null`; `retrieved_at` обязателен. Не подставлять дату получения вместо публикации. `page_number` PDF — номер с 1.
- `content_status`: например `full_text`, `excerpt_only`, `fetch_failed`; `date_status`: `known`, `unknown`, `archived`. Частичный текст не считается прочитанной статьёй целиком.
- У `bank_view` есть `status`, текст, дата отчёта и `evidence_refs`. В веб-MVP до шага 7 PDF-provider отключён: `status="unavailable"` — штатный результат, который сам по себе не означает `partial`. После подключения банка мнение допускается только по первичному банковскому evidence. Памятка — вторичный материал для настройки методики.
- `impact_chain` связывает событие, наблюдаемый признак, возможный механизм и последствие. У каждого фактического утверждения — ссылки на evidence или профиль; гипотезы явно обозначены.
- `uncertainty` — объяснение ограничений и словесный уровень обоснованности, не некалиброванная вероятность от LLM.
- `outcome`: `ok`, `partial`, `no_relevant_evidence`, `failed`. Ноль инсайтов допустим. Отсутствие релевантных материалов и недоступность всех источников — разные исходы.
- Все идентификаторы источников назначает код. URL, цитаты и номера страниц разрешаются из `EvidenceRecord`, а не придумываются генератором.

## 6. Предлагаемый интерфейс с бэкендом

Первый транспорт — внутренний HTTP endpoint, выполняющий ограниченное по времени исследование. Общая бизнес-функция `analyze(request, on_event)` не зависит от FastAPI. Вызов из бэкенда должен выполняться его worker/task, чтобы запрос браузера не ожидал весь анализ.

```json
{
  "schema_version": "1.0",
  "job_id": "b0ec365b-2200-49d8-a02e-32505e16ef6a",
  "company_row_id": 123,
  "company_id": "U_EXAMPLE",
  "role": "cfo",
  "goal": "Оценить возможные изменения стоимости финансирования",
  "as_of": "2026-09-15T12:00:00+03:00",
  "lookback_days": 30,
  "max_insights": 5
}
```

Это искусственный пример формы запроса; соответствие `123` и `U_EXAMPLE` не утверждается. В рабочем режиме default `as_of` — время запроса, в воспроизводимом демо дата задаётся явно. Нельзя незаметно смешивать сентябрьский кейс с новостями после даты анализа.

| Предлагаемый endpoint | Назначение |
| --- | --- |
| `POST /internal/analyze` | `AnalysisResult` после завершения; первый интеграционный endpoint |
| `POST /internal/analyze/stream` | Позднее: тот же запуск, поток NDJSON с прогрессом и финальным результатом |
| `POST /internal/news/search` | Поиск кандидатов по `SearchTask`; вызывается при отладке/интеграции, pipeline использует ту же Python-функцию |
| `POST /internal/followup` | Ответ на вопрос по сохранённому результату и источникам |
| `GET /health` | Доступность процесса; отдельные проверки провайдеров не должны скрывать запуск приложения |

В первой версии `session_id = job_id`. Бэкенд хранит `AnalysisResult` в существующем `analysis_jobs.result`, задаёт `id` сам и обновляет `updated_at` явно. Предлагаемые job-status: `pending`, `running`, `completed`, `failed`. `partial` и `no_relevant_evidence` относятся к `result.outcome`; они не требуют отдельного статуса задания.

`StageEvent`: `schema_version`, `job_id`, `run_id`, `seq`, `stage`, `state`, `at`, `summary`, `counters`. Стадии: `loading_profile`, `mapping_exposures`, `planning`, `retrieving`, `analyzing`, `validating`, `completed`. Ошибка представляется типизированным событием и итогом. Порядковый номер позволяет обнаруживать пропуски и повторения.

Синхронный endpoint не обещает промежуточные стадии по HTTP. На раннем этапе их видит CLI/лог и `on_event`; после добавления stream бэкенд читает события и сохраняет `stage`. Одно задание запускается через один транспорт, а не одновременно через оба endpoint.

Авторизацию пользователя, принадлежность компании и доступ к `job_id` проверяет бэкенд. ML endpoint доступен только доверенному backend-сервису с серверной аутентификацией. Числовая роль пользователя в приложении и бизнес-роль `cfo` не подменяют проверку доступа.

## 7. Расширенный контекст в JSON компании и результат задания

Базовая подготовка выполняется один раз. Один `company_contexts.payload` содержит
базовую информацию и актуальное расширенное исследование:

```text
company_id
base_information                 исходные признаки; исследование их не меняет
web_research
  context                        CompanyResearchContext: evidence, exposures, tasks,
                                 coverage/gaps, profile_hash, as_of/window,
                                 versions и expires_at
  scope                          role, нормализованный goal, настройки исследования
  refreshed_at                   дата успешного обновления блока
alfa_analytics                    пока {}; подключается в шаге 7
  context                        банковские evidence, страницы, версии и coverage
  scope                          параметры совместимости исследования
  refreshed_at                   дата успешного обновления блока
```

Это предлагаемый формат хранения для следующих итераций; текущий getter итерации 1
его ещё не записывает. `alfa_analytics.context` нужно типизировать при реализации
банковского модуля, сохранив общий EvidenceRecord.

1. `get_company_profile` остаётся операцией чтения. Отдельный
   `ResearchContextRepository` читает и заменяет блоки расширенного контекста.
2. Первый веб-проход заполняет `web_research`; refresh, истечение срока или
   несовпадение profile_hash/scope заменяют весь этот блок. Использовать атомарное
   обновление выбранного JSONB-поля и `updated_at`, сохраняя `base_information`,
   `alfa_analytics` и остальные поля. Не перезаписывать целиком payload копией,
   прочитанной до исследования, и не накапливать устаревшие новости в текущем блоке.
3. Свежий совместимый контекст можно переиспользовать. Scope обязателен, если поиск
   учитывает роль/цель: последний CFO-контекст нельзя автоматически использовать
   как CEO-исследование. В MVP хранится последний контекст, без истории в company JSON.
4. Полный отказ источников не заменяет пригодный контекст пустым. Успешный поиск
   без релевантных результатов может сохранить пустой контекст с честным coverage.
   Ошибка сохранения не маскируется; права UPDATE проверяются отдельно.
5. После первых веб-инсайтов шаг 7 добавляет PDF-provider. Он обновляет целиком
   `alfa_analytics`, сохраняя `web_research` и базовую информацию. Выключенный
   provider не мешает веб-запуску и не требует наличия PDF-файлов.
6. Бэкенд сохраняет инсайты и снимок использованного контекста/evidence внутри
   существующего `analysis_jobs.result`. Обновление company JSON не меняет result
   старого задания: ссылки на старые тезисы разрешаются по снимку этого задания.
7. ML держит ограниченный локальный кэш публичных документов/индекса. Полные статьи
   и весь граф в JSON результата не копируются; короткие evidence и использованные
   признаки сохраняются для объяснения. Отдельная таблица инсайтов пока не нужна.

Текущий `base_context.py` целиком заменяет payload, поэтому его не вызывают из
исследования: это однократная базовая подготовка. Если позже понадобится массовая
перегенерация базы, её отдельной задачей нужно научить сохранять или явно
инвалидировать исследовательские блоки. Сейчас это не зависимость веб-MVP.

## 8. Настройки Supabase

Переиспользовать текущие `POSTGRES_*` без вывода значений в логи. Добавить явный режим соединения; не выбирать порт скрыто. Для длительно работающего сервиса использовать совместимый direct/session pooler, для transaction pooler учитывать его ограничения и отключать prepared statements в psycopg (`prepare_threshold=None`). Использовать SSL, небольшой пул и timeout. Отсутствующая удалённая конфигурация должна давать понятную ошибку, а не подключение к localhost.

Параметры режима проверены по [документации Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres). Правила доступа учитывают различие [RLS и ролей сервиса](https://supabase.com/docs/guides/database/postgres/row-level-security). Административные ключи не передаются в браузер, LLM или поисковый провайдер.
