import hashlib
import re
from pathlib import Path

import fitz
import pytesseract
from PIL import Image

from .config import CHUNK_OVERLAP, CHUNK_SIZE, MIN_TEXT_LENGTH, OCR_LANGUAGE, TESSERACT_CMD

pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

# Common abbreviations in Russian-language business and financial reports.
_ABBREVIATIONS = (
    "г", "гг", "стр", "рис", "табл", "руб", "млн", "млрд", "трлн",
    "тыс", "проф", "им", "т.е", "т.к", "т.д", "т.п", "см", "др",
    "ул", "пер", "обл", "акц", "АО", "ПАО", "ООО", "МР", "кв",
)
_ABBR_RE = re.compile(
    r"(?i)(?<!\w)(" + "|".join(re.escape(x) for x in sorted(_ABBREVIATIONS, key=len, reverse=True)) + r")\.(?=\s)")


def _clean_text(text: str) -> str:
    # Keep paragraph breaks: they are useful semantic boundaries.
    text = (text or "").replace("\x00", " ").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _page_text(page) -> tuple[str, str]:
    text = _clean_text(page.get_text("text"))
    if len(text.replace("\n", " ")) >= MIN_TEXT_LENGTH:
        return text, "text"
    try:
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        return _clean_text(pytesseract.image_to_string(image, lang=OCR_LANGUAGE)), "ocr"
    except Exception:
        return text, "text"


def _split_long_sentence(sentence: str, max_chars: int) -> list[str]:
    """Hard fallback for an unusually long sentence; split only at word boundaries."""
    words = sentence.split()
    pieces: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else current + " " + word
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                pieces.append(current)
            # A single token can exceed max_chars; preserve it rather than lose text.
            current = word
    if current:
        pieces.append(current)
    return pieces


def _split_sentences(text: str) -> list[str]:
    """Split on paragraph and likely sentence boundaries, protecting common abbreviations."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    sentences: list[str] = []
    for paragraph in paragraphs:
        # Temporarily protect dots in common abbreviations (e.g. млрд.) and initials.
        protected = _ABBR_RE.sub(lambda m: m.group(0)[:-1] + "<DOT>", paragraph)
        protected = re.sub(r"\b([А-ЯЁA-Z])\.(?=\s+[А-ЯЁA-Z])", r"\1<DOT>", protected)
        # Split only when sentence punctuation is followed by whitespace and a plausible
        # sentence start. Decimal numbers (e.g. 12.4) are not split because no whitespace follows.
        parts = re.split(r'(?<=[.!?…])(?:["»”’\']*)\s+(?=[«“"\'\(\[]?[А-ЯЁA-Z0-9])', protected)
        for part in parts:
            part = part.replace("<DOT>", ".").strip()
            if part:
                sentences.append(part)
    return sentences


def _split_text(text: str) -> list[str]:
    """Pack whole sentences into compact chunks, with sentence-level overlap where possible."""
    text = _clean_text(text)
    if not text:
        return []

    target = max(1, CHUNK_SIZE)
    overlap = max(0, CHUNK_OVERLAP)
    # Permit one long sentence to exceed the target, but cap it with a word-boundary fallback.
    max_sentence_size = max(target, 1200)
    sentences = _split_sentences(text)
    if not sentences:
        return _split_long_sentence(text.replace("\n", " "), max_sentence_size)

    expanded: list[str] = []
    for sentence in sentences:
        if len(sentence) > max_sentence_size:
            expanded.extend(_split_long_sentence(sentence, max_sentence_size))
        else:
            expanded.append(sentence)

    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for sentence in expanded:
        extra_len = len(sentence) if not current else len(sentence) + 1
        if current and current_len + extra_len > target:
            chunks.append(" ".join(current).strip())

            # Carry whole trailing sentence(s) into the next chunk when within overlap budget.
            overlap_sentences: list[str] = []
            overlap_len = 0
            for previous in reversed(current):
                cost = len(previous) if not overlap_sentences else len(previous) + 1
                if overlap_len + cost > overlap:
                    break
                overlap_sentences.insert(0, previous)
                overlap_len += cost
            current = overlap_sentences
            current_len = sum(len(s) for s in current) + max(0, len(current) - 1)

            extra_len = len(sentence) if not current else len(sentence) + 1
            # If the overlap prevents the next sentence from fitting, emit overlap separately.
            if current and current_len + extra_len > max(target, len(sentence)):
                current = []
                current_len = 0
                extra_len = len(sentence)

        current.append(sentence)
        current_len += extra_len

    if current:
        chunk = " ".join(current).strip()
        if not chunks or chunk != chunks[-1]:
            chunks.append(chunk)
    return chunks


def process_pdf(pdf_path: str | Path, document_id: str | None = None) -> list[dict]:
    pdf_path = Path(pdf_path)
    digest = document_id or hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    records = []
    with fitz.open(pdf_path) as document:
        for page_number, page in enumerate(document, start=1):
            text, method = _page_text(page)
            for chunk_index, chunk in enumerate(_split_text(text)):
                records.append({
                    "chunk_id": f"{digest}:{page_number}:{chunk_index}",
                    "document_id": digest,
                    "source": pdf_path.name,
                    "page_start": page_number,
                    "page_end": page_number,
                    "chunk_index": chunk_index,
                    "extraction_method": method,
                    "text": chunk,
                })
    return records
