import os
import shutil

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "intfloat/multilingual-e5-small")
CHUNK_SIZE = 800
CHUNK_OVERLAP = 120
MIN_TEXT_LENGTH = 50
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
OCR_LANGUAGE = os.getenv("OCR_LANGUAGE", "rus+eng")
TESSERACT_CMD = os.getenv("TESSERACT_CMD") or shutil.which("tesseract") or r"C:\Program Files\Tesseract-OCR\tesseract.exe"
