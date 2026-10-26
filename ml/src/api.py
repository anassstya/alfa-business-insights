"""Gateway client for the allowed runtime model and compatible call_model CLI."""

from __future__ import annotations

import argparse
import json
import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import TypeVar

from .runtime_environment import load_runtime_environment
from openai import APIConnectionError, APITimeoutError, OpenAI, RateLimitError, APIStatusError
from pydantic import BaseModel, ValidationError

from .budget import BudgetManager

BASE_URL = "https://api.alfahack-gateway26.ru/v1"
DEFAULT_MODEL = "deepseek/deepseek-v4.1-flash"
ALLOWED_MODELS = {DEFAULT_MODEL}
T = TypeVar("T", bound=BaseModel)
_semaphore = threading.BoundedSemaphore(2)


class ModelError(Exception):
    pass


class ModelConfigurationError(ModelError):
    pass


class ModelTransportError(ModelError):
    pass


class ModelFormatError(ModelError):
    pass


@dataclass(frozen=True)
class ModelSettings:
    api_key: str
    model: str = DEFAULT_MODEL
    timeout: float = 60.0
    native_schema_confirmed: bool = False

    @classmethod
    def from_environment(cls, model: str | None = None) -> "ModelSettings":
        load_runtime_environment()
        key = os.getenv("MODEL_API_KEY")
        if not key:
            raise ModelConfigurationError("MODEL_API_KEY is missing")
        return cls(api_key=key, model=model or os.getenv("ML_MODEL") or DEFAULT_MODEL,
                   timeout=float(os.getenv("ML_MODEL_TIMEOUT", "60")),
                   native_schema_confirmed=os.getenv("ML_NATIVE_SCHEMA_CONFIRMED", "false").lower() == "true")


def _estimate_tokens(messages: list[dict]) -> int:
    # Conservative reservation; gateway usage is recorded separately if returned.
    return max(1, sum(len(str(m.get("content", ""))) for m in messages) // 3 + 100)


class GatewayClient:
    def __init__(self, settings: ModelSettings, client=None):
        if settings.model not in ALLOWED_MODELS:
            raise ModelConfigurationError("runtime model is not in the configured case allowlist")
        if not 0 < settings.timeout <= 120:
            raise ModelConfigurationError("invalid model timeout")
        self.settings = settings
        self.client = client or OpenAI(api_key=settings.api_key, base_url=BASE_URL,
                                      timeout=settings.timeout, max_retries=0)
        self.attempts = 0

    def complete(self, messages: list[dict], budget: BudgetManager, *, output_tokens: int = 1200,
                 schema: type[BaseModel] | None = None) -> str:
        transient = (APIConnectionError, APITimeoutError, RateLimitError)
        for attempt in range(2):
            budget.reserve_llm(_estimate_tokens(messages), output_tokens)
            self.attempts += 1
            kwargs = {"model": self.settings.model, "messages": messages,
                      "max_tokens": output_tokens,
                      "timeout": min(self.settings.timeout, budget.remaining())}
            if schema is not None and self.settings.native_schema_confirmed:
                kwargs["response_format"] = {"type": "json_schema", "json_schema": {
                    "name": schema.__name__, "schema": schema.model_json_schema(), "strict": True}}
            try:
                with _semaphore:
                    budget.remaining()
                    response = self.client.chat.completions.create(**kwargs)
                usage = getattr(response, "usage", None)
                budget.record_llm(getattr(usage, "prompt_tokens", None),
                                  getattr(usage, "completion_tokens", None))
                return response.choices[0].message.content or ""
            except transient as exc:
                if attempt or budget.remaining() <= 0:
                    raise ModelTransportError(type(exc).__name__) from exc
            except APIStatusError as exc:
                if exc.status_code >= 500 and not attempt:
                    continue
                raise ModelTransportError(f"gateway_http_{exc.status_code}") from exc
        raise ModelTransportError("gateway_retry_exhausted")

    def structured(self, messages: list[dict], schema: type[T], budget: BudgetManager,
                   *, output_tokens: int = 1200) -> T:
        request = list(messages)
        if not self.settings.native_schema_confirmed:
            request.append({"role": "system", "content": "Return only one JSON object matching this schema: " +
                            json.dumps(schema.model_json_schema(), ensure_ascii=False)})
        for repair in range(2):
            raw = self.complete(request, budget, output_tokens=output_tokens, schema=schema)
            try:
                return schema.model_validate(json.loads(raw))
            except (ValueError, ValidationError) as exc:
                if repair:
                    raise ModelFormatError("model returned invalid JSON or schema") from exc
                request += [{"role": "assistant", "content": raw[:4000]},
                            {"role": "user", "content": "Correct format once. Return only valid JSON matching the schema."}]
        raise ModelFormatError("model returned invalid JSON or schema")


def call_model(prompt: str, model: str | None = None, system_prompt: str | None = None) -> str:
    """Legacy entry point, now routed through the bounded gateway client."""
    settings = ModelSettings.from_environment(model)
    messages = ([{"role": "system", "content": system_prompt}] if system_prompt else [])
    messages.append({"role": "user", "content": prompt})
    return GatewayClient(settings).complete(messages, BudgetManager(max_llm_calls=2), output_tokens=1200)


def main() -> None:
    parser = argparse.ArgumentParser(description="Отправить запрос модели")
    parser.add_argument("prompt", nargs="?", default="Ответь одним предложением: подключение работает?")
    parser.add_argument("--system", dest="system_prompt")
    parser.add_argument("--model", default=None)
    args = parser.parse_args()
    print(call_model(args.prompt, model=args.model, system_prompt=args.system_prompt))


if __name__ == "__main__":
    main()
