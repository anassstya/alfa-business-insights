# Веб-MVP, итерация 6

Рабочая цепочка: профиль → exposures → план → веб-источники → один вызов
Impact Analyzer → механическая проверка → результат. Банк отключён:
`bank_view.status=unavailable`; это штатный результат. Тексты источников,
профиль и цель передаются модели только как данные. Проверка цитат и ссылок
не доказывает смысловую истинность выводов.

Запуск для одной компании (подставить существующие `synthetic_u` и числовой
`companies.id`, дату и UUID задания):

```json
{
  "schema_version": "1.0",
  "job_id": "b0ec365b-2200-49d8-a02e-32505e16ef6a",
  "company_id": "U_EXAMPLE",
  "company_row_id": 123,
  "role": "cfo",
  "goal": "Оценить возможное влияние новых условий финансирования",
  "as_of": "2026-10-25T12:00:00+03:00",
  "lookback_days": 30,
  "max_insights": 5,
  "refresh_web_research": false
}
```

Сохранить JSON как `request.json`, затем:

```powershell
python -m ml.src.analyze_cli --mode live request.json
python -m uvicorn ml.src.service:app --host 127.0.0.1 --port 8001
```

HTTP: `POST /internal/analyze` с этим JSON и заголовком
`Authorization: Bearer <ML_SERVICE_TOKEN>`. Fixture запускается явно через
`ML_FIXTURE_MODE=true` или CLI `--mode fixture`; fixture не подтверждает live.
Секреты читаются из окружения или существующего `.env`, не включаются в запрос.

Успешный ответ имеет `mode=live`, `outcome=ok`, до пяти `insights`, краткие
`evidence`, `profile_snapshot`, `research_context`, `trace`, `versions` и `usage`.
У каждого инсайта есть `event`, `ai_interpretation`, `bank_view`,
`impact_chain`, `evidence_refs`, `evidence_sources` с URL/датой/цитатой и
`feature_refs`. Пример фрагмента:

```json
{
  "mode": "live",
  "outcome": "ok",
  "insights": [{
    "event": "Изменились условия кредитования",
    "ai_interpretation": "Возможное влияние зависит от будущей потребности в финансировании",
    "bank_view": {"status": "unavailable", "text": null, "report_at": null, "evidence_refs": []},
    "impact_chain": ["Событие", "Подтверждённый признак", "Условный механизм", "Возможное последствие"],
    "evidence_refs": ["ev-..."],
    "evidence_sources": [{"evidence_id": "ev-...", "url": "https://example.org/news",
      "page_number": null, "published_at": "2026-10-25T00:00:00+00:00", "quote": "Цитата из источника"}],
    "feature_refs": ["/base_information/banking/products/loans"]
  }]
}
```

Это форма ответа, а не утверждение о реальной новости. Если материалов нет,
ответ содержит `outcome=no_relevant_evidence` и пустые инсайты. Полный сбой
источников возвращает `failed` или использует прежний совместимый контекст с
`partial` и явным предупреждением. Ошибка записи блока также видна в результате.

`web_research` содержит `context`, `scope`, `refreshed_at`. Scope включает роль,
нормализованную цель, окно, дату, модель, provider, лимит задач и версии правил/плана. Совместимый свежий блок
переиспользуется. `refresh_web_research=true`, изменение scope/profile hash или
истечение TTL запускают новое исследование. Writer проверяет право UPDATE и
заменяет только `payload.web_research` атомарным `jsonb_set`; backend сохраняет
полный `AnalysisResult` в `analysis_jobs.result`. Снимок старого result не
меняется после refresh. Для офлайн-проверок использовать маленький временный
JSON и `JsonResearchContextRepository`; полный исходный JSON не переписывать.
