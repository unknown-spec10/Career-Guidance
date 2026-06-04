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

## ☁️ Production Cloud Deployment (Supabase, Render & Vercel)

Our zero-dollar cost production deployment environment is split across **Supabase** (database), **Render** (FastAPI backend), and **Vercel** (React frontend SPA).

### 1. Database Setup (Supabase)
1. Provision a PostgreSQL instance on [Supabase](https://supabase.com) in your closest region.
2. Go to **Project Settings → Database → Connection string → URI tab** and copy the connection URI.
   > [!CRITICAL]
   > **Special Characters in Database Passwords**:
   > If your Supabase password contains special characters (e.g. `@`, `&`, `#`), you **must percent-encode** them in the DSN string (e.g. `@` -> `%40`, `&` -> `%26`) to prevent SQLAlchemy/psycopg2 parsing failures.
3. Apply SQL database tables by running the initialization script pointing to the Supabase connection string, or paste the schemas inside the Supabase SQL editor:
   ```cmd
   python scripts/init_db.py
   python scripts/seed_database.py
   ```

---

### 2. Backend API Service (Render)
Deploy the FastAPI backend as a Render Python Web Service using the repository's root `render.yaml` Blueprint file, or set it up manually:

* **Runtime**: `Python`
* **Root Directory**: `resume_pipeline`
* **Build Command**: `pip install -r requirements.txt`
* **Start Command**: `uvicorn resume_pipeline.app:app --host 0.0.0.0 --port $PORT`
* **Health Check Path**: `/health` (tells Render to check if the app is online at this route; prevents container restart loops)

#### Render Environment Variables

| Variable Key | Suggested Placeholder Value | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg2://postgres.example_ref:%40encoded_pass@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres` | Supabase PgBouncer pooler DSN (port 6543). Automatically triggers SSL and Kerberos bypass modes. |
| `GEMINI_API_KEY` | `AIzaSyExampleGeminiApiKeyHere` | API key from Google AI Studio. |
| `GROQ_API_KEY` | `gsk_ExampleGroqApiKeyHere` | API key from Groq Console. |
| `SECRET_KEY` | `your_32_char_secure_hex_key_here` | Secret key to sign authentication JWT tokens. |
| `GMAIL_USER` | `your-smtp-sender@gmail.com` | Email address used to dispatch verification codes. |
| `GMAIL_APP_PASSWORD` | `abcd efgh ijkl mnop` | 16-character Gmail app-specific password. |
| `CORS_ORIGINS` | `https://your-site.vercel.app,http://localhost:3000,http://localhost:5173` | Comma-separated list of allowed origins. **Must not have trailing slashes**. |
| `FRONTEND_URL` | `https://your-site.vercel.app` | Target client URL for verification flow redirects. |
| `PYTHON_VERSION` | `3.11.0` | Force Python runtime version. |

---

### 3. Frontend Static Site (Vercel)
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
| `VITE_API_BASE_URL` | `https://career-guidance-backend-i0ty.onrender.com` | The URL of your active Render backend service (do not include a trailing `/`). |

---

## ☁️ Production EC2 Deployment (Docker Hub & AWS EC2)

For teams utilizing managed services, the platform is structured to run the database on **Supabase**, the React frontend SPA on **Vercel**, and the FastAPI backend API on an **Amazon EC2** instance. 

Using prebuilt Docker images from Docker Hub bypasses the need to build resource-heavy Python images directly on the EC2 instance, making it fully compatible with low-memory `t2.micro` or `t3.micro` instances.

### 1. Build and Push Backend Image to Docker Hub

Since the frontend is built and served statically by Vercel directly from Git, and the database is managed by Supabase, only the backend API needs to be pushed to Docker Hub. Run the helper script from your local development machine:

* **Windows (PowerShell)**:
  ```powershell
  .\deploy\docker\build-and-push.ps1 -DockerUsername "yourusername"
  ```
* **Linux/macOS (Bash)**:
  ```bash
  chmod +x ./deploy/docker/build-and-push.sh
  ./deploy/docker/build-and-push.sh "yourusername"
  ```

This tags the backend image with `:latest` and a unique `:yyyyMMdd-HHmmss` timestamp, then pushes it to:
- `yourusername/career-guidance-backend`

### 2. Launch EC2 Instance

1. Create a `t2.micro` or `t3.micro` instance running **Ubuntu Server 24.04 LTS / 22.04 LTS**.
2. Configure **Security Groups** to allow:
   - Port `22` (SSH) for administrative access.
   - Port `8000` (HTTP) for frontend UI API requests to the backend.
3. In **Advanced Details**, paste the contents of [ec2-user-data.sh](file:///d:/Career%20Guidence/deploy/aws/ec2-user-data.sh) into the **User data** field. This automatically installs Docker, Docker Compose, clones the codebase, and prepares the workspace at `/opt/career-guidance`.

### 3. Setup Environment Variables on EC2

1. Copy [deploy/aws/.env.aws.example](file:///d:/Career%20Guidence/deploy/aws/.env.aws.example) to `.env.aws` on the host machine.
2. Edit the `.env.aws` file to supply the actual production environment values:
   - Set `DOCKER_HUB_USERNAME` to your Docker Hub username.
   - Set `PG_HOST` to your Supabase pooler host (e.g. `aws-1-ap-south-1.pooler.supabase.com`).
   - Fill in your sensitive keys: `SECRET_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, and `GMAIL_APP_PASSWORD`.
   - Update `FRONTEND_URL` and `CORS_ORIGINS` to point to the Vercel site (e.g. `https://your-site.vercel.app`).

### 4. Deploy and Manage Backend Service

From `/opt/career-guidance` on the EC2 instance, use the following commands:

* **Start backend service**:
  ```bash
  docker compose --env-file .env.aws -f deploy/docker/docker-compose.prod.yml pull
  docker compose --env-file .env.aws -f deploy/docker/docker-compose.prod.yml up -d
  ```
* **Verify running containers**:
  ```bash
  docker compose -f deploy/docker/docker-compose.prod.yml ps
  ```
* **View backend logs**:
  ```bash
  docker compose -f deploy/docker/docker-compose.prod.yml logs -f backend
  ```
* **Database Seeding**:
  ```bash
  docker compose -f deploy/docker/docker-compose.prod.yml exec backend python scripts/seed_database.py
  ```

### 5. Automated Updates from Dev Machine

You can apply environment variable changes or force-recreate the remote backend container directly from your development machine using the provided PowerShell deploy script:

```powershell
.\deploy\aws\apply-ec2-env.ps1 -InstanceIp "your-ec2-public-ip" -PemPath "path-to-your-ssh-key.pem" -SourceEnvPath "path-to-local-env"
```

This will automatically securely upload your new configurations, pull the updated Docker Hub image, and restart the backend service cleanly.

---

### 6. GitHub Actions Keep-Alive
To prevent Supabase's free tier database from sleeping and organization projects from getting suspended due to inactivity, a workflow cron job is configured at `.github/workflows/keep-supabase-alive.yml`.

Ensure the curl command inside is set to ping your Render backend:
```yaml
      - name: Ping backend health check
        run: curl -f https://your-backend-api-name.onrender.com/health || echo "Render woken up"
```

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
   - Query: `GET https://your-backend-url.onrender.com/`
   - Expected: HTTP `200` returning `{"status": "online", "message": "Welcome to the Career Guidance AI API"}`.
2. **API Docs Check**:
   - Query: `GET https://your-backend-url.onrender.com/docs`
   - Expected: Swagger UI loads successfully.
3. **Health Check Endpoint**:
   - Query: `GET https://your-backend-url.onrender.com/health`
   - Expected: HTTP `200` returning `{"status": "ok"}`.
4. **Stats Overview**:
   - Query: `GET https://your-backend-url.onrender.com/api/stats`
   - Expected: HTTP `200` with parsed record metrics.
5. **Approved Jobs Retrieval**:
   - Query: `GET https://your-backend-url.onrender.com/api/jobs`
   - Expected: A list of active, non-expired recruiting jobs.