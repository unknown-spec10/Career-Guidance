# GitHub Copilot Agent Instructions

Purpose: Equip AI coding agents to be immediately productive in this repo by documenting architecture, workflows, conventions, and integration points specific to this project.

## Big Picture
- Monorepo with two main parts:
  - `resume_pipeline/` — FastAPI backend with MySQL via SQLAlchemy; AI parsing powered by Google Gemini. Entry `resume_pipeline/app.py`.
  - `frontend/` — React + Vite + Tailwind UI; dev server on port 3000/5173.
- Data lifecycle:
  1. Upload resume via `POST /upload` → saved under `data/raw_files/app_<uuid>/` with `metadata.json`.
  2. Parse via `POST /parse/{applicant_id}` using `ResumeParserService` → normalized fields saved to `LLMParsedRecord` and basic auto recommendations generated.
  3. Recommendations fetched via `GET /api/recommendations/{db_applicant_id}`; updates via PATCH endpoints.
- Database auto-initializes on startup (`@app.on_event('startup')`) and tables are created by `db.init_db()`.

## Key Directories & Files
- Backend:
  - `resume_pipeline/resume_pipeline/app.py` — All API routes, CORS, startup DB init.
  - `resume_pipeline/resume_pipeline/db.py` — SQLAlchemy models and `SessionLocal`/`init_db()`.
  - `resume_pipeline/resume_pipeline/resume/` — Parsing components (`parse_service.py`, `preprocessor.py`, `llm_gemini.py`).
  - `resume_pipeline/resume_pipeline/constants.py` — Allowed file types, API messages, recommendation weights.
  - `resume_pipeline/resume_pipeline/schemas.py` — Pydantic models for requests/responses.
  - `resume_pipeline/resume_pipeline/auth.py` — Password hashing, JWT, role guards.
  - `resume_pipeline/resume_pipeline/utils.py` — File saving and hashing.
  - `resume_pipeline/schema.json` — Example parsing schema; use for LLM output structure.
- Frontend:
  - `frontend/src/App.jsx`, `components/`, `pages/` — UI and pages.
  - `frontend/vite.config.js` — Dev proxy to backend (`/api/*`).
- Data:
  - `data/raw_files/` — Uploaded files per applicant; input to parsing. Each folder contains `metadata.json`, resume files, optional `sample_resume_*.txt`.

## Running Locally (Windows PowerShell)
- Backend:
  - Create env and install deps:
    ```powershell
    cd "D:\Career Guidence\resume_pipeline"
    python -m venv ..\myenv
    ..\myenv\Scripts\Activate.ps1
    pip install -r requirements.txt
    ```
  - Start server:
    ```powershell
    uvicorn resume_pipeline.app:app --reload --port 8000
    ```
- Frontend:
  ```powershell
  cd "D:\Career Guidence\frontend"
  npm install
  npm run dev
  ```

## Core API Contracts
- Upload & Parse:
  - `POST /upload` — Multipart with `resume` and optional `marksheets`, `jee_rank`, `location`, `preferences`. Returns `{ status, applicant_id, db_id?, resume_hash }`. Deduplicates by SHA256.
  - `POST /parse/{applicant_id}` — Triggers parse; persists `LLMParsedRecord`, updates applicant `display_name/location`, and auto-generates basic college recs. Returns normalized parse payload with `db_applicant_id`.
- Public Data:
  - `GET /api/stats`, `GET /api/applicants`, `GET /api/applicant/{id}` — Dashboard & details.
  - `GET /api/colleges`, `GET /api/college/{id}` — College catalogue.
  - `GET /api/jobs`, `GET /api/job/{id}` — Approved jobs only; excludes expired.
  - `GET /api/recommendations/{applicant_id}` — Both college and job recs for DB applicant id.
- Recommendation Generation:
  - `POST /api/applicant/{applicant_id}/generate-recommendations` — Uses `RECOMMENDATION_WEIGHTS` and improved word-boundary skill matching.
- Status Updates:
  - `PATCH /api/college-recommendation/{rec_id}/status` — One of `recommended|applied|accepted|rejected|withdrawn`.
  - `PATCH /api/job-recommendation/{rec_id}/status` — `recommended|applied|interviewing|offered|accepted|rejected|withdrawn`.
- Auth & Roles:
  - `POST /api/auth/register` → email verification token stored; role-specific profiles (Employer/College) created.
  - `POST /api/auth/login` → bearer token; role via JWT. Role-guarded endpoints use `require_role()`.

## Conventions & Patterns
- IDs:
  - External-facing `applicant_id` like `app_<uuid>` maps to DB `Applicant.id`; many endpoints expect DB id, not string.
- File storage:
  - Resume uploads persist under `settings.FILE_STORAGE_PATH` (default `./data/raw_files`); `metadata.json` tracks `jee_rank_user_provided` to override parsed values.
- Skill matching:
  - Word-boundary regex for names length ≥ 3; exact match for shorter names.
- Jobs visibility:
  - Public jobs must be `status='approved'` and not `expires_at <= now`.
- CORS:
  - Frontend dev origins allowed: `http://localhost:3000` and `http://localhost:5173`.

## Testing & Debugging
- Backend tests:
  ```powershell
  cd "D:\Career Guidence\resume_pipeline"
  pytest tests/ -q
  ```
- Targeted tests:
  ```powershell
  pytest tests/test_api.py -v
  pytest tests/test_parsing.py -v
  ```
- Sample data:
  - Use files in `data/raw_files/*/sample_resume_*.txt` to exercise parsers.
- Common pitfalls:
  - Using string `applicant_id` where DB id is needed (e.g., `GET /api/recommendations/{db_id}`).
  - Missing `.env` values (`GEMINI_API_KEY`, MySQL credentials) — DB init fails or parsing stubs return minimal payloads.

## External Integrations
- Google Gemini LLM: Configure `GEMINI_API_KEY` in `.env`; client in `resume/llm_gemini.py`.
- MySQL: Connection via SQLAlchemy; database ensured at startup using PyMySQL.
- Optional OCR/pdftotext: System-level tools referenced in README; parsing stubs in `resume/`.

## When Making Changes
- Add new routes in `app.py`; keep role guards consistent with `require_role()`.
- Extend models in `db.py` and update related queries to avoid N+1 (prefer joinedload/batched fetch).
- Update constants in `constants.py` for API messages and recommendation tuning.
- Keep file writes within `data/raw_files/app_<uuid>/`; update `metadata.json` when new user-provided fields affect parsing.
- Frontend consumes backend via `/api/*` proxy; ensure CORS and Vite proxy align.

## Example Workflows
- End-to-end upload + parse + recs (pwsh):
  ```powershell
  # Start backend and frontend as above
  # Upload a file
  Invoke-WebRequest -Uri http://localhost:8000/upload -Method Post -InFile "data/raw_files/app_7488d097f8ae4018a9092789471dc653/sample_resume_2.txt" -ContentType "text/plain"
  # Parse using returned string applicant_id
  Invoke-RestMethod -Uri http://localhost:8000/parse/app_7488d097f8ae4018a9092789471dc653 -Method Post
  # Fetch recommendations using returned db_applicant_id
  Invoke-RestMethod -Uri http://localhost:8000/api/recommendations/1
  ```

---
Feedback: If any conventions are unclear (e.g., exact schema fields, role auth flows, or missing envs), tell us what you need and we’ll refine this guide.
