"""One env source: process, then root .env; standalone ML file is a fallback."""

from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]


def load_runtime_environment() -> None:
    shared = ROOT / '.env'
    source = shared if shared.is_file() else ROOT / 'ml' / 'docker.example'
    load_dotenv(source, override=False)
