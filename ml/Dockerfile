FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-rus tesseract-ocr-eng libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY document_search ./document_search
RUN mkdir -p /app/data/reference_pdfs /app/data/processed
EXPOSE 8000
CMD ["uvicorn", "document_search.api:app", "--host", "0.0.0.0", "--port", "8000"]
