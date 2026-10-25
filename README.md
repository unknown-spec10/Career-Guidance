# Career Guidance AI System (v0.5)

An advanced, premium AI-powered career guidance platform designed to orchestrate intelligent resume parsing, semantic skill normalization, job recommendation, and interactive mock interview practice with live AI feedback.

> **Note:** The college-suitability domain was removed from the codebase (see `resume_pipeline/scripts/drop_college_domain.py`); older documents referencing college grading are obsolete. Live/real-time WebSocket interviews remain a documented proposal (see `docs_wiki/architecture/LIVE_INTERVIEW_ARCHITECTURE.md`) and are **not implemented**.

---

## 🌟 What's New

### Student-Only Rebuild (October 2026) — Rule-Based Parser, Router Split, Scope Cut

1. **Resume parser is now fully rule-based and offline**: `resume/` runs a deterministic pipeline (`ingest.py` → `preprocess_ocr.py` → `segmenter.py` → `extractors.py` → `rule_parser.py`, with `parse_service.py` kept as a thin facade). No LLM calls in the parse path, no network access, no `llm_groq.py`/`llm_gemini.py` (deleted), no Vision OCR (scanned pages use local RapidOCR with Tesseract fallback), and no `groq`/`google-genai` pip dependencies. Skill matching is rapidfuzz Pass-1 against a backfilled `skill_taxonomy.json`; unrecognized skills append to a `unrecognized_skills_review.jsonl` curation queue. The retired cloud-embedding Pass-2 in `skill_normalizer.py` was removed.
2. **Backend split into routers**: the `app.py` monolith is now a thin composition root (app wiring + startup/shutdown only); all route handlers live in `resume_pipeline/routers/` (`auth`, `profile`, `resume`, `jobs`, `applications`, `recommendations`, `credits`, `rag`, `misc`) with shared helpers in `routers/deps.py`.
3. **Student-scoped cut**: `resume_pipeline/repos/` (orphaned repository pattern) deleted; 15 employer/admin/mentor/analytics frontend pages deleted (Employer*, AdminDashboard, JobModerationPage, UserManagementPage, TalentPool*, ApplicantDetailsPage, JobApplicantsPage, InterviewFeedbackPage, InterviewSchedulerPage, RecruitmentAnalyticsPage, NetworkHubPage); uncalled backend routes removed. Kept set is student-scoped — see `docs_wiki/PAGE_API_AUDIT.md` for the Keep/Cut source list.
4. **Suites re-measured**: backend `160 passed, 1 skipped` (`pytest tests/ -q --ignore=tests/test_api.py` under mock mode); frontend `88 passed across 14 files` (`npm test`).

### Completion Cycle (August 2026) — Security, Reliability & Honesty Hardening

A full implementation-gap audit and remediation cycle was completed. Highlights:

1. **Enforced security perimeter**: every applicant-data endpoint now requires authentication with ownership/relationship scoping (students see only their own profile; employers only applicants in their pipeline; admins unrestricted). Recommendation-status BOLA fixed; brute-forceable verification codes replaced with DB-backed lockouts (`security_attempts` table); JWTs are revoked on password change/reset.
2. **Real database migrations**: Alembic introduced (revisions 0001–0007, all additive/non-destructive). The legacy drop-and-recreate `init_db.py` is dev-only.
3. **Durable credit economy**: atomic spends (concurrency-safe), refunds on failure, bonus-farming guards, no credit minting for anonymous uploads. Two latent production crashes found & fixed (missing enum values, undefined service reference).
4. **Production integration fixes**: all frontend streaming/SSE/beacon calls route through the configured API base URL; four dead endpoint calls reconciled.
5. **Honest surfaces**: all fabricated data removed (mock admin users/stats, fake talent-match verdicts, random match scores, invented mentor personas, hardcoded analytics splits, fake semantic-search scores). Real implementations added where feasible (vector-based candidate search), honest empty/error states elsewhere.
6. **Reliability**: interview session abandon redesigned (explicit quit + single-purpose HMAC beacon token); failed interview evaluations retry automatically and then deliver honest partial results instead of polling forever.

Full per-feature status, known limitations, and deferred backlog: **`docs_wiki/IMPLEMENTATION_STATUS.md`**.

### v0.5 Release — Performance & Cost Optimization

1. **Rule-Based Offline Parser Pipeline** *(superseded the Groq-Gemini hybrid below in October 2026 — see above)*:
   - **Deterministic extraction, zero LLM calls**: `ingest.py → preprocess_ocr.py → segmenter.py → extractors.py → rule_parser.py`, exposed through the `parse_service.py` facade.
   - **Local OCR only (Type B/C PDFs)**: scanned/image-based resumes are OCR-processed locally (RapidOCR primary, Tesseract fallback) — no Gemini Vision.
   - **Offline skill mapping**: rapidfuzz fuzzy matching (Pass-1 semantics) against the backfilled skill taxonomy; unrecognized skills go to a JSONL review queue.

