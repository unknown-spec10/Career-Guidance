# GitHub Copilot Agent Instructions

Purpose: Equip AI coding agents to be immediately productive in this repo by documenting architecture, workflows, conventions, and integration points specific to this project.

## Big Picture
- **Monorepo**: `resume_pipeline/` (FastAPI backend + MySQL) + `frontend/` (React + Vite + Tailwind).
- **Core workflow**: Upload resume → Parse via Google Gemini → Store in DB → Generate college/job recommendations → Support interview practice.
- **Database**: 18 SQLAlchemy tables auto-initialized on startup; includes `Applicant`, `LLMParsedRecord`, `CollegeApplicabilityLog`, `JobRecommendation`, `InterviewSession`, `CreditAccount`, etc.
- **Key services**: 
  - `ResumeParserService` (resume parsing, skill matching via word-boundary regex)
  - `InterviewService` (mock interviews, question generation, Gemini-based scoring)
  - `CreditService` (quota management: 60 initial credits, weekly refill, per-activity costs)
  - Recommendation engine (scoring via `RECOMMENDATION_WEIGHTS`: JEE rank 35%, CGPA 25%, skills 25%, interview score 15%, academic/experience 20% each)
- **Data flow**:
  1. `POST /upload` → Save to `data/raw_files/app_<uuid>/metadata.json` + raw files
  2. `POST /parse/{applicant_id}` → Parse & persist `LLMParsedRecord` + auto-generate college recs
  3. `GET /api/recommendations/{db_applicant_id}` → Fetch college & job recs
  4. Interview/assessment feature adds skill verification & score boost (up to 15 points)

## Key Directories & Files
- **Backend** (`resume_pipeline/resume_pipeline/`):
  - `app.py` — FastAPI entry point; all routes, CORS, startup DB init, email verification, rate limiting.
  - `db.py` — SQLAlchemy models (18 tables): User, Applicant, Upload, LLMParsedRecord, College, Employer, Job, Interview*, Credit*, etc.
  - `config.py` — Settings loaded from `.env` (Gemini key, MySQL DSN, JWT secret, skill taxonomy path, Google API keys).
  - `constants.py` — File types, API messages, `RECOMMENDATION_WEIGHTS` (35% JEE, 25% CGPA, 25% skills, 15% interview, 20% academic/exp), interview config, credit costs.
  - `schemas.py` — Pydantic models for all request/response types.
  - `auth.py` — Password hashing (bcrypt), JWT creation/verification, role-based guards (`require_role(role)`).
  - `utils.py` — File save/hash (SHA256), XSS sanitization, email validation.
  - `email_verification.py` — Gmail SMTP integration for verification tokens & password reset codes.
  - `resume/` — Resume parsing: `parse_service.py` (orchestrates parsing), `llm_gemini.py` (Gemini API calls), `preprocessor.py` (PDF/text extraction), `skill_mapper_simple.py` (skill matching via word-boundary regex for names ≥3 chars), `skill_taxonomy_builder.py` (Google Search API for skill discovery).
  - `interview/` — `interview_service.py`: Question generation (MCQ + short-answer), Gemini-based evaluation, score calculation.
  - `core/credit_service.py` — Credit account management, eligibility checks, transaction logging.
  - `recommendation/` — Scoring & filtering logic for colleges & jobs.
- **Frontend** (`frontend/src/`):
  - `App.jsx`, `pages/`, `components/` — React UI; integrated with Axios + React Router.
  - `vite.config.js` — Dev proxy to `/api/*` routes on backend.
  - `hooks/` — Custom hooks for auth, toast, optimistic updates.
- **Data**:
  - `data/raw_files/app_<uuid>/` — Per-applicant folder; stores resume files, `metadata.json` (includes `jee_rank_user_provided`, `location`, etc.), `sample_resume_*.txt`.
- **Scripts**:
  - `scripts/init_db.py`, `seed_database.py`, `verify_data.py` — DB initialization and testing utilities.

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
- **Upload & Parse**:
  - `POST /upload` — Multipart with `resume` + optional `marksheets`, `jee_rank`, `location`, `preferences`. Returns `{ status, applicant_id, db_id?, resume_hash }`. SHA256 deduplicates.
  - `POST /parse/{applicant_id}` — Triggers parse; persists `LLMParsedRecord`, updates `Applicant.display_name/location`, auto-generates college recs. Returns normalized payload + `db_applicant_id`.
- **Public Data**:
  - `GET /api/stats` — Aggregate counts; `GET /api/applicants` — Paginated list; `GET /api/applicant/{id}` — Detail view.
  - `GET /api/colleges`, `GET /api/college/{id}` — College catalogue; `GET /api/jobs`, `GET /api/job/{id}` — Approved jobs only (excludes expired).
  - `GET /api/recommendations/{db_applicant_id}` — Both college & job recommendations.
- **Recommendation Generation**:
  - `POST /api/applicant/{db_applicant_id}/generate-recommendations` — Calls scoring engine; uses `RECOMMENDATION_WEIGHTS`, skill matching, interview scores.
