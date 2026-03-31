Resume Parsing & Recommendation Pipeline

This repository contains a minimal scaffold for an applicant intake and parsing pipeline.

Goals implemented in scaffold:
- File upload endpoint (FastAPI) that saves raw files, computes SHA256 content hash, and returns an `applicant_id`.
- Preprocessing stubs for pdftotext + OCR (Tesseract / easyocr).
- Gemini client stub and strict schema example for structured parsing.
- Deterministic numeric validators and simple skill canonicalizer stub.
- SQLAlchemy models for PostgreSQL tables outlined by the user's spec.
- Embedding & vector-store stubs.

How to run (local, dev):
1. Create a virtualenv and install dependencies from `requirements.txt`.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn resume_pipeline.app:app --reload --port 8000
```

Notes:
- Configure runtime values in environment variables (copy `.env.example` to `.env` at repo root for local development).
- Keep secrets only in environment variables (for example: `SECRET_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, database passwords).
- Install system dependencies: `pdftotext` (poppler) and Tesseract OCR for full functionality.
- See `resume_pipeline/schema.json` for the parsing schema example.
