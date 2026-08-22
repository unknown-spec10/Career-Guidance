# AGENTS.md — Career Guidance AI System

> Instructions for AI coding agents (Copilot, Claude, Cursor, etc.) operating in this repo.
> For the full Copilot-specific guide see `.github/copilot-instructions.md`.

---

## OpenWiki (docs_wiki)

This repository has documentation located in the /docs_wiki directory.

Start here:
- [OpenWiki quickstart](docs_wiki/quickstart.md)

OpenWiki includes repository overview, architecture notes, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

When working in this repository, read the OpenWiki quickstart first, then follow its links to the relevant architecture, workflow, domain, operation, and testing notes.

---

## Project Overview

Monorepo: Python FastAPI backend (`resume_pipeline/`) + React/Vite frontend (`frontend/`).

Core workflow: Upload resume → Parse via Google Gemini → Store in PostgreSQL → Generate college/job recommendations → Support interview practice → Credit-gated premium features.

---

## Repository Layout

```
Career Guidence/
├── deploy/                # Deployment + Docker orchestration
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   ├── docker-compose.aws-dev.yml
│   │   ├── docker-help.sh
│   │   └── docker-help.bat
│   ├── scripts/
│   │   ├── redeploy.ps1
│   │   └── setup_dual_db.sh
│   └── aws/
│       └── .env.aws.example
├── frontend/              # React 18 + Vite 5 + Tailwind CSS (JavaScript/JSX)
├── resume_pipeline/       # FastAPI backend (Python 3.11)
│   ├── resume_pipeline/   # Main package
│   │   ├── app.py         # Entry point; all routes, CORS, startup
│   │   ├── db.py          # SQLAlchemy models (31 tables, 16 PG enums)
│   │   ├── config.py      # Settings from .env via pydantic-settings
│   │   ├── constants.py   # RECOMMENDATION_WEIGHTS, CREDIT_CONFIG, API_MESSAGES
│   │   ├── schemas.py     # Pydantic v2 request/response models
│   │   ├── auth.py        # JWT + bcrypt; require_role() guard
│   │   ├── utils.py       # File save/hash, XSS sanitization
│   │   ├── resume/        # Parsing: Groq parallel extraction + Gemini vision OCR, skill mapping
│   │   ├── interview/     # Interview service (Groq-based generation/scoring via llm_router)
│   │   ├── core/          # CreditService, abstract interfaces
│   │   ├── recommendation/# Scoring engine for jobs
│   │   ├── rag/           # BM25 + TF-IDF hybrid retrieval over repo docs (no FAISS), Gemini RAG Q&A
│   │   └── repos/         # Repository pattern (PostgreSQL impl) — currently orphaned/dead code
│   ├── tests/             # pytest test suite
│   └── scripts/           # DB init/seed/verify helpers
├── data/raw_files/        # Per-applicant file storage (app_<uuid>/)
├── docs/                  # Architecture, database, deployment docs
└── README.md
```

---

## Build / Dev Commands

### Backend (run from `resume_pipeline/` with venv active)

```powershell
# Activate virtual environment (Windows PowerShell)
..\myenv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start dev server (auto-reload)
uvicorn resume_pipeline.app:app --reload --port 8000

# Database management
python scripts/init_db.py        # DESTRUCTIVE: drops & recreates all tables (dev ONLY)
alembic upgrade head             # Apply pending migrations (SAFE — use this for real DBs)
alembic revision -m "..."        # Create a new incremental migration
python scripts/seed_database.py  # Populate sample data
python scripts/seed_canonical_skills.py  # Seed skill taxonomy + credit config keys
python scripts/verify_data.py    # Verify data integrity
```

### Frontend (run from `frontend/`)

```powershell
npm install
npm run dev      # Vite dev server on port 3000 (proxies /api to :8000)
npm run build    # Production build → dist/
npm run preview  # Preview production build
npm run lint     # ESLint (zero warnings tolerance)
```

---

## Test Commands

### Run all backend tests

```powershell
# From resume_pipeline/ with venv active
pytest tests/ -q           # Quiet
pytest tests/ -v           # Verbose
```

### Run a single test file

```powershell
pytest tests/test_parsing.py -v        # Unit tests (no server needed)
pytest tests/test_rag_concurrency.py -v
```

### Run a single test function

```powershell
pytest tests/test_parsing.py::test_text_extraction -v
pytest tests/test_parsing.py::test_skill_mapping -v

# Show print() output
pytest tests/test_parsing.py::test_cgpa_normalization -v -s
```

### Notes on tests

- `test_parsing.py` — pure unit tests; no server required.
- `test_rag_concurrency.py` — uses `unittest.mock` + `tempfile`; no external dependencies.
- `test_security_perimeter.py`, `test_interview_abandon.py`, `test_credit_durability.py`,
  `test_code_hardening.py`, `test_evaluation_recovery.py`, `test_env_validation.py`,
  `test_migrations.py` — sqlite/TestClient regression suites added by the completion
  cycle (auth perimeter, BOLA, credits atomicity/refunds, code lockouts, abandon
  HMAC flow, evaluation retry, env validation, migration chain). No server or real
  DB needed.
