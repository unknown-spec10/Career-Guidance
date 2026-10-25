# Career Guidance AI — Deployment & Infrastructure Guide

This document outlines the deployment model, infrastructure assumptions, configuration details, and verification steps for transitioning the Career Guidance AI platform to staging and production environments.

---

## 🏗️ Core Runtime Model

The active deployment model is highly streamlined, completely self-contained, and requires **no external message brokers or separate worker processes**:

- **Frontend**: React 18 + Vite 5 static build (served via Nginx in Docker or CDNs like Render/Vercel/Netlify).
- **Backend API**: FastAPI (Python 3.11) asynchronous web service.
- **Background Pipeline**: FastAPI-native in-process `BackgroundTasks` for asynchronous resume parsing, skill normalization, embedding updates, and recommendation generations.
- **Database**: PostgreSQL (with PGVector extensions for semantic embeddings and matching).

> [!IMPORTANT]
> **Celery & Redis Legacy Removal**:
> Historical configurations using Celery workers and Redis queues have been completely deprecated and removed. All asynchronous workloads (OCR preprocessing, LLM parsing, semantic index building, and recommendation loops) run in-process using non-blocking background threads, dramatically reducing cost, latency, and deployment complexity.

---

## 🔐 Environment Variables

The backend loads settings dynamically from OS environment variables. In local development, the app can also fall back to a `.env` file at the repository root.

### Database Credentials
- `PG_HOST`: PostgreSQL server host (e.g., `localhost` or cloud URL).
- `PG_PORT`: PostgreSQL port (defaults to `5432`).
- `PG_USER`: PostgreSQL user name.
- `PG_PASSWORD`: Password for the PostgreSQL user.
- `PG_DB`: Name of the target database (e.g., `career_guidance`).
- `PG_DSN`: (Optional) Full connection string (`postgresql+psycopg2://...`). If provided, it overrides individual `PG_*` fields. 

### Security & Authentication
- `SECRET_KEY`: Minimally a 32-character secure string used for signing JWT tokens. **Generate with `openssl rand -hex 32`**.
- `JWT_ALGORITHM`: Token signature standard (defaults to `HS256`).
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Expiration window (defaults to `1440` minutes / 24 hours).

### AI & LLM Services
- `OPENCODE_API_KEY`: Credential for ALL chat/explanation workloads (interview generation/scoring, learning paths, RAG answers, recommendation explanations) via `core/llm_router` → OpenCode/DeepSeek. Resume parsing is offline and needs no key; recommendation embeddings are local MiniLM.
- `GROQ_API_KEY`: Credential for the speech-to-text provider only (Whisper transcription via `llm_router.transcribe_audio`).
- `GEMINI_MOCK_MODE`: Legacy name of the global mock toggle. Set to `true` to serve deterministic offline mock completions with no HTTP and no credentials during testing/development (defaults to `false`). Gemini itself is fully removed.

### Model Selection (capability-based, env-only swap)
Chat callers never name a provider or model directly — `core/llm_router.py`
resolves each capability slot to its single configured primary provider
(one attempt, then raise). To swap models with no code changes, set these
env vars and restart:
- `MODEL_CHAT_PRIMARY_PROVIDER` / `MODEL_CHAT_PRIMARY_NAME` (default `opencode` / `deepseek-v4.1-flash`)
- `MODEL_EXPLAIN_PRIMARY_PROVIDER` / `MODEL_EXPLAIN_PRIMARY_NAME` (default `opencode` / `deepseek-v4.1-flash`; failure → offline explanation)
- `MODEL_STT_PROVIDER` / `MODEL_STT_NAME` (default `groq` / `whisper-large-v3`)

An empty `*_NAME` keeps the provider default (`OPENCODE_CHAT_MODEL`,
`GROQ_CHAT_MODEL`, `GROQ_STT_MODEL`), so existing
deployments behave identically until the slots are set. Removed (Oct 2026
cutover): `GEMINI_API_KEY`, `GEMINI_API_URL`, `GEMINI_SMALL_MODEL`,
`GEMINI_LARGE_MODEL`, `GEMINI_INTERVIEW_MODEL`, `GROQ_TTS_*`, `NVIDIA_NIM_*`,
`OPENROUTER_*`, `GOOGLE_EMBEDDING_ENABLED`, `EMBEDDING_TIMEOUT_SECONDS`.

### Email Integration (Gmail SMTP)
- `GMAIL_USER`: The sender Gmail address (required for registration code verification).
- `GMAIL_APP_PASSWORD`: A 16-character Gmail App Password (do not use your primary password).

