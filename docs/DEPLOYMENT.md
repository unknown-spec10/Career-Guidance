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
- `GEMINI_API_KEY`: Required for scanned resume OCR-Vision preprocessing and generating skill embeddings.
- `GROQ_API_KEY`: Required for rapid structured JSON parsing and interview scoring.
- `GEMINI_MOCK_MODE`: Set to `true` to stub out external LLM API calls with deterministic mock data during testing/development (defaults to `false`).

### Email Integration (Gmail SMTP)
- `GMAIL_USER`: The sender Gmail address (required for registration code verification).
- `GMAIL_APP_PASSWORD`: A 16-character Gmail App Password (do not use your primary password).

### Networking & CORS
- `FRONTEND_URL`: Primary frontend domain used for redirects and link buildings (e.g., `https://career-guidance.onrender.com`).
- `CORS_ORIGINS`: Comma-separated list of allowed CORS origins (e.g., `http://localhost:3000,http://localhost:5173,https://career-guidance.onrender.com`).

---

## ⚡ Local Deployment (Single-Command Docker)

The easiest way to run the entire stack locally is using the root `docker-compose.yml`.

### Prerequisites
Make sure Docker and Docker Compose are installed. Ensure port `80` (frontend) and `8000` (backend API) are not bound by other services.

### Steps
1. Copy the environment template:
   ```cmd
   cp .env.docker .env
   ```
2. Build and start the containers:
   ```cmd
   docker compose up -d --build
   ```
3. Seed the sample database (run this once):
   ```cmd
   ./deploy/docker/docker-help.sh seed
   ```
4. Access the applications:
   - **Frontend UI**: `http://localhost`
   - **Backend API**: `http://localhost:8000`
   - **FastAPI Docs**: `http://localhost:8000/docs`

---

## ☁️ Production Cloud Deployment (Render & Supabase)

Our live production environment runs on Render (Web Services) and Supabase (Managed PostgreSQL).

### 1. Database Setup (Supabase)
1. Provision a PostgreSQL instance on Supabase in your closest region (e.g., `ap-south-1`).
2. Run database migrations to construct the 18 relational tables.
3. If this database was migrated from a legacy version, clean up old college-domain schemas:
   ```powershell
   cd resume_pipeline
   python scripts/drop_college_domain.py
   ```

### 2. Backend API Service (Render)
- **Runtime**: Docker (`resume_pipeline/Dockerfile`)
- **Docker Build Context**: Repository root (ensureRender build context points to repo root so Dockerfile can COPY correctly).
- **Environment**: Inject all variables under Render's environment dashboard.
- **Scale**: Render automatically sets `PORT` (e.g., `10000`). The Dockerfile dynamically binds `uvicorn` and routes the internal healthcheck to the active port.
- **Autodeploy**: Enabled on push to `main` branch.

### 3. Frontend Static Site (Render)
- **Root Directory**: `frontend/`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`
- **Headers/Redirects**: `frontend/public/_redirects` must contain `/* /index.html 200` to support SPA client-side routing.
- **Environment**: Set `VITE_API_URL` to point to your backend Render URL.

---

## 🚦 Pre-Deployment Checklist

Before promoting any build to production, ensure:
- [ ] Backend `CORS_ORIGINS` strictly contains the deployed frontend static site URL.
- [ ] `GEMINI_MOCK_MODE` is set to `false` in production.
- [ ] No local `.env` files are baked into the Docker images (checked automatically by `.dockerignore`).
- [ ] All database migrations have been executed, and any legacy college domain data has been dropped.
- [ ] Active recruiting job records have valid `status = 'approved'` and future `expires_at` timestamps to ensure visibility.

---

## 🧪 Smoke Tests (Post-Deployment Validation)

After deployment, hit the following endpoints to verify system integrity:

1. **API Docs Check**:
   - Query: `GET https://your-backend-url.onrender.com/docs`
   - Expected: Swagger UI loads successfully.
2. **Stats Overview**:
   - Query: `GET https://your-backend-url.onrender.com/api/stats`
   - Expected: HTTP `200` with parsed record metrics.
3. **Approved Jobs Retrieval**:
   - Query: `GET https://your-backend-url.onrender.com/api/jobs`
   - Expected: A list of active, non-expired recruiting jobs.
4. **Recommendation Scoring**:
   - Query: `GET https://your-backend-url.onrender.com/api/recommendations/<db_applicant_id>`
   - Expected: HTTP `200` returning structured job recommendation cards.