- **Interview & Skill Assessment**:
  - `POST /api/interview/start` — Create `InterviewSession`; checks credits via `CreditService.check_eligibility()`. Deducts credits on completion.
  - `GET /api/interview/{session_id}/question` — Fetches next question (MCQ or short-answer); Gemini-generated or cached.
  - `POST /api/interview/{session_id}/answer` — Evaluate answer via Gemini; update session score; check for learning path trigger.
  - `GET /api/interview/history` — List all sessions; includes scores and time spent.
- **Credit System**:
  - `GET /api/credit/account` — User's balance, usage, next refill; `POST /api/credit/check` — Validate eligibility before activity.
  - `GET /api/credit/transactions` — Audit log of spend/refill/bonus.
- **Status Updates**:
  - `PATCH /api/college-recommendation/{rec_id}/status` — One of `recommended|applied|accepted|rejected|withdrawn`.
  - `PATCH /api/job-recommendation/{rec_id}/status` — `recommended|applied|interviewing|offered|accepted|rejected|withdrawn`.
- **Auth & Roles**:
  - `POST /api/auth/register` — Email + role (student/employer/college). Sends verification token via Gmail; role-specific profile created.
  - `POST /api/auth/login` → JWT bearer token; role stored in token. Endpoints guarded by `@require_role('student')` etc.
  - `POST /api/auth/forgot-password` → 6-digit code emailed; `POST /api/auth/reset-password` validates code & updates password.

## Conventions & Patterns
- **IDs**: External-facing `applicant_id` like `app_<uuid>` maps to DB `Applicant.id` (integer); many endpoints expect DB id.
- **File storage**: Resumes persist under `settings.FILE_STORAGE_PATH` (default `./data/raw_files`); `metadata.json` stores `jee_rank_user_provided` to override parsed values.
- **Skill matching**: Word-boundary regex (e.g., `\bPython\b`) for names ≥3 chars; exact match for shorter names.
- **Jobs visibility**: Public jobs must have `status='approved'` AND `expires_at > now`.
- **CORS**: Frontend origins: `http://localhost:3000`, `http://localhost:5173`.
- **Credit flow**: Every premium feature (interview, coding challenge) calls `CreditService.check_eligibility()` first; on success, `spend_credits()` logs transaction.
- **Recommendation scores**: Calculated in `recommendation/` module; combines parsed data, test scores, interview performance, and manual adjustments.
- **Interview scoring**: Gemini evaluates short answers via `InterviewService.evaluate_answer()` returning `{ score: 0-100, feedback }`. MCQs auto-graded.
- **Email verification**: HTML templates in `email_verification.py`; token expires in 24h; resend via `POST /api/auth/resend-code`.

## Testing & Debugging
- **Backend tests**: `pytest tests/ -q` or specific: `pytest tests/test_api.py -v`, `pytest tests/test_parsing.py -v`
- **Sample resumes**: In `data/raw_files/*/sample_resume_*.txt` for parser testing.
- **Common pitfalls**:
  - Using string `applicant_id` where DB id (integer) is needed (e.g., `GET /api/recommendations/{db_id}`).
  - Missing `.env` values (`GEMINI_API_KEY`, MySQL credentials, `GMAIL_USER`, `GMAIL_APP_PASSWORD`) → DB init fails or features stub.
  - Interview session not checking credits → `CreditService.check_eligibility()` will raise `HTTPException(402)`.
- **Debug mode**: Set `GEMINI_MOCK_MODE=true` in `.env` to use stub LLM responses (no API calls).
- **Database reset**: Run `python scripts/init_db.py` to drop/recreate all tables; then `python scripts/seed_database.py` to populate sample data.

## External Integrations
- Google Gemini LLM: Configure `GEMINI_API_KEY` in `.env`; client in `resume/llm_gemini.py`.
- MySQL: Connection via SQLAlchemy; database ensured at startup using PyMySQL.
- Optional OCR/pdftotext: System-level tools referenced in README; parsing stubs in `resume/`.

## When Making Changes
- **New routes**: Add in `app.py` with proper role guards via `@require_role()`.
- **Database models**: Extend `db.py` and use `joinedload` to avoid N+1 queries.
- **Constants & weights**: Update `constants.py` for API messages, interview config, recommendation tuning, and credit costs.
- **File handling**: Keep writes within `data/raw_files/app_<uuid>/`; update `metadata.json` when user-provided fields affect parsing.
- **Frontend proxy**: Ensure Vite proxy in `vite.config.js` aligns with backend CORS.
- **Email templates**: Modify in `email_verification.py` for verification/password-reset flows.
- **Credits**: Use `CreditService` for all premium features; check eligibility before executing; log spend after completion.
- **Interview questions**: Store in `InterviewSession.questions` (JSON); evaluation via `InterviewService.evaluate_answer()`.
- **Skill taxonomy**: Optional JSON file (path in config); loaded by `SkillTaxonomyBuilder` for discovery via Google Search API.

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