### Networking & CORS
- `FRONTEND_URL`: Primary frontend domain used for redirects and link buildings (e.g., `https://your-site.vercel.app`).
- `CORS_ORIGINS`: Comma-separated list of allowed CORS origins (e.g., `http://localhost:3000,http://localhost:5173,https://your-site.vercel.app`).

---

## ⚡ Local Deployment (Single-Command Docker)

The easiest way to run the backend locally is using the root `docker-compose.yml`
(backend-only; the frontend runs via `npm run dev`, the database is external
PostgreSQL/Supabase).

### Prerequisites
Make sure Docker and Docker Compose are installed. Ensure port `8000` (backend API)
is not bound by another service. (The frontend dev server uses port `3000` via
`npm run dev` in `frontend/` — it is not containerized.)

### Steps
1. Copy the environment template:
   ```cmd
   cp .env.example .env
   ```
   then fill in `PG_*`, `SECRET_KEY`, and any AI/SMTP keys.
2. Build and start the backend:
   ```cmd
   docker compose --env-file .env up -d --build
   ```
3. Seed the sample database (run this once, from `resume_pipeline/`):
   ```cmd
   alembic upgrade head
   python scripts/seed_database.py
   ```
   or against the running container:
   ```cmd
   docker compose exec backend python scripts/seed_database.py
   ```
4. Access the applications:
   - **Frontend UI (dev)**: `http://localhost:3000` (`npm run dev` in `frontend/`)
   - **Backend API**: `http://localhost:8000`
   - **FastAPI Docs**: `http://localhost:8000/docs`

---

## ☁️ Production Cloud Deployment (Supabase, GCP VM & Vercel)

Our production deployment environment is split across **Supabase** (database), a **GCP VM** (FastAPI backend, manual bring-up per `deploy/gcp/BRINGUP.md`), and **Vercel** (React frontend SPA).

