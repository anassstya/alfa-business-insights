import hashlib
import json
import re

import pymupdf
import pytesseract
from PIL import Image

from config import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    CHUNKS_PATH,
    MIN_TEXT_LENGTH,
    OCR_LANGUAGE,
    PDF_DIR,
    PROCESSED_DIR,
    TESSERACT_CMD,
)

pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD


def normalize_text(text):
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_text(text):
    words = text.split()
    chunks = []
    start = 0

    while start < len(words):
        end = min(start + CHUNK_SIZE, len(words))
        chunk = " ".join(words[start:end])

        if chunk:
            chunks.append(chunk)

        if end == len(words):
            break

        start = end - CHUNK_OVERLAP

    return chunks


def extract_page(page):
    text = normalize_text(page.get_text())

    if len(text) >= MIN_TEXT_LENGTH:
        return text, "text"

    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
    image = Image.frombytes(
        "RGB",
        [pixmap.width, pixmap.height],
        pixmap.samples,
    )
    text = normalize_text(pytesseract.image_to_string(
        image,
        lang=OCR_LANGUAGE,
    ))

    return text, "ocr"


def process_pdf(pdf_path):
    document_hash = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    records = []

    with pymupdf.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf, start=1):
            text, method = extract_page(page)

            for chunk_index, chunk in enumerate(split_text(text)):
                records.append({
                    "chunk_id": (
                        f"{document_hash[:12]}_"
                        f"{page_number}_{chunk_index}"
                    ),
                    "document_id": document_hash,
                    "source": pdf_path.name,
                    "page_start": page_number,
                    "page_end": page_number,
                    "chunk_index": chunk_index,
                    "extraction_method": method,
                    "text": chunk,
                })

    return records


def main():
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    records = []

    for pdf_path in sorted(PDF_DIR.glob("*.pdf")):
        try:
            pdf_records = process_pdf(pdf_path)
            records.extend(pdf_records)
            print(f"{pdf_path.name}: {len(pdf_records)} chunks")
        except Exception as error:
            print(f"Failed to process {pdf_path.name}: {error}")

    with CHUNKS_PATH.open("w", encoding="utf-8") as file:
        for record in records:
            file.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"Saved {len(records)} chunks to {CHUNKS_PATH}")


if __name__ == "__main__":
    main()
