"""Regenerate proposed v1 JSON Schemas without accessing the database."""

import json
from pathlib import Path

from .contracts import MODELS
from .analysis_chat import ChatRequest, ChatResponse


def main() -> None:
    output = Path(__file__).resolve().parents[1] / "docs/contracts"
    output.mkdir(parents=True, exist_ok=True)
    for model in (*MODELS, ChatRequest, ChatResponse):
        (output / f"{model.__name__}.schema.json").write_text(
            json.dumps(model.model_json_schema(), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


if __name__ == "__main__":
    main()
