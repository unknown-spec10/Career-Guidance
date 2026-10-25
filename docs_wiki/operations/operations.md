# Operations & Commands

This document contains instructions for running, managing, and deploying the Career Guidance system locally and in production.

---

## Local Development Setup

### Backend (Python 3.11 FastAPI)
Always activate the virtual environment before installing dependencies or running backend commands.

```powershell
# From the repository root:
# 1. Activate virtual environment
.\myenv\Scripts\Activate.ps1

# 2. Navigate to backend directory
cd resume_pipeline

# 3. Install dependencies
pip install -r requirements.txt

# 4. Initialize the PostgreSQL Database (Creates 18 tables)
python scripts/init_db.py

# 5. Populate the database with sample seed data
python scripts/seed_database.py

# 6. Verify seed data integrity
python scripts/verify_data.py

# 7. Start the FastAPI development server
uvicorn resume_pipeline.app:app --reload --port 8000
```

### Frontend (React + Vite)
The Vite server proxies `/api` requests to the FastAPI backend running on port `8000`.

```powershell
# From the repository root:
cd frontend

# Install Node modules
npm install

# Start Vite dev server on http://localhost:3000
npm run dev

# Run ESLint validation checks
npm run lint

# Build production bundle (compiled into dist/)
npm run build
```

---

## Environment Variable Reference

Ensure the `.env` file at the repository root contains the following variables:

| Variable | Scope | Description |
|---|---|---|
| `OPENCODE_API_KEY` | Backend | Chat/explanation credential for ALL chat workloads via `llm_router` → OpenCode/DeepSeek (interview, RAG, learning paths, explanations). Resume parsing is offline and needs no key |
| `GROQ_API_KEY` | Backend | STT credential (Whisper transcription) |
| `GEMINI_MOCK_MODE` | Backend | Legacy name of the global mock toggle: `true` serves offline mock completions (no HTTP, no credentials). Gemini itself is removed |
| `MODEL_CHAT_PRIMARY_PROVIDER` / `MODEL_CHAT_PRIMARY_NAME` | Backend | Chat capability: single provider + model (default `opencode` / `deepseek-v4.1-flash`); failure raises |
| `MODEL_EXPLAIN_PRIMARY_PROVIDER` / `MODEL_EXPLAIN_PRIMARY_NAME` | Backend | Explanation: single provider + model (default `opencode` / `deepseek-v4.1-flash`; failure → offline). Swap via env only |
| `MODEL_STT_PROVIDER` / `MODEL_STT_NAME` | Backend | Speech-to-text provider + model (default `groq` / `whisper-large-v3`) |
| `PG_DSN` | Backend | Full Postgres DSN (e.g. `postgresql+psycopg2://user:pass@host/db`) |
| `PG_HOST` / `PG_USER` / `PG_PASSWORD` | Backend | Individual Postgres connection parameters (fallback to DSN) |
| `SECRET_KEY` | Backend | Secret used to sign authentication JWT tokens (min 32 chars) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD`| Backend | Gmail credentials used to dispatch email verification tokens |
| `VITE_API_URL` | Frontend | Base URL of the API server (used in production builds) |

Legacy provider model keys (`GROQ_CHAT_MODEL`, `GROQ_STT_MODEL`) are still read, but only as
defaults when the matching `MODEL_*_NAME` slot is empty — set the `MODEL_*`
slots to override without touching them. Removed (Oct 2026 cutover): all `GEMINI_*`
keys except `GEMINI_MOCK_MODE` (kept as the legacy name of the global mock
toggle), plus `GROQ_TTS_*`, `NVIDIA_NIM_*`, `OPENROUTER_*`,
`GOOGLE_EMBEDDING_ENABLED`, `EMBEDDING_TIMEOUT_SECONDS`.

### Chat routing (Oct 2026 cutover: opencode/DeepSeek single provider, no fallback)

The `opencode` provider (OpenAI-compatible `/chat/completions` via
`OPENCODE_API_BASE_URL`, default `https://opencode.ai/zen/v1`) is the default
chat + explanation provider — the capability slots already ship that way, so no
env changes are needed for the default path. Each call makes exactly one
adapter attempt and raises on failure (callers recover via question bank /
template / offline paths):

```powershell
$env:OPENCODE_API_KEY="<zen-api-key>"
$env:OPENCODE_API_BASE_URL="https://opencode.ai/zen/v1"  # default; set only to override
$env:OPENCODE_CHAT_MODEL="deepseek-v4.1-flash"           # default; set only to override
```

The `explanation` capability defaults to `opencode` → offline unless its slots
are pointed elsewhere.

---

## Production Deployment Architecture

The application is deployed across multiple cloud environments:

```mermaid
graph LR
    Vercel[Vercel: React App] -->|HTTPS Request| EC2[AWS EC2: Dockerized FastAPI]
    EC2 -->|SQL Queries| Supabase[Supabase: PostgreSQL DB]
```

### AWS EC2 Backend Deployment
* **Containerization**: The backend is package-built inside a Docker container (refer to `resume_pipeline/Dockerfile`).
* **Supabase Connection**: Docker containers use discrete `PG_*` environment variables instead of `PG_DSN` to prevent problems with passwords containing special characters (which can break inline URL parsing).
* **Supabase pooler host**: Deployed using region-specific Supabase poolers (e.g., `aws-1-ap-south-1.pooler.supabase.com`). Using incorrect pooler regions will cause database connection errors.
* **CORS Settings**: Any newly added domains (e.g. staging subdomains) must be explicitly allowed under `CORS_ORIGINS` inside the backend's runtime configuration.

---

## Detailed Operations References (`docs/`)

For detailed deployment strategies and operational parameters:
- **[Deployment Manual](../docs/DEPLOYMENT.md)**: Steps for Vercel, Supabase migration details, AWS EC2 Docker setups, and troubleshooting.
- **[Implementation & Delivery Guide](../docs/IMPLEMENTATION_GUIDE.md)**: Deployment verification checklists.
- **[System Telemetry docs](../docs/telemetry.md)**: Monitoring configurations, error tracking, and performance logs.

