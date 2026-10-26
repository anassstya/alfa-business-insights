"""Asynchronous company-insight analysis orchestration for the ML service."""
from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

from api import call_model
from tool.db_tool import DatabaseTools

logger = logging.getLogger(__name__)

BACKEND_EVENTS_URL = os.getenv(
    "BACKEND_EVENTS_URL",
    "http://backend:8080/api/v1/internal/analysis/events",
)
MODEL_NAME = os.getenv("MODEL_NAME", "deepseek/deepseek-v4.1-flash")
VALID_ROLES = {"owner", "accountant", "ceo", "treasurer", "cfo", "other_c_level", "decision_maker"}


def _send_event(job_id: str, status: str, stage: str, **extra: Any) -> None:
    """Send a best-effort status/result callback to the Go backend."""
    payload: dict[str, Any] = {"job_id": job_id, "status": status, "stage": stage}
    payload.update(extra)
    try:
        timeout = httpx.Timeout(5.0, connect=2.0)
        response = httpx.post(BACKEND_EVENTS_URL, json=payload, timeout=timeout)
        response.raise_for_status()
    except Exception:
        # The callback is best-effort; keep the analysis running and log the failure.
        logger.exception("Could not send analysis event for job %s", job_id)


def run_analysis(job_id: str, company_id: str, role: str, document_store) -> None:
    """Run analysis in a background worker and report progress to the backend."""
    try:
        _send_event(job_id, "running", "loading_company_data")
        with DatabaseTools.from_env() as database:
            company = database.find_rows("companies", "synthetic_u", company_id, limit=1)
            if not company["rows"]:
                raise ValueError(f"Company {company_id!r} was not found in the companies table")
            company_row = company["rows"][0]

            _send_event(job_id, "running", "searching_documents")
            query = (
                f"{company_id} {company_row.get('mainokved_name') or ''} "
                f"{company_row.get('region') or ''} {role} business risks financial performance"
            )
            documents = document_store.search(query, top_k=6)

            _send_event(job_id, "running", "generating_insights")
            prompt = f"""Подготовь аналитические инсайты для компании на основе только переданных данных.
Роль пользователя: {role}.
Компания: {company_id}.
Данные из таблицы companies:
{json.dumps(company_row, ensure_ascii=False, default=str)}

Фрагменты справочных PDF (могут быть нерелевантны; не выдумывай факты):
{json.dumps(documents, ensure_ascii=False, default=str)}

Верни JSON-объект с полями:
{{"summary": "краткое резюме", "insights": [{{"title":"...", "description":"...", "importance":"high|medium|low", "evidence":["..."], "recommendation":"..."}}], "limitations": ["..." ]}}
Сформируй до 5 инсайтов. Не называй корреляцию причиной. Если данных недостаточно, явно укажи это в limitations и не придумывай цифры.
Верни только JSON без Markdown-ограждения."""
            answer = call_model(prompt, model=MODEL_NAME,
                                system_prompt="Ты аналитический помощник для корпоративных финансов. Не выдумывай данные.")
            try:
                result = json.loads(answer)
                if not isinstance(result, dict):
                    raise ValueError("Model response must be a JSON object")
            except (json.JSONDecodeError, ValueError):
                # Preserve the model output for debugging rather than pretending it is valid structured JSON.
                result = {"summary": "Модель вернула ответ в неструктурированном формате.",
                          "insights": [], "limitations": ["Ответ модели не удалось разобрать как JSON."],
                          "raw_answer": answer}

        _send_event(job_id, "completed", "completed", result=result)
    except Exception as exc:
        logger.exception("Analysis job %s failed", job_id)
        _send_event(job_id, "failed", "failed", error={"message": str(exc), "type": type(exc).__name__})
