FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app
COPY requirements.txt /app/ml/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/ml/requirements.txt

COPY src /app/ml/src
COPY fixtures /app/ml/fixtures
COPY prompts /app/ml/prompts
RUN groupadd --gid 10001 mlapp \
    && useradd --uid 10001 --gid mlapp --no-create-home mlapp \
    && mkdir -p /app/ml/.cache/web /app/ml/.cache/callbacks \
    && chown -R mlapp:mlapp /app/ml/.cache

USER mlapp
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)"
CMD ["python", "-m", "uvicorn", "ml.src.service:app", "--host", "0.0.0.0", "--port", "8000"]