- `test_api.py` — a single live-key Gemini connectivity smoke test only; it is NOT an integration suite and is excluded from CI (`ci-cd.yml` also ignores test_interview, test_learning_path, test_recommendation_fallback, test_recommendation_system).
- Set `GEMINI_MOCK_MODE=true` in `.env` to stub LLM calls during testing.
- No frontend test framework is configured (no Jest/Vitest).

---

## Code Style — Python (Backend)

### Formatting & tooling

- No Black/isort enforced; follow existing style (4-space indent, ~100 char line length).
- Pyright is configured but all type errors are suppressed in `pyrightconfig.json` (SQLAlchemy compatibility).
- Add `# pyright: reportAttributeAccessIssue=false` at module top only when needed for ORM descriptors.

### Imports

```python
# Order: stdlib → third-party → local (relative)
import json
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

from fastapi import HTTPException, Depends
import sqlalchemy

from ..config import settings
from ..db import User, Applicant
from ..constants import CREDIT_CONFIG
from .llm_gemini import GeminiLLMClient
```

Always use **relative imports** within the `resume_pipeline` package.

### Type hints

- All function signatures must have type annotations.
- Use `Optional[X]`, `List[X]`, `Dict[str, Any]` from `typing` (not bare `X | None` except in `config.py`).
- Pydantic v2 models use `Field()`, `EmailStr`, `Optional`, `List`.

### Naming

| Kind | Convention | Example |
|---|---|---|
| Files/modules | `snake_case` | `parse_service.py` |
| Classes | `PascalCase` | `ResumeParserService` |
| Functions/methods | `snake_case` | `get_current_user()` |
| Variables | `snake_case` | `applicant_id` |
| Constants | `UPPER_SNAKE_CASE` | `RECOMMENDATION_WEIGHTS` |
| Pydantic schemas | `PascalCase` + suffix | `JobCreate`, `JobResponse` |
| SQLAlchemy models | `PascalCase` singular | `CollegeApplicabilityLog` |
| Enum values | `UPPER_SNAKE_CASE` | `UserRole.STUDENT` |

### Error handling

- Raise `HTTPException(status_code=..., detail="...")` for all API errors.
- Use `try/finally` to ensure `db.close()` is always called.
- Log with `logger.error(f"...")` before raising or returning a safe default.
- Credit eligibility failures → `HTTPException(402)`.
- JWT failures → `HTTPException(401)` with `WWW-Authenticate: Bearer`.
- Never silently swallow exceptions; either log+raise or log+return safe default.

### Database patterns

- Use `joinedload` to avoid N+1 queries when accessing related models.
- New routes go in `app.py` with `@require_role('student'|'employer'|'college')` guard.
- Extend `db.py` for new models; update `schemas.py` for new Pydantic shapes.
- Tune weights/costs in `constants.py`, not inline.

---

## Code Style — JavaScript (Frontend)

### Imports

```javascript
// Order: React → third-party → internal (all relative paths)
import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Briefcase } from 'lucide-react'
import api from '../config/api'
import { ANIMATION_DELAYS } from '../config/constants'
import { useToast } from '../hooks/useToast'
import StatusBadge from '../components/StatusBadge'
```

- No path aliases (`@/`) — use relative paths only.
- No TypeScript; `@types/react` is present only for IDE intellisense.
- No PropTypes used.

### Naming

| Kind | Convention | Example |
|---|---|---|
| Component files | `PascalCase` | `StudentDashboard.jsx` |
| Hook files | `camelCase` | `useAuth.js`, `useToast.js` |
| Utility files | `camelCase` | `apiRetry.js`, `secureStorage.js` |
| Config files | `camelCase` | `api.js`, `constants.js` |
| React components | `PascalCase` function | `export default function StudentDashboard()` |
| Hooks | `use` prefix | `useAuth`, `useOptimistic` |
| State/variables | `camelCase` | `applicantData`, `uploadLoading` |
| JS Constants | `UPPER_SNAKE_CASE` | `ANIMATION_DELAYS`, `API_TIMEOUTS` |
| Event handlers | `handle` prefix | `handleReset`, `handleChange` |

### Component patterns

- Functional components with hooks only — no class components (except `ErrorBoundary`).
- Default exports for pages and components; named exports for hooks and utilities.
- Framer Motion for all animations; use `ANIMATION_DELAYS` from `constants.js`.
- Lucide React for icons.

### Error handling

- `ErrorBoundary` wraps the entire app — catches render errors.
- Axios interceptors handle 401 (clear session + redirect) and 5xx/429 globally.
- Hooks return `{ success: false, error }` on failure — never throw from hooks.
- `apiRetry.js` applies exponential backoff (3 retries, 1s→10s) for transient errors.
- Surface errors to users via `useToast`, not `alert()`.
- Use `console.error()` for frontend error logging.

