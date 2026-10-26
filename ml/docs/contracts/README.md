# Предлагаемый ML-контракт v1

Файлы `*.schema.json` сгенерированы из `ml.src.contracts` командой
`python -m ml.src.export_contracts`. Это **предложенный формат обмена** между ML
и бэкендом, а не существующая SQL-схема Supabase. Бизнес-содержимое
`base_information` остаётся структурой текущего генератора; оболочка добавляет
версию, источник, дату хранения, SHA-256 от канонического `base_information` и
предупреждения. `source_updated_at` не является датой финансовой отчётности.

`company_id` — `synthetic_u`, `company_row_id` — `companies.id`. Роли v1:
`accountant`, `ceo`, `cfo`, `decision_maker`, `other_c_level`, `owner`,
`treasurer`. Все ненулевые даты содержат часовой пояс. Неизвестные даты
публикации и события остаются `null`; дата получения обязательна.

`outcome=ok` требует хотя бы один инсайт. `partial` допускает ноль или несколько
инсайтов при недоступном источнике, исчерпанном бюджете или неполном покрытии.
`no_relevant_evidence` означает, что доступные источники проверены и релевантных
материалов нет. `failed` означает, что анализ выполнить не удалось; у этих двух
исходов инсайтов нет. `analysis_jobs.status` управляется бэкендом отдельно.

`AnalysisResult.mode` равен `fixture` только для явно включённого
демонстрационного pipeline; значение `live` оставлено по умолчанию для
совместимости старых экземпляров модели. HTTP-сервис поддерживает live и явный fixture-режим. Полный fixture ответ: [../fixture_response.json](../fixture_response.json).

Примеры ниже показывают форму отдельных сообщений. Для полной формы и
ограничений используйте схемы.

```json
{"schema_version":"1.0","company_id":"U_EXAMPLE","base_information":{"profile":{},"banking":{},"market_position":{},"corporate_group":{},"payments":{},"person_links":{},"data_quality":{}},"source":"json","source_updated_at":null,"profile_hash":"0000000000000000000000000000000000000000000000000000000000000000","warnings":[]}
```

```json
{"schema_version":"1.0","job_id":"b0ec365b-2200-49d8-a02e-32505e16ef6a","company_row_id":123,"company_id":"U_EXAMPLE","role":"cfo","goal":null,"as_of":"2026-09-15T12:00:00+03:00","lookback_days":30,"max_insights":5}
```

```json
{"schema_version":"1.0","job_id":"b0ec365b-2200-49d8-a02e-32505e16ef6a","run_id":"a2116db1-ae88-4904-91b0-65ab82e6843d","company_id":"U_EXAMPLE","company_row_id":123,"role":"cfo","goal":null,"as_of":"2026-09-15T12:00:00+03:00","outcome":"no_relevant_evidence","insights":[],"evidence":[],"profile_snapshot":null,"research_context":null,"warnings":[],"trace":[],"usage":{},"versions":{}}
```

```json
{"schema_version":"1.0","job_id":"b0ec365b-2200-49d8-a02e-32505e16ef6a","run_id":"a2116db1-ae88-4904-91b0-65ab82e6843d","seq":1,"stage":"loading_profile","state":"started","at":"2026-09-15T12:00:00+03:00","summary":"Loading profile","counters":{}}
```

Контракты чата `ChatRequest` и `ChatResponse` сгенерированы из
`ml.src.analysis_chat` той же командой экспорта. Они описывают `job_id`, новый
вопрос, историю и ответ с источниками. [Инструкция чата](../CHAT_INTEGRATION.md).
