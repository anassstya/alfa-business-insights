"""Publish job progress/results through the existing Go backend callback only."""

from __future__ import annotations

import argparse
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit
from uuid import UUID, uuid4

import httpx
from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, model_validator

from .contracts import AnalysisRequest, AnalysisResult, StageEvent
from .profile_repository import ROOT
from .result_sources import resolve_result_sources

MAX_CALLBACK_BYTES = 1 << 20  # Existing Go handler's MaxBytesReader limit.
DEFAULT_OUTBOX = ROOT / "ml/.cache/callbacks"


class CallbackError(Exception):
    pass


class CallbackEvent(BaseModel):
    # Go's decoder rejects unknown fields. Keep run_id/seq/trace inside result.
    model_config = ConfigDict(extra="forbid")
    job_id: UUID
    status: Literal["pending", "running", "completed", "failed"]
    stage: str | None = None
    result: AnalysisResult | None = None
    error_message: str | None = None

    @model_validator(mode="after")
    def check_result(self):
        if self.result is not None:
            if self.result.job_id != self.job_id:
                raise ValueError("callback/result job_id mismatch")
            expected = "failed" if self.result.outcome == "failed" else "completed"
            if self.status != expected:
                raise ValueError("callback status does not match result outcome")
        return self


@dataclass(frozen=True)
class CallbackSettings:
    enabled: bool = False
    url: str = "http://127.0.0.1:8080/api/v1/internal/analysis/events"
    token: str = ""
    timeout: float = 5.0

    @classmethod
    def from_environment(cls, environ=None):
        if environ is None:
            load_dotenv(ROOT / ".env", override=False)
            environ = os.environ
        return cls(
            enabled=environ.get("ML_CALLBACK_ENABLED", "false").lower() in ("1", "true", "yes"),
            url=environ.get("ML_CALLBACK_URL") or cls.url,
            token=environ.get("ML_CALLBACK_TOKEN") or "",
            timeout=float(environ.get("ML_CALLBACK_TIMEOUT", "5")),
        )

    def validate(self):
        parsed = urlsplit(self.url)
        if not self.token:
            raise CallbackError("ML_CALLBACK_TOKEN is required when callbacks are enabled")
        if parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.username or parsed.password:
            raise CallbackError("invalid ML_CALLBACK_URL")
        if not 0 < self.timeout <= 30:
            raise CallbackError("ML_CALLBACK_TIMEOUT must be between 0 and 30 seconds")


class BackendCallbackClient:
    def __init__(self, settings: CallbackSettings, client=None):
        settings.validate()
        self.settings = settings
        self.client = client or httpx.Client(timeout=settings.timeout, trust_env=False,
                                             follow_redirects=False)
        self.owns_client = client is None

    def close(self):
        if self.owns_client:
            self.client.close()

    def send(self, event: CallbackEvent):
        body = event.model_dump_json(exclude_none=True).encode("utf-8")
        if len(body) > MAX_CALLBACK_BYTES:
            raise CallbackError("callback exceeds the backend's 1 MiB body limit")
        for attempt in range(2):
            try:
                response = self.client.post(
                    self.settings.url, content=body,
                    headers={"Authorization": f"Bearer {self.settings.token}",
                             "Content-Type": "application/json"},
                    timeout=self.settings.timeout,
                )
            except httpx.HTTPError:
                code = "callback_network_error"
            else:
                if 200 <= response.status_code < 300:
                    return
                code = f"callback_http_{response.status_code}"
                if response.status_code != 429 and response.status_code < 500:
                    raise CallbackError(code)
            if attempt:
                raise CallbackError(code)
            time.sleep(0.1)


def save_terminal_event(event: CallbackEvent, root: Path) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    path = root / f"{event.job_id}-{event.result.run_id}.json"
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(event.model_dump_json(exclude_none=True), encoding="utf-8")
    temporary.replace(path)
    return path


def analyze_with_callback(request: AnalysisRequest, analyze, callback=None,
                          on_event=None, outbox: Path = DEFAULT_OUTBOX) -> AnalysisResult:
    """analyze(on_stage) may construct the pipeline; setup failures also reach backend."""
    last_stage = "loading_profile"
    delivery_warnings = []
    if callback is not None:
        # Confirm that backend knows this job before charging for search/model calls.
        callback.send(CallbackEvent(job_id=request.job_id, status="running", stage=last_stage))

    def report(event: StageEvent):
        nonlocal last_stage
        if on_event:
            on_event(event)
        # Research's internal completion is not completion of the whole analysis.
        if callback is None or event.stage == "completed" or event.stage == last_stage:
            return
        last_stage = event.stage
        try:
            callback.send(CallbackEvent(job_id=request.job_id, status="running", stage=event.stage))
        except CallbackError as exc:
            delivery_warnings.append(str(exc))

    try:
        result = resolve_result_sources(analyze(report))
        if result.job_id != request.job_id:
            raise ValueError("pipeline result job_id mismatch")
    except Exception as exc:
        result = AnalysisResult(
            job_id=request.job_id, run_id=uuid4(), company_id=request.company_id,
            company_row_id=request.company_row_id, role=request.role, goal=request.goal,
            as_of=request.as_of, outcome="failed",
            warnings=[f"analysis_exception:{type(exc).__name__}"],
        )
    if delivery_warnings:
        result = result.model_copy(update={"warnings": result.warnings +
                                          ["progress_callback_failed:" + x for x in dict.fromkeys(delivery_warnings)]})
    if callback is not None:
        terminal = CallbackEvent(
            job_id=request.job_id,
            status="failed" if result.outcome == "failed" else "completed",
            stage="completed", result=result,
            error_message="analysis_failed; see result.warnings" if result.outcome == "failed" else None,
        )
        path = save_terminal_event(terminal, Path(outbox))
        callback.send(terminal)  # On failure retain the event for replay, without a new analysis.
        path.unlink()
    return result


def main():
    parser = argparse.ArgumentParser(description="Replay a pending terminal event without calling LLM/search")
    parser.add_argument("--replay", type=Path, required=True)
    args = parser.parse_args()
    event = CallbackEvent.model_validate_json(args.replay.read_text(encoding="utf-8"))
    if event.result is None or event.status not in ("completed", "failed"):
        parser.error("only terminal events with a result may be replayed")
    callback = BackendCallbackClient(CallbackSettings.from_environment())
    try:
        callback.send(event)
    finally:
        callback.close()
    print(json.dumps({"job_id": str(event.job_id), "status": event.status, "delivered": True}))


if __name__ == "__main__":
    main()