2. **Recommendation Cooldown & Quota Bypass**:
   - Added a **24-hour refresh cooldown** on AI recommendations to control server and token overhead.
   - **Real-Time Countdown**: Interactive, animated timer in the Student Dashboard dynamically displays hours, minutes, and seconds remaining.
   - **Premium Bypass**: Added a 5-credit quota bypass mechanic with double-confirm modal, communicating instantly with `CreditService`.

3. **Premium Floating Overlay Portals**:
   - Integrated React Portals (`createPortal`) for both the **CreditWidget** and the **ApplicationTracker** status boards.
   - Completely resolves clipping, hidden overflows, or `z-index` stack context interference from parent flex columns/Framer Motion cards. Modals now render directly at `document.body` level with elegant glassmorphic backdrops.

4. **Dynamic Application Tracking Board**:
   - Upgraded the **ApplicationTracker** card to perform self-contained data fetching from `/api/student/applications/jobs` with 30s auto-refresh.
   - Decoupled from static props, ensuring real-time application pipelines (Sent, Interview, Offers, Closed) with complete fallback support for both nested and flat API data models.

---

## 📂 Repository Layout

```
Career Guidence/
├── deploy/                     # Deployment helpers (manual GCP path; no EC2/AWS files)
│   ├── docker/
│   │   └── build-and-push.ps1/.sh    # Build & push the backend image (repo-root context)
│   ├── gcp/
│   │   ├── BRINGUP.md                # Manual GCE demo-VM bring-up (Secret Manager only)
│   │   └── user-data.sh              # GCE startup script (non-secret config; no VM .env)
│   └── scripts/                      # Empty (legacy redeploy/dual-DB scripts removed)
├── docker-compose.yml          # Single backend-only compose: backend API on :8000 (Supabase DB, Vercel frontend)
├── .env / .env.example         # Single env source (root only)
├── resume_pipeline/Dockerfile  # Backend-only image
├── .dockerignore               # Single root ignore
├── frontend/                   # React 18 + Vite 5 + Tailwind CSS + Framer Motion (JavaScript/JSX)
│   ├── src/
│   │   ├── components/         # Reusable UI (CreditWidget, ApplicationTracker, etc. with Portals)
│   │   ├── pages/              # Core views (StudentDashboard, LearningPaths, Interview flows)
│   │   ├── hooks/              # useAuth, useInterviewSession, useToast, SSE consumers
│   │   └── config/             # API base URL / axios instance, constants
├── resume_pipeline/            # FastAPI backend (Python 3.11)
│   ├── alembic.ini + alembic/  # Migrations (0001–0007, additive/non-destructive)
│   ├── resume_pipeline/        # Main package
│   │   ├── app.py              # Thin composition root: app wiring, CORS, startup/shutdown, router registration
│   │   ├── routers/            # All route handlers: auth, profile, resume, jobs, applications, recommendations, credits, rag, misc, admin (+ deps.py shared helpers)
│   │   ├── db/                 # SQLAlchemy models (32 tables, 16 PG enums) + session helpers
│   │   ├── config.py           # Pydantic v2 settings (environment-injected; APP_ENV gate) + tuning constants
│   │   ├── admin_seed.py       # Idempotent ADMIN_EMAIL/ADMIN_PASSWORD seed on startup
│   │   ├── auth.py             # JWT (+iat revocation), bcrypt, require_role guard
│   │   ├── resume/        # Rule-based offline parsing: ingest, preprocess_ocr (RapidOCR/Tesseract), segmenter, extractors, rule_parser; parse_service.py facade; skill taxonomy + review queue
│   │   ├── interview/          # DeepSeek (opencode) generation/scoring via llm_router + hardcoded fallback bank
│   │   ├── core/               # CreditService (atomic spend/refunds), storage, rate limiter, llm_router
│   │   ├── rag/                # BM25 + TF-IDF hybrid retrieval over repo docs, DeepSeek RAG Q&A via llm_router
│   │   ├── recommendation/     # Staged student pipeline: retrieval.py (TF-IDF candidates) → ranking.py (heavy scorers) → reranking.py (business rules) → service.py facade (purposes: jobs/skill_gaps/digest); engine.py + recommendation_service.py are compat shims
│   ├── tests/                  # Pytest suite incl. security/credits/interview regression tests
│   └── scripts/                # Seeding, verification, legacy one-off migration scripts
└── README.md
```

---

## 🛠️ Technology Stack

