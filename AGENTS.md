# AGENTS.md — Career Guidance AI System

> Instructions for AI coding agents (Copilot, Claude, Cursor, etc.) operating in this repo.
> For the full Copilot-specific guide see `.github/copilot-instructions.md`.

---

## Project Overview

Monorepo: Python FastAPI backend (`resume_pipeline/`) + React/Vite frontend (`frontend/`).

Core workflow: Upload resume → Parse via Google Gemini → Store in PostgreSQL → Generate college/job recommendations → Support interview practice → Credit-gated premium features.

---

## Repository Layout

```
Career Guidence/
├── frontend/              # React 18 + Vite 5 + Tailwind CSS (JavaScript/JSX)
├── resume_pipeline/       # FastAPI backend (Python 3.11)
│   ├── resume_pipeline/   # Main package
│   │   ├── app.py         # Entry point; all routes, CORS, startup
│   │   ├── db.py          # SQLAlchemy models (18 tables)
│   │   ├── config.py      # Settings from .env via pydantic-settings
│   │   ├── constants.py   # RECOMMENDATION_WEIGHTS, CREDIT_CONFIG, API_MESSAGES
│   │   ├── schemas.py     # Pydantic v2 request/response models
│   │   ├── auth.py        # JWT + bcrypt; require_role() guard
│   │   ├── utils.py       # File save/hash, XSS sanitization
│   │   ├── resume/        # Parsing: LLM, OCR, skill mapping
│   │   ├── interview/     # Interview service (Gemini-based scoring)
│   │   ├── core/          # CreditService, abstract interfaces
│   │   ├── recommendation/# Scoring engine for colleges & jobs
│   │   ├── rag/           # FAISS vector store, RAG Q&A pipeline
│   │   └── repos/         # Repository pattern (PostgreSQL impl)
│   ├── tests/             # pytest test suite
│   └── scripts/           # DB init/seed/verify helpers
├── data/raw_files/        # Per-applicant file storage (app_<uuid>/)
├── docs/                  # Architecture, database, deployment docs
└── docker-compose.yml     # Full-stack Docker orchestration
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
python scripts/init_db.py        # Drop & recreate all 18 tables
python scripts/seed_database.py  # Populate sample data
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
pytest tests/test_api.py -v            # Integration tests (auto-skip if server down)
pytest tests/test_rag_concurrency.py -v
```

### Run a single test function

```powershell
pytest tests/test_parsing.py::test_text_extraction -v
pytest tests/test_parsing.py::test_skill_mapping -v
pytest tests/test_api.py::test_upload_endpoint -v

# Show print() output
pytest tests/test_parsing.py::test_cgpa_normalization -v -s
```

### Notes on tests

- `test_parsing.py` — pure unit tests; no server required.
- `test_api.py` — integration; auto-skips via `pytest.skip()` if `localhost:8000` is not running.
- `test_rag_concurrency.py` — uses `unittest.mock` + `tempfile`; no external dependencies.
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

### Live URLs

| Service | URL |
|---|---|
| Frontend (React) | `https://career-guidance-frontend-pcjn.onrender.com` |
| Backend (FastAPI) | `https://career-guidance-1sep.onrender.com` |
| Backend API docs | `https://career-guidance-1sep.onrender.com/docs` |

### Infrastructure

| Component | Provider | Details |
|---|---|---|
| Backend hosting | Render | Web service `srv-d6pgciqa214c7397rv8g`, name `Career-Guidance` |
| Frontend hosting | Render | Static site `srv-d6pv47hj16oc73bnn4ng`, name `career-guidance-frontend` |
| Database | Supabase | Project `taalckzdvzxaigpdseme`, region `ap-south-1` |

### Render — Backend Web Service

- **Service ID**: `srv-d6pgciqa214c7397rv8g`
- **Owner ID**: `tea-d6pff6qa214c7397d3fg`
- **Runtime**: Docker (`resume_pipeline/Dockerfile`), build context: repo root
- **Auto-deploy**: enabled on push to `main`
- **`PG_DSN` is NOT set** — DSN is built from parts in `config.py` using `quote_plus`

