import os
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.getenv("ML_DATA_DIR", str(BASE_DIR / "data")))
PDF_DIR = DATA_DIR / "reference_pdfs"
PROCESSED_DIR = DATA_DIR / "processed"
CHUNKS_PATH = PROCESSED_DIR / "document_chunks.jsonl"

CHUNK_SIZE = 800
CHUNK_OVERLAP = 120
MIN_TEXT_LENGTH = 50
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
OCR_LANGUAGE = os.getenv("OCR_LANGUAGE", "rus+eng")
TESSERACT_CMD = os.getenv("TESSERACT_CMD") or shutil.which("tesseract") or r"C:\Program Files\Tesseract-OCR\tesseract.exe"
