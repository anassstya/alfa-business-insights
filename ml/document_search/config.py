from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
PDF_DIR = DATA_DIR / "reference_pdfs"
PROCESSED_DIR = DATA_DIR / "processed"

CHUNKS_PATH = PROCESSED_DIR / "document_chunks.jsonl"
EMBEDDINGS_PATH = PROCESSED_DIR / "embeddings.npy"

CHUNK_SIZE = 1200
CHUNK_OVERLAP = 200
MIN_TEXT_LENGTH = 50

OCR_LANGUAGE = "rus+eng"
TESSERACT_CMD = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