### Backend
- **FastAPI**: Asynchronous high-performance web framework
- **Rule-based resume parser (offline, zero LLM calls)**: deterministic `ingest → preprocess_ocr → segmenter → extractors → rule_parser` pipeline; scanned PDFs via local RapidOCR/Tesseract; rapidfuzz skill matching against the taxonomy
- **DeepSeek via OpenCode (required for chat)**: interview question generation/evaluation, learning-path structuring, RAG answers, and recommendation explanations via the single-provider `llm_router` (exactly one attempt per call; failures raise and callers recover via question bank / template / offline paths); the resume parser does not use it
- **Groq (STT only)**: Whisper transcription via `llm_router.transcribe_audio`
- **SQLAlchemy 2.0**: Modern database mapper
- **Alembic**: Additive, non-destructive schema migrations (`alembic upgrade head`)
- **psycopg2-binary**: PostgreSQL adapter
- **PGVector**: Database vector columns used as embedding caches for the recommendation pipeline and semantic candidate search (similarity is computed in application code, not via in-database ANN queries)
- **BM25 + TF-IDF Hybrid Retrieval**: Custom in-memory retrieval engine powering the RAG Q&A assistant over project documentation (no external vector DB)
- **Pydantic v2**: Structured runtime validation and settings management
- **JWT + bcrypt**: Token-based authentication; tokens embed `iat` and are revoked after password change/reset
- **smtplib**: Automated email verification with 6-digit verification code workflow

### Frontend
- **React 18**: Dynamic component-driven interface
- **Vite 5**: Next-generation frontend bundler
- **Tailwind CSS**: Elegant utilities with premium HSL color palettes
- **Framer Motion**: Smooth micro-animations and slide-overs
- **React Router**: Single Page App SPA routing
- **Lucide React**: Clean vector icon suite
- **React DOM Portals**: High-z-index overlays decoupled from nested layouts

---

## 🚦 Quick Start

For a detailed multi-node deployment walkthrough, please review **`docs_wiki/architecture/DEPLOYMENT.md`**.

### ⚡ 5-Minute Local Dev Setup

#### 1. Backend Server Setup
Ensure PostgreSQL is running locally, then execute in Windows Command Prompt:
```cmd
cd "resume_pipeline"
python -m venv ..\myenv
call ..\myenv\Scripts\activate.bat
pip install -r requirements.txt
```

#### 2. Configure Environment
Copy the repo-root `.env.example` to `.env` **at the repository root** (the app loads it from there) and fill in your API credentials:
```env
# Database Credentials
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=yourpassword
PG_DB=career_guidance

# AI Services
OPENCODE_API_KEY=your_opencode_api_key
GROQ_API_KEY=your_groq_api_key    # STT only

# Email (Gmail SMTP App Password)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password

# Authentication Secret — REQUIRED, min 32 chars (hard requirement when APP_ENV=production)
SECRET_KEY=your-super-secret-jwt-key-min-32-chars

# App URLs
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

#### 3. Initialize & Seed PostgreSQL Database
```cmd
alembic upgrade head                 :: create/evolve schema (SAFE — never drops data)
python scripts/seed_database.py      :: sample users/jobs/applications
python scripts/seed_canonical_skills.py  :: skill taxonomy + runtime config keys
python scripts/verify_data.py        :: integrity check
```

> `scripts/init_db.py` **drops and recreates the entire schema** — development only, never against a real database.

#### 4. Run Development Server
```cmd
uvicorn resume_pipeline.app:app --reload --port 8000
```

#### 5. Frontend UI Setup
Open a separate terminal window and execute:
```cmd
cd "frontend"
npm install
npm run dev
```

*   **Frontend Access**: `http://localhost:3000` (Proxies requests to API on port `8000`)
*   **FastAPI Docs**: `http://localhost:8000/docs`

---

## ☁️ Deployment (GCP VM backend + Vercel frontend)

The documented deploy path is the manual GCE bring-up in
**`deploy/gcp/BRINGUP.md`** (e2-small, backend-only VM; Supabase stays external;
frontend stays on Vercel).

**Secrets (firm rule):** the VM keeps **no `.env` file**. Non-secret config is
exported by `deploy/gcp/user-data.sh`; credentials are read inside the container
at start by `resume_pipeline/docker-entrypoint.py` from **GCP Secret Manager**
(`GCP_PROJECT` set → load `projects/$GCP_PROJECT/secrets/<NAME>/versions/latest`
as the VM service account, fail loudly naming a missing secret). With
`GCP_PROJECT` unset the entrypoint execs straight through, so local
`docker compose --env-file .env up` is unchanged.

