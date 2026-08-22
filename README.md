# Career Guidance AI System (v0.5)

An advanced, premium AI-powered career guidance platform designed to orchestrate intelligent resume parsing, semantic skill normalization, job recommendation, and interactive mock interview practice with live AI feedback.

> **Note:** The college-suitability domain was removed from the codebase (see `resume_pipeline/scripts/drop_college_domain.py`); older documents referencing college grading are obsolete. Live/real-time WebSocket interviews remain a documented proposal (see `docs_wiki/architecture/LIVE_INTERVIEW_ARCHITECTURE.md`) and are **not implemented**.

---

## 🌟 What's New in v0.5

The **v0.5 Release** focuses on high performance, cost optimization, rate-limit resilience, and flawless visual overlays:

1. **Groq-Gemini Hybrid Parser Pipeline**:
   - **Groq Parallel Parser**: Swapped core extraction to Groq (`llama-3.3-70b-versatile`) running 6 concurrent parallel requests in an `asyncio.gather` pool. Highly robust, structured JSON extraction with zero Gemini rate-limiting overhead.
   - **Gemini Vision (Type B/C PDFs)**: Google Gemini is retained exclusively for scanned/image-based resumes requiring OCR-Vision processing.
   - **Semantic Embeddings**: Gemini embeddings are used for advanced skill mapping (fuzzy + semantic passes) to ensure high-accuracy profile alignments.

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
├── deploy/                # Deployment & Docker orchestration
│   ├── docker/
│   │   ├── docker-compose.yml       # Production/Local orchestrator with GROQ environment support
│   │   ├── docker-help.sh
│   │   └── docker-help.bat
│   ├── scripts/
│   │   ├── redeploy.ps1             # PowerShell automated redeployment
│   │   └── setup_dual_db.sh
│   └── aws/
│       └── .env.aws.example
├── frontend/              # React 18 + Vite 5 + Tailwind CSS + Framer Motion (JavaScript/JSX)
│   ├── src/
   │   │   ├── components/    # Reusable UI (CreditWidget, ApplicationTracker, etc. with Portals)
   │   │   ├── pages/         # Core views (StudentDashboard, LearningPaths, Interview flows)
│   │   └── config/        # API and local state secure storage config
├── resume_pipeline/       # FastAPI backend (Python 3.11)
│   ├── resume_pipeline/   # Main package
│   │   ├── app.py         # Entry point; core API routes, CORS alignment, startup self-healing DDL
│   │   ├── db.py          # SQLAlchemy models (18 relational tables)
│   │   ├── config.py      # Pydantic v2 settings (environment-injected)
│   │   ├── constants.py   # CREDIT_CONFIG, API_MESSAGES, RECOMMENDATION_WEIGHTS
│   │   ├── resume/        # Parsing: Groq extractor, Gemini Vision preprocessor, fuzzy skill taxomony
│   │   ├── interview/     # Interview service (Groq-based generation/scoring via llm_router)
│   │   ├── core/          # CreditService, abstract base interfaces
│   │   ├── rag/           # BM25 + TF-IDF hybrid retrieval over repo docs, Gemini RAG Q&A
│   │   └── repos/         # Repository pattern for database decoupling
│   ├── tests/             # Pytest suite
│   └── scripts/           # DB init, sample data seeding, and integrity verification
└── README.md
```

---

## 🛠️ Technology Stack

### Backend
- **FastAPI**: Asynchronous high-performance web framework
- **Groq API (`llama-3.3-70b-versatile`)**: High-speed, structured resume section JSON extraction
- **Google Gemini API**: Scanned PDF OCR-Vision preprocessing + skill embedding generation
- **SQLAlchemy 2.0**: Modern database mapper using the Repository Pattern
- **psycopg2-binary**: PostgreSQL adapter
- **PGVector**: Database vector columns used as embedding caches for the recommendation pipeline (similarity is computed in application code, not via in-database ANN queries)
- **BM25 + TF-IDF Hybrid Retrieval**: Custom in-memory retrieval engine powering the RAG Q&A assistant over project documentation (no external vector DB)
- **Pydantic v2**: Structured runtime validation and settings management
- **JWT + bcrypt**: Token-based authentication and secure password encryption
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

For a detailed multi-node deployment walkthrough, please review **`docs/DEPLOYMENT.md`**.

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
Copy `.env.example` to `.env` inside `resume_pipeline/` and fill in your API credentials:
```env
# Database Credentials
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=yourpassword
PG_DB=career_guidance

# AI Services
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key

# Email (Gmail SMTP App Password)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password

# Authentication Secret
SECRET_KEY=your-super-secret-jwt-key-min-32-chars

# App URLs
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

#### 3. Initialize & Seed PostgreSQL Database
```cmd
python scripts/init_db.py
python scripts/seed_database.py
python scripts/verify_data.py
```

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

We provide a solid automated test suite. Always verify changes before pushing:

```cmd
# Run all tests (from resume_pipeline directory with venv active)
pytest tests/ -q

# Run single unit or integration test
pytest tests/test_parsing.py -v
pytest tests/test_api.py -v
```

---

## 🔒 Security Features
*   **JWT Tokens**: Secure bearer tokens with custom expiration.
*   **bcrypt Password Hashing**: Adaptive work factors for robust storage protection.
*   **Multi-Layer XSS Protection**: Strict sanitization of user strings (HTML escaping) on both client and server inputs.
*   **Double-Verification Guard**: Accounts require 6-digit verification codes sent via secure SMTP to prevent bot registrations.

---

**Last Updated**: June 2026  
**Application Version**: 0.5.0 (Groq Parallel Extraction, Hybrid OCR-Vision, Quota Bypass & Portals)
