# Resume Parsing & Recommendation Pipeline (FastAPI Backend)

FastAPI backend for applicant intake, resume parsing, job recommendations, interview practice, and credit-gated premium features.

## Resume parser (rule-based, offline)

No LLMs, no network calls. The deterministic pipeline in `resume_pipeline/resume/`:

```
ingest.py → preprocess_ocr.py (scanned pages only) → segmenter.py
    → extractors.py → rule_parser.py
```

- `parse_service.py` is a thin backward-compatible facade over `RuleBasedParserService`.
- Text extraction: layout-aware pass (pdfplumber/pdfminer) with file-type routing (`file_type_router.py`).
- Scanned/image pages: local OCR only — RapidOCR primary, Tesseract fallback. No Gemini Vision.
- Section splitting: header-regex splitter (`segmenter.py`); extraction: regex + rapidfuzz (`extractors.py`).
- Skills: offline fuzzy matching (Pass-1 semantics) against `skill_taxonomy.json`. The retired cloud-embedding Pass-2 was removed.
- Unrecognized skills append to `unrecognized_skills_review.jsonl` for later curation (best-effort, never fails a parse).
- Confidence: per-section scores via `confidence_scorer.py`, blended with OCR confidence; state machine (`accepted` / `pending_review` / `failed`) with retuned rule-based thresholds.

## Recommendation pipeline (staged, student scope)

Two-stage retrieval plus ranking with a shared facade in `resume_pipeline/recommendation/`:

```
retrieval.py → ranking.py → reranking.py → service.py
```

- `retrieval.py` — candidate generation over ALL active jobs: existing
  `active_job_criteria` SQL filters plus lenient location/experience gates, then
  TF-IDF skill overlap only. No embeddings, no network calls. Output is a ranked
  list of ~100 job IDs (`RETRIEVAL_TOP_K`).
- `ranking.py` — heavy scorers (semantic, personalization, temporal, document)
  plus the aggregator over the retrieved ~100 only; scoring logic unchanged from
  the former engine. TF-IDF is retrieval's job and arrives as input.
  `scorers/` internals are untouched. Also hosts the new-job backfill,
  null-explanation retry, and single-pair ensure helpers.
- `reranking.py` — business rules: purpose weights, freshness boost, diversity
  cap (3 per employer), interview-blend transparency flag, explanation attach
  (top 5; digest mode is cached/offline only), persistence, and a read-only
  24-hour cooldown view (the router remains the sole cooldown enforcer).
- `service.py` — one shared facade `get_recommendations(applicant_id, db,
  purpose=..., more_offset=..., more_limit=...)`. Purposes: `jobs` (StudentDashboard/JobsPage defaults),
  `skill_gaps` (adds `missing_skills` + `gap_signal` for LearningPath/SkillGap
  views), `digest` (lightweight top 5), `browse` (same weights as `jobs`,
  wider top-20 slice for JobsPage browsing). Same pipeline, different rerank
  weights, no forks. All backend callers go through it. The response splits
  the ranked list into `recommended` (top slice) + paged `more_matches`;
  `job_recommendations` mirrors `recommended` for backward compatibility
  (persistence always holds every reranked row).
- `precompute.py` — embed-once helpers: applicant vectors at parse time
  (`embedding_tasks.parse_resume_task`), job vectors at posting time
  (`generate_job_embedding_task`), via the existing `Embedder` + pgvector path.
  Request-time scoring reads stored vectors (cache hits); any miss degrades to
  the TF-IDF fallback instead of blocking.
- `engine.py` / `recommendation_service.py` — thin backward-compatible shims
  (same names, same return shapes) so existing imports keep working.

## Routes

`resume_pipeline/app.py` is a thin composition root (app wiring, CORS, startup/shutdown). All handlers live in `resume_pipeline/routers/` (`auth`, `profile`, `resume`, `jobs`, `applications`, `recommendations`, `credits`, `rag`, `misc`) with shared helpers in `routers/deps.py`. There is no `repos/` layer.

Key resume endpoints: `POST /upload` and `POST /api/upload/resume` (save raw file, SHA256 content hash, return `applicant_id`), `POST /parse/{applicant_id}` (ownership-gated parse trigger), `GET /api/applicant/{applicant_id}`.

## How to run (local, dev)

1. Create a virtualenv and install dependencies from `requirements.txt`.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn resume_pipeline.app:app --reload --port 8000
```

Notes:
- Configure runtime values in environment variables (copy `.env.example` to `.env` at repo root for local development).
- Keep secrets only in environment variables (for example: `SECRET_KEY`, `OPENCODE_API_KEY`, `GROQ_API_KEY`, database passwords).
- Resume parsing is offline and needs no API key. `OPENCODE_API_KEY` serves ALL chat workloads (interview/learning-path generation, RAG answers, explanations) via `llm_router`; `GROQ_API_KEY` serves STT only. The router makes exactly one adapter attempt per call and raises on failure; unset credentials raise unless the global mock toggle is on.
- Install system dependencies: `pdftotext` (poppler) and Tesseract OCR for full functionality.
- See `schema.json` for the parsing schema example.

## Database

SQLAlchemy models for PostgreSQL are defined in `resume_pipeline/db.py`. Apply schema changes with `alembic upgrade head` (additive, non-destructive). `scripts/init_db.py` drops and recreates the schema — development only, never against a real database.
