FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/models/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/models/huggingface \
    EMBEDDING_MODEL=intfloat/multilingual-e5-small
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-rus tesseract-ocr-eng libgomp1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir \
        --index-url https://download.pytorch.org/whl/cpu \
        --extra-index-url https://pypi.org/simple \
        "torch==2.7.1+cpu" \
    && pip install --no-cache-dir -r requirements.txt
COPY api.py ./api.py
COPY analysis_service.py ./analysis_service.py
COPY document_search ./document_search
COPY src ./src
COPY tool ./tool
RUN mkdir -p /models/huggingface
EXPOSE 8000
CMD ["uvicorn", "document_search.api:app", "--host", "0.0.0.0", "--port", "8000"]
