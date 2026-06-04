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

# ─── Stage 2: Runtime ─────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install all runtime system dependencies:
#   poppler-utils  — pdf2image needs pdftoppm (PDF→image for Vision parsing)
#   tesseract-ocr  — pytesseract OCR fallback for scanned resumes
#   libmagic1      — file-type detection used by document parsing libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    tesseract-ocr \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder stage
COPY --from=builder /root/.local /root/.local

# Set PATH and Python flags
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Copy application code (all paths relative to repo root build context)
COPY resume_pipeline/ ./resume_pipeline/

# Create data directory for uploaded files
RUN mkdir -p /app/data/raw_files

# Expose the port Render uses (injected via PORT env var, defaults to 10000)
EXPOSE 10000

# Lightweight health check — /health never touches DB, responds immediately
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request, os; port=os.getenv('PORT','10000'); urllib.request.urlopen(f'http://localhost:{port}/health', timeout=5)"

# Start uvicorn — Render sets PORT automatically
CMD ["sh", "-c", "uvicorn resume_pipeline.app:app --host 0.0.0.0 --port ${PORT:-10000}"]