---

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Required for resume parsing and interview evaluation |
| `GEMINI_MOCK_MODE=true` | Stub LLM — use for testing without API calls |
| `PG_DSN` | Full DB connection string (`postgresql+psycopg2://...`); falls back to SQLite in-memory if `PG_HOST` not set |
| `PG_HOST` / `PG_PORT` / `PG_USER` / `PG_PASSWORD` / `PG_DB` | Discrete PostgreSQL connection fields (alternative to `PG_DSN`) |
| `SECRET_KEY` | JWT signing (min 32 chars) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Email verification via Gmail SMTP |
| `GROQ_API_KEY` | RAG Q&A system |
| `VITE_API_URL` | Frontend production API base URL |

---

## Critical Conventions

- **ID types**: External `applicant_id` is `app_<uuid>` (string). Many endpoints (e.g., recommendations) require the integer DB id (`db_applicant_id`). Never confuse them.
- **Job visibility**: Jobs must have `status='approved'` AND `expires_at > now` to appear publicly.
- **Skill matching**: Word-boundary regex (`\bPython\b`) for skill names ≥ 3 chars; exact match for shorter.
- **Credits**: Always call `CreditService.check_eligibility()` before executing premium features; call `spend_credits()` only after success.
- **File storage**: All file writes go under `data/raw_files/app_<uuid>/`; update `metadata.json` when user-provided fields affect parsing.
- **CORS origins**: `http://localhost:3000`, `http://localhost:5173`, `https://career-guidance-frontend-pcjn.onrender.com` — keep Vite proxy config and Render `CORS_ORIGINS` env var aligned when adding new domains.
- **Recommendation weights**: Defined in `constants.py` as `RECOMMENDATION_WEIGHTS` — do not hardcode inline.

---

## Production Deployment

### Deployed Services

| Component | Host / Provider | Details / Settings |
|---|---|---|
| Frontend (React) | Vercel | Static SPA deployment |
| Backend (FastAPI) | AWS EC2 | FastAPI python service running in Docker container |
| Database | Supabase | PostgreSQL instances on port `5432` / pooler port `6543` |

### AWS EC2 Backend Service

- **Deployment context**: Dockerized container running from the repository context.
- **Port mapping**: External port `8000` is bound to container port `8000`.
- **`PG_DSN` is NOT set**: Derived dynamically from `PG_*` variables inside `config.py` using `quote_plus` to avoid issues with special password characters.

### Vercel Frontend Service

- **Build config**: `npm run build` with output directory set to `dist`.
- **`vercel.json`**: Routing rules rewrite all paths back to `/index.html` to allow React Router SPA client routing.
- **`VITE_API_URL`**: Defined inside Vercel Dashboard env vars to point to the public IP/DNS of the EC2 backend: `http://<ec2-ip>:8000`.

### Supabase Database

- **Session pooler host**: `aws-1-ap-south-1.pooler.supabase.com` (port `5432` or transaction pooler port `6543`).
- **Username**: `postgres.taalckzdvzxaigpdseme` (standard Supabase pooler credentials format).
- **Database**: `postgres`
- Migration strategy: **Alembic** (`alembic.ini` + `alembic/`), wired to the app's PG settings. Baseline migration `0001_baseline` is a non-destructive `create_all(checkfirst=True)`; all schema changes after it must be incremental revisions. Apply with `alembic upgrade head`. Legacy destructive scripts (`scripts/init_db.py`, drop/recreate migrators) are dev-only and must never run against real databases.

### Key Deployment Conventions

- **`config.py`** uses `model_config = SettingsConfigDict(env_file=None)` — pydantic-settings loads from OS environment variables injected into the container/shell on production.
- **`db.py`** uses `SQLAlchemy URL.create()` for Supabase connections to avoid string-parsing issues with special characters in passwords.
- **`IS_SUPABASE`** flag in `config.py` is auto-detected from `PG_HOST` containing `supabase.co` or `supabase.com`; controls SSL mode and startup behaviour.
- **Docker build context** is the repo root (`Dockerfile` at `resume_pipeline/Dockerfile`); all `COPY` paths must use the `resume_pipeline/` prefix.
- **Do not bake `.env` into the Docker image** — `.dockerignore` at repo root excludes it.

### Common Deployment Pitfalls

- Using the wrong Supabase pooler region (e.g. `aws-0-us-east-1` instead of `aws-1-ap-south-1`) → `FATAL: Tenant or user not found`.
- Setting `PG_DSN` as an environment variable with special chars in the password → causes a malformed DSN. Always use the individual `PG_*` fields instead.
- Adding a new frontend domain without updating `CORS_ORIGINS` on the backend → API calls blocked by CORS.

---

## Common Pitfalls

- Passing string `applicant_id` where an integer DB id is expected.
- Missing `.env` values (`GEMINI_API_KEY`, PostgreSQL credentials) — DB init fails silently or stubs features.
- Running integration tests without the backend server — use `GEMINI_MOCK_MODE=true` and start `uvicorn` first.
- N+1 queries — always use `joinedload` when loading relations in SQLAlchemy.
- Rate limiting is in-memory (`defaultdict(list)` in `app.py`) — not safe for multi-process deployments.
