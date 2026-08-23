# Multi-stage build for backend
# Build context: repo root
# Dockerfile: resume_pipeline/Dockerfile
# All COPY paths are relative to the repo root.

# ─── Stage 1: Builder ─────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements (path relative to repo root)
COPY resume_pipeline/requirements.txt .

# Install CPU-only PyTorch first to prevent CUDA library bloat
RUN pip install --no-cache-dir --user torch --index-url https://download.pytorch.org/whl/cpu

# Install Python dependencies into user dir for clean copy
RUN pip install --no-cache-dir --user -r requirements.txt

# Pre-download spaCy model en_core_web_sm
RUN python -m spacy download en_core_web_sm

# Pre-download SentenceTransformer model weights (all-MiniLM-L6-v2) to eliminate cold start latency
ENV HF_HOME=/root/.cache/huggingface
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# ─── Stage 2: Runtime ─────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app/resume_pipeline

# Install all runtime system dependencies:
#   poppler-utils  — pdf2image needs pdftoppm (PDF→image for Vision parsing)
#   tesseract-ocr  — pytesseract OCR fallback for scanned resumes
#   libmagic1      — file-type detection used by document parsing libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    tesseract-ocr \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages and HuggingFace pre-baked models from builder stage
COPY --from=builder /root/.local /root/.local
COPY --from=builder /root/.cache/huggingface /root/.cache/huggingface

# Set PATH and Python / HuggingFace flags
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/root/.cache/huggingface

# Copy application code (all paths relative to repo root build context)
COPY resume_pipeline/ .

# Create data directory for uploaded files
RUN mkdir -p /app/data/raw_files

# Expose default port (Cloud Run passes PORT env var, defaults to 8080)
EXPOSE 8080

# Lightweight health check — /health never touches DB, responds immediately
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request, os; port=os.getenv('PORT','8080'); urllib.request.urlopen(f'http://localhost:{port}/health', timeout=5)"

# Start uvicorn — Cloud Run sets PORT automatically (defaults to 8080)
CMD ["sh", "-c", "uvicorn resume_pipeline.app:app --host 0.0.0.0 --port ${PORT:-8080}"]