### Render — Frontend Static Site

- **Service ID**: `srv-d6pv47hj16oc73bnn4ng`
- **Root dir**: `frontend/`
- **Build command**: `npm install && npm run build`
- **Publish path**: `dist`
- **Auto-deploy**: enabled on push to `main`
- **`VITE_API_URL`** is set as a Render build environment variable (not from `.env.production`, which is gitignored by root `.gitignore` via `*.env.*`)
- `frontend/public/_redirects` contains `/* /index.html 200` for React Router SPA routing

### Supabase Database

- **Project ref**: `taalckzdvzxaigpdseme`
- **Region**: `ap-south-1` (Asia Pacific South) — **critical**, wrong region = connection failure
- **Session pooler host**: `aws-1-ap-south-1.pooler.supabase.com` (port `5432`)
- **Username**: `postgres.taalckzdvzxaigpdseme` (pooler format, not plain `postgres`)
- **Database**: `postgres`
- All 29 tables + 21 ENUMs are applied via migrations

### Backend Environment Variables (Render)

```
PG_HOST=aws-1-ap-south-1.pooler.supabase.com
PG_PORT=5432
PG_USER=postgres.taalckzdvzxaigpdseme
PG_PASSWORD=<supabase password>
PG_DB=postgres
# PG_DSN must NOT be set — config.py builds it from the above parts
GEMINI_API_KEY=...
GEMINI_MOCK_MODE=false
GROQ_API_KEY=...
SECRET_KEY=...
CORS_ORIGINS=https://career-guidance-1sep.onrender.com,https://career-guidance-frontend-pcjn.onrender.com,http://localhost:3000,http://localhost:5173
FRONTEND_URL=https://career-guidance-frontend-pcjn.onrender.com
```

### Key Deployment Conventions

- **`config.py`** uses `model_config = SettingsConfigDict(env_file=None)` — pydantic-settings never reads `.env` files; only OS env vars (injected by Render) are used.
- **`load_dotenv`** is skipped when `RENDER` env var is present (set automatically by Render on all services).
- **`db.py`** uses `SQLAlchemy URL.create()` for Supabase connections to avoid string-parsing issues with special characters in passwords.
- **`IS_SUPABASE`** flag in `config.py` is auto-detected from `PG_HOST` containing `supabase.co` or `supabase.com`; controls SSL mode and startup behaviour.
- **Docker build context** is the repo root (`Dockerfile` at `resume_pipeline/Dockerfile`); all `COPY` paths must use the `resume_pipeline/` prefix.
- **Do not bake `.env` into the Docker image** — `.dockerignore` at repo root excludes it.

### Common Deployment Pitfalls

- Using the wrong Supabase pooler region (e.g. `aws-0-us-east-1` instead of `aws-1-ap-south-1`) → `FATAL: Tenant or user not found`.
- Setting `PG_DSN` as a Render env var with special chars in the password → Render percent-encodes them, causing a malformed DSN. Always use the individual `PG_*` fields instead.
- A `requirements.txt` in `frontend/` causes Render to treat it as a Python project and fail the build — keep `frontend/` free of `requirements.txt`.
- Forgetting `frontend/public/_redirects` → direct navigation to any React Router route returns 404 from the CDN.
- Adding a new frontend domain without updating `CORS_ORIGINS` on the backend → API calls blocked by CORS.

---

## Common Pitfalls

- Passing string `applicant_id` where an integer DB id is expected.
- Missing `.env` values (`GEMINI_API_KEY`, PostgreSQL credentials) — DB init fails silently or stubs features.
- Running integration tests without the backend server — use `GEMINI_MOCK_MODE=true` and start `uvicorn` first.
- N+1 queries — always use `joinedload` when loading relations in SQLAlchemy.
- Rate limiting is in-memory (`defaultdict(list)` in `app.py`) — not safe for multi-process deployments.