Secret **names** (values never committed): `PG_PASSWORD`, `SECRET_KEY`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD` (required) plus optional `OPENCODE_API_KEY`,
`GROQ_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_SEARCH_API_KEY`,
`GOOGLE_CLIENT_SECRET`, `YOUTUBE_DATA_API_KEY`, `GMAIL_APP_PASSWORD`.

**Vercel environment variables** (frontend project, Production): `VITE_API_URL`
= backend origin, optionally `VITE_API_BASE_URL` (takes precedence in
`frontend/src/config/api.js`). No other `VITE_*` variables are read. Build:
`npm run build` → `dist`, SPA rewrites from `frontend/vercel.json`.

---

## 📊 Database Schema Summary

The relational layout consists of **31 PostgreSQL tables** built using SQLAlchemy (16 native PG enums):

*   **Core Accounts**: `users`, `applicants`, `uploads`, `llm_parsed_records`
*   **Vector & Taxonomy**: `embeddings_index`, `applicant_embeddings`, `job_embeddings`, `job_embeddings_cache`, `canonical_skills`
*   **Job Portal**: `employers`, `jobs`, `job_metadata`, `job_recommendations`, `job_applications`
*   **AI Quota Audit**: `credit_accounts`, `credit_transactions`, `credit_usage_stats`, `audit_logs`, `human_reviews`
*   **Interview Engine**: `interview_sessions`, `interview_questions`, `interview_answers`, `learning_paths`, `skill_assessments`, `system_configurations`
*   **Networking**: `mentors`, `mentor_requests`, `interview_schedules`, `interview_feedbacks`

> The former college-portal tables (`colleges`, `college_eligibility`, etc.) were removed; run `resume_pipeline/scripts/drop_college_domain.py` to purge them from pre-existing databases.

---

## 💳 Credit Quotas & Recommendation Rules

To ensure fair-use protection and safeguard against massive API cost overruns:

*   **Base Allocation**: 60 credits allocated on user creation.
*   **Automatic Refills**: Full credit reset every 7 days (caps at a 120-credit cumulative ceiling).
*   **Execution Costs** (authoritative source: `resume_pipeline/resume_pipeline/constants.py` `CREDIT_CONFIG`):
    *   *Full Mock Session*: 10 Credits
    *   *Micro Practice Answer*: 1 Credit
    *   *Coding Question*: 1 Credit *(priced/metered only — no coding-question endpoint exists yet)*
    *   *Skill Roadmap Blueprint (Learning Path)*: 10 Credits
    *   *Recommendation Quota Bypass*: 5 Credits
*   **The Recommendation Cooldown System**:
    *   Recommendations are locked for **24 hours** after generation.
    *   Free updates are unavailable while cooldown is active.
    *   Users can choose to **bypass the cooldown** instantly by spending 5 credits via the bypass confirmation modal.

---

## 🧪 Testing Suite

A solid automated safety net covers backend regression suites and critical frontend workflows. Always verify changes before pushing:

```cmd
:: Backend (from resume_pipeline with venv active; mock LLM + in-memory DB stub)
set GEMINI_MOCK_MODE=true && set CI_SKIP_DB_VALIDATION=true && set SECRET_KEY=test_secret_key_at_least_32_characters_long_for_signing_jwt
pytest tests/ -q --ignore=tests/test_api.py

:: Frontend (from frontend/)
npm test
npm run lint
npm run build
```

Highlights: security perimeter, credit concurrency races, interview lifecycle/abandon beacon, evaluation recovery, rule-based parser golden/section/extractor bars, Alembic migration chain, plus Vitest (88 tests, 14 files) coverage of login, protected routes, credit widget, application tracker, interview session hooks, results polling, skill-gap → learning-path flow, and jobs/results pages. The employer/admin talent-search and user-management surfaces and their tests were removed in the October 2026 student-scope cut.

> `tests/test_api.py` is a live OpenCode connectivity smoke test — excluded from CI by design. CI additionally validates `alembic upgrade head` against disposable PostgreSQL. See `docs_wiki/operations/testing.md`.

---

## 🔒 Security Features
*   **JWT Tokens**: Secure bearer tokens with expiration; tokens carry an `iat` claim and are **revoked automatically after a password change/reset**.
*   **bcrypt Password Hashing**: Adaptive work factors for robust storage protection.
*   **Ownership-Scoped Access Control**: Applicant résumés, recommendations, scheduling, feedback, and candidate intelligence are all relationship-scoped — no IDOR/BOLA paths.
*   **Brute-Force Protection**: Verification/reset codes lock out after 5 failed attempts (DB-backed, multi-worker safe) with per-email resend caps; uniform responses prevent account enumeration.
*   **Atomic Credit Ledger**: Conditional-update spends prevent concurrent double-spend; failures trigger automatic refunds.
*   **XSS Mitigation**: Server-side sanitization of user-submitted job/listing fields plus React's default output escaping.
*   **Double-Verification Guard**: Accounts require 6-digit verification codes sent via SMTP to prevent bot registrations.

---

**Last Updated**: October 2026
**Application Version**: 0.5.0 + Completion Cycle (security hardening, Alembic migrations, durable credits, honest surfaces) + Student-scope rebuild (rule-based offline parser, routers/ split, employer/admin page cut)
