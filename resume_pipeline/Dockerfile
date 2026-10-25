# Backend-only image. Build context: repo root (see deploy/docker/build-and-push.sh).
#   docker build -f resume_pipeline/Dockerfile .
# All COPY paths are relative to the repo root.

# ─── Stage 1: Builder ─────────────────────────────────────────
FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

# gcc is needed only to compile pinned wheels (bcrypt, etc.); dropped after build.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Isolated venv keeps the runtime layer clean and owned by the app user.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY resume_pipeline/requirements.txt /tmp/requirements.txt

RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Pre-bake the MiniLM ONNX graph + tokenizer into the HF cache so cold starts
# skip the HuggingFace download. Runs the same loader the app uses.
# (Lazy RAG still applies: RAG_PRELOAD_ON_STARTUP=false defers index build.)
ENV HF_HOME=/opt/hf-cache
COPY resume_pipeline/resume_pipeline/core/minilm_onnx.py /tmp/minilm_onnx.py
RUN python /tmp/minilm_onnx.py

# ─── Stage 2: Runtime ─────────────────────────────────────────
FROM python:3.11-slim

# poppler-utils — pdf2image needs pdftoppm (PDF→image for offline OCR)
#   + ingest.py pdftotext fallback leg (PdfTextExtractor chain)
# tesseract-ocr — pytesseract OCR fallback for scanned resumes
# libmagic1    — retained for native file-type sniffing by parsing libs
#   (app routing itself uses extension/mimetypes + pdfplumber signals)
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    tesseract-ocr \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 10001 appuser \
    && mkdir -p /app/data/raw_files /app/logs /opt/hf-cache \
    && chown -R appuser:appuser /app /opt/hf-cache

COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /opt/hf-cache /opt/hf-cache

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/opt/hf-cache \
    PORT=8000

WORKDIR /app/resume_pipeline

# Application code only (repo-root build context; tests excluded via .dockerignore).
COPY --chown=appuser:appuser resume_pipeline/ .

USER appuser

EXPOSE 8000

# /health never touches the DB — safe for fast cold-start probing.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request, os; port=os.getenv('PORT','8000'); urllib.request.urlopen(f'http://localhost:{port}/health', timeout=5)"

# Single worker by default: one model copy in RAM, safe on 2 GB boxes.
# Compose pins the same; override --workers only on larger hosts.
# Entrypoint: with GCP_PROJECT set it loads the documented secrets from GCP
# Secret Manager (VM service account) before exec'ing; unset = straight exec,
# so local `docker compose` keeps using the repo-root .env unchanged.
ENTRYPOINT ["python", "docker-entrypoint.py"]
CMD ["sh", "-c", "uvicorn resume_pipeline.app:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
