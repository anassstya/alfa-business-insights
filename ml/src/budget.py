"""Per-run resource limits; these do not enforce the team's shared gateway quota."""

from __future__ import annotations

import threading
import time
import math
import os
from dataclasses import dataclass, field


class BudgetExceeded(Exception):
    pass


DEFAULT_ANALYSIS_TIMEOUT_SECONDS = 600.0


def analysis_timeout_seconds() -> float:
    """Configured deadline for the live web analysis, excluding chat budgets."""
    raw = os.getenv("ML_ANALYSIS_TIMEOUT_SECONDS", str(DEFAULT_ANALYSIS_TIMEOUT_SECONDS))
    try:
        timeout = float(raw)
    except (TypeError, ValueError) as exc:
        raise ValueError("ML_ANALYSIS_TIMEOUT_SECONDS must be a number") from exc
    if not math.isfinite(timeout) or not 1 <= timeout <= 600:
        raise ValueError("ML_ANALYSIS_TIMEOUT_SECONDS must be between 1 and 600")
    return timeout


@dataclass
class BudgetManager:
    timeout_seconds: float = 120
    max_llm_calls: int = 4
    max_input_tokens: int = 15000
    max_output_tokens: int = 9000
    max_tool_calls: int = 6
    max_search_tasks: int = 6
    cancelled: threading.Event = field(default_factory=threading.Event)
    started: float = field(default_factory=time.monotonic, init=False)
    llm_calls: int = 0
    tool_calls: int = 0
    search_tasks: int = 0
    reserved_input: int = 0
    reserved_output: int = 0
    actual_input: int = 0
    actual_output: int = 0
    reported_usage_calls: int = 0
    _lock: threading.Lock = field(default_factory=threading.Lock, init=False, repr=False)

    def remaining(self) -> float:
        if self.cancelled.is_set():
            raise BudgetExceeded("cancelled")
        left = self.timeout_seconds - (time.monotonic() - self.started)
        if left <= 0:
            raise BudgetExceeded("deadline_exceeded")
        return left

    def reserve_llm(self, input_tokens: int, output_tokens: int) -> None:
        with self._lock:
            self.remaining()
            if (self.llm_calls >= self.max_llm_calls or
                self.reserved_input + input_tokens > self.max_input_tokens or
                self.reserved_output + output_tokens > self.max_output_tokens):
                raise BudgetExceeded("llm_budget_exceeded")
            self.llm_calls += 1
            self.reserved_input += input_tokens
            self.reserved_output += output_tokens

    def record_llm(self, input_tokens: int | None, output_tokens: int | None) -> None:
        with self._lock:
            if input_tokens is not None and output_tokens is not None:
                self.actual_input += input_tokens
                self.actual_output += output_tokens
                self.reported_usage_calls += 1

    def reserve_tasks(self, count: int) -> None:
        with self._lock:
            self.remaining()
            if count > self.max_search_tasks or self.search_tasks + count > self.max_search_tasks:
                raise BudgetExceeded("search_task_budget_exceeded")
            self.search_tasks += count

    def reserve_tool(self) -> None:
        with self._lock:
            self.remaining()
            if self.tool_calls >= self.max_tool_calls:
                raise BudgetExceeded("tool_budget_exceeded")
            self.tool_calls += 1

    def usage(self) -> dict:
        return {"llm_calls": self.llm_calls, "tool_calls": self.tool_calls,
                "search_tasks": self.search_tasks, "input_tokens_reserved": self.reserved_input,
                "output_tokens_reserved": self.reserved_output,
                "input_tokens_actual": self.actual_input,
                "output_tokens_actual": self.actual_output,
                "usage_reported_calls": self.reported_usage_calls,
                "usage_status": "actual" if self.reported_usage_calls == self.llm_calls else "partly_estimated",
                "cost_rub": None, "shared_team_limit_enforced": False}
