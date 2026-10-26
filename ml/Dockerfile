FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# CPU-only embeddings and OCR support for bank PDFs.
ENV HF_HOME=/app/ml/.cache/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/app/ml/.cache/huggingface
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-rus tesseract-ocr-eng libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt /app/ml/requirements.txt
RUN python -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu "torch==2.7.1+cpu" \
    && python -m pip install --no-cache-dir -r /app/ml/requirements.txt

COPY src /app/ml/src
COPY fixtures /app/ml/fixtures
COPY prompts /app/ml/prompts
COPY document_search /app/ml/document_search
COPY analysis_service.py /app/ml/analysis_service.py
RUN groupadd --gid 10001 mlapp \
    && useradd --uid 10001 --gid mlapp --no-create-home mlapp \
    && mkdir -p /app/ml/.cache/web /app/ml/.cache/callbacks \
    && chown -R mlapp:mlapp /app/ml/.cache

USER mlapp
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)"
CMD ["python", "-m", "uvicorn", "ml.src.service:app", "--host", "0.0.0.0", "--port", "8000"]
