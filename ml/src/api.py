"""Простой клиент для вызова моделей из ML-кода."""

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI


BASE_URL = "https://api.alfahack-gateway26.ru/v1"
DEFAULT_MODEL = "deepseek/deepseek-v4.1-flash"


def call_model(
    prompt: str,
    model: str = DEFAULT_MODEL,
    system_prompt: str | None = None,
) -> str:
    """Вернуть ответ модели на пользовательский и необязательный системный промпт."""
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    api_key = os.getenv("MODEL_API_KEY")
    if not api_key:
        raise RuntimeError("Укажите MODEL_API_KEY в .env или переменных окружения")

    client = OpenAI(api_key=api_key, base_url=BASE_URL)
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    response = client.chat.completions.create(
        model=model,
        messages=messages,
    )
    return response.choices[0].message.content or ""


def main() -> None:
    parser = argparse.ArgumentParser(description="Отправить запрос модели")
    parser.add_argument(
        "prompt",
        nargs="?",
        default="Ответь одним предложением: подключение работает?",
        help="Пользовательский промпт",
    )
    parser.add_argument("--system", dest="system_prompt", help="Системный промпт")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Название модели")
    args = parser.parse_args()
    print(call_model(args.prompt, model=args.model, system_prompt=args.system_prompt))


if __name__ == "__main__":
    main()