### 1. Database Setup (Supabase)
1. Provision a PostgreSQL instance on [Supabase](https://supabase.com) in your closest region.
2. Go to **Project Settings → Database → Connection string → URI tab** and copy the connection URI.
   > [!CRITICAL]
   > **Special Characters in Database Passwords**:
   > Prefer the discrete `PG_*` fields in the root `.env` (config.py derives the DSN with `quote_plus`) instead of pasting a raw DSN — this avoids SQLAlchemy/psycopg2 parsing failures on special characters (e.g. `@`, `&`, `#`). If you must use `PG_DSN`, percent-encode them (e.g. `@` -> `%40`, `&` -> `%26`).
3. Apply the schema with Alembic (from `resume_pipeline/`), then seed:
   ```cmd
   alembic upgrade head
   python scripts/seed_database.py
   ```
   > `scripts/init_db.py` **drops and recreates the entire schema** — development only, never against a real database.

---

### 2. Frontend Static Site (Vercel)
Deploy the React frontend SPA onto [Vercel](https://vercel.com) directly from the repository's `frontend/` subdirectory:

* **Framework Preset**: `Vite`
* **Root Directory**: `frontend`
* **Build Command**: `npm run build`
* **Output Directory**: `dist`
* **Routing Rewrites (`vercel.json`)**: Configured automatically at `frontend/vercel.json` to route all SPA routes back to `/index.html` to avoid 404 reload issues.

#### Vercel Environment Variables

Set this variable in the **Vercel Project Dashboard → Settings → Environment Variables**:

| Variable Key | Suggested Placeholder Value | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://<your-vm-ip-or-domain>:8000` | The URL of your active backend VM service (do not include a trailing `/`). |

---

## ☁️ Production VM Deployment (Docker Hub + GCP manual path)

> **EC2 automation removed.** `deploy/aws/` (`ec2-user-data.sh`, `.env.aws.example`,
> `apply-ec2-env.ps1`) and `deploy/docker/docker-compose.prod.yml` were deleted in the
> deploy-path cleanup, and the `ec2-deploy` CI job is parked (`if: false` in
> `.github/workflows/ci-cd.yml`). The documented deploy path is the **manual GCE
> bring-up**: `deploy/gcp/BRINGUP.md` (startup script `deploy/gcp/user-data.sh`),
> the single root `docker-compose.yml` (backend-only), and
> `resume_pipeline/Dockerfile`.

For teams utilizing managed services, the platform is structured to run the database on **Supabase**, the React frontend SPA on **Vercel**, and the FastAPI backend API on a small **GCP e2-small VM** (see `deploy/gcp/BRINGUP.md` for the console click path, IP, start/stop, and warm-up checklist).

Using prebuilt Docker images from Docker Hub bypasses the need to build resource-heavy Python images directly on the VM, making it fully compatible with low-memory `e2-small` instances.

### 1. Build and Push Backend Image to Docker Hub

Since the frontend is built and served statically by Vercel directly from Git, and the database is managed by Supabase, only the backend API needs to be pushed to Docker Hub. Run the helper script from your local development machine:

* **Windows (PowerShell)**:
  ```powershell
  .\deploy\dockeruild-and-push.ps1 -DockerUsername "yourusername"
  ```
* **Linux/macOS (Bash)**:
  ```bash
  chmod +x ./deploy/docker/build-and-push.sh
  ./deploy/docker/build-and-push.sh "yourusername"
  ```

This tags the backend image with `:latest` and a unique `:yyyyMMdd-HHmmss` timestamp, then pushes it to:
- `yourusername/career-guidance-backend`

### 2. Launch the VM (GCP — see deploy/gcp/BRINGUP.md)

Follow the console click path in `deploy/gcp/BRINGUP.md`: `e2-small` (2 vCPU,
2 GB), Ubuntu 22.04 LTS, 30 GB disk, network tags `http-server`/`https-server`,
plus a VPC firewall rule allowing `tcp:8000`. Paste the contents of
`deploy/gcp/user-data.sh` into the GCE **Automation > Startup script** field.
Edit its config block (`REPO_URL`, `GCP_PROJECT`, `DOCKER_HUB_USERNAME`, plus the
non-secret `PG_HOST`/`PG_USER`/`CORS_ORIGINS`/`FRONTEND_URL` values) before boot.
**Do not create a `.env` on the VM** — there is no `--env-file` path.

### 3. Secrets on the VM: GCP Secret Manager only (no `.env`)

The VM keeps **no `.env` file**. At container start,
`resume_pipeline/docker-entrypoint.py` sees `GCP_PROJECT`, reads each documented
secret from `projects/$GCP_PROJECT/secrets/<NAME>/versions/latest` as the VM
service account (Application Default Credentials), exports it into the process
environment, and then execs uvicorn. A missing required secret aborts the
container naming the exact secret path; there are no silent defaults.

Documented secret names (env-var name == secret name):

* **Required:** `PG_PASSWORD`, `SECRET_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
* **Optional (feature keys, may stay absent):** `OPENCODE_API_KEY`,
  `GROQ_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_SEARCH_API_KEY`,
  `GOOGLE_CLIENT_SECRET`, `YOUTUBE_DATA_API_KEY`, `GMAIL_APP_PASSWORD`.

Non-secret config (`PG_HOST`, `PG_PORT`, `PG_USER`, `PG_DB`, `APP_ENV`,
`CORS_ORIGINS`, `FRONTEND_URL`, `BACKEND_URL`, `GOOGLE_CLIENT_ID`, `GMAIL_USER`,
storage flags) is exported by the startup script and passed through by compose.
Creation commands, the per-secret `roles/secretmanager.secretAccessor` binding
(least privilege — never project-wide), and the no-`.env` verification sequence
live in `deploy/gcp/BRINGUP.md` §6.

With `GCP_PROJECT` unset (local development) the entrypoint execs straight
through and the repo-root `.env` via `docker compose --env-file .env up` works
exactly as before.

### 4. Deploy and Manage Backend Service

From the repo root on the VM (e.g. `/opt/career-guidance`), using the single
root compose (no `--env-file`; non-secret config comes from the exported
startup-script variables and secrets from Secret Manager):

* **Start backend service**:
  ```bash
  docker compose pull
  docker compose up -d
  ```
* **Verify running containers**:
  ```bash
  docker compose ps
  ```
* **View backend logs**:
  ```bash
  docker compose logs -f backend
  ```
* **Database Seeding** (schema itself is managed by Alembic — `alembic upgrade head` from `resume_pipeline/`; legacy `init_db.py` is dev-only and must never run against a real database):
  ```bash
  docker compose exec backend python scripts/seed_database.py
  ```

### 5. Frontend on Vercel

`VITE_API_URL` (and optionally `VITE_API_BASE_URL`, which wins in
`frontend/src/config/api.js`) must point at the VM's public origin; no other
`VITE_*` variables are read. See `deploy/gcp/BRINGUP.md` §7.

### 6. Production Logging

The single root `docker-compose.yml` uses the `json-file` log driver (10 MB × 3
files rotation) — read logs with `docker compose logs`. To customize log
retention, edit the `logging:` block in the root `docker-compose.yml`.

### 7. Applying Updates on the VM (manual — no CI SSH deploy)

The `ec2-deploy` CI job is disabled (see above). To update the VM, SSH in and
run from the repo root:

```bash
git pull --ff-only
docker compose pull
docker compose up -d --force-recreate
```

This pulls the updated Docker Hub image and restarts the backend service cleanly.

---

### 6. GitHub Actions Keep-Alive
To prevent Supabase's free tier database from sleeping and organization projects from getting suspended due to inactivity, a workflow cron job is configured at `.github/workflows/keep-supabase-alive.yml`.

Ensure the curl command inside is set to ping your EC2 backend health check:
```yaml
      - name: Ping backend health check
        run: curl -f http://${{ secrets.EC2_HOST }}:8000/health || echo "EC2 backend pinged"
```

---

### 8. GitHub Actions CI/CD Pipeline Automation
We have established a fully automated CI/CD pipeline at `.github/workflows/ci-cd.yml` that handles testing, building, and automated deployments.

#### Pipeline Flow:
1. **Frontend CI (Tests, Lint & Build)**: Verifies frontend changes on all Pull Requests and Pushes targeting `main` by installing dependencies, running the Vitest suite (`npm test`), checking code quality (`eslint`), and verifying compilation (`vite build`).
2. **Backend CI (Tests & Migrations)**: Sets up Python 3.11, caches packages, downloads CPU-optimized PyTorch, and runs the pytest suite under mock LLM conditions (`GEMINI_MOCK_MODE=true`) with the in-memory SQLite stub (`CI_SKIP_DB_VALIDATION=true`). Only `test_api.py` is excluded — it is a live OpenCode API connectivity smoke test, not a deterministic suite. A second step then verifies the full Alembic migration chain (`0001 → head`, run twice for idempotency) against a disposable PostgreSQL 16 service container, exercising PG-specific DDL that SQLite cannot.
3. **Docker Build & Push**: On merging/pushing to the `main` branch, it builds the backend Docker image and pushes it to Docker Hub under two tags: `:latest` and a unique commit SHA tag `:${{ github.sha }}`.
4. **EC2 SSH Deploy (DISABLED)**: The `ec2-deploy` job is parked with `if: false`
   in `.github/workflows/ci-cd.yml` — `deploy/aws/` and
   `deploy/docker/docker-compose.prod.yml` were deleted, and there is no
   automated GCP equivalent (no new CI infrastructure invented). The documented
   deploy path is the manual GCE bring-up in `deploy/gcp/BRINGUP.md` (root
   `.env` + root `docker-compose.yml` + `resume_pipeline/Dockerfile`). The
   disabled job's reference script is kept updated to that layout
   (`docker compose --env-file .env pull` / `up -d --force-recreate`, 30 s
   wait, non-fatal `verify_data.py` check).

#### Required GitHub Secrets:
To activate this pipeline, navigate to your GitHub Repository -> **Settings -> Secrets and variables -> Actions** and create the following **Repository Secrets**:
* `DOCKER_HUB_USERNAME`: Your Docker Hub username.
* `DOCKER_HUB_TOKEN`: A Personal Access Token (PAT) generated in Docker Hub settings.
* `EC2_HOST` / `EC2_USERNAME` / `EC2_SSH_KEY` (+ `EC2_DEPLOY_DIR`): Only consumed by the **disabled** `ec2-deploy` reference job and the keep-alive ping — not needed for the GCP manual path.

---

## 🚦 Pre-Deployment Checklist

Before promoting any build to production, ensure:
- [x] Backend `CORS_ORIGINS` strictly contains the deployed frontend static site URL.
- [x] `GEMINI_MOCK_MODE` is set to `false` in production.
- [x] No local `.env` files are baked into the Docker images (checked automatically by `.dockerignore`).
- [x] All database migrations have been executed, and any legacy college domain data has been dropped.
- [x] Active recruiting job records have valid `status = 'approved'` and future `expires_at` timestamps to ensure visibility.

---

## 🧪 Smoke Tests (Post-Deployment Validation)

After deployment, hit the following endpoints to verify system integrity:

1. **API Welcome Status**:
   - Query: `GET http://<your-vm-ip>:8000/`
   - Expected: HTTP `200` returning `{"status": "online", "message": "Welcome to the Career Guidance AI API"}`.
2. **API Docs Check**:
   - Query: `GET http://<your-vm-ip>:8000/docs`
   - Expected: Swagger UI loads successfully.
3. **Health Check Endpoint**:
   - Query: `GET http://<your-vm-ip>:8000/health`
   - Expected: HTTP `200` returning `{"status": "ok"}`.
4. **Stats Overview**:
   - Query: `GET http://<your-vm-ip>:8000/api/stats`
   - Expected: HTTP `200` with parsed record metrics.
5. **Approved Jobs Retrieval**:
   - Query: `GET http://<your-vm-ip>:8000/api/jobs`
   - Expected: A list of active, non-expired recruiting jobs.