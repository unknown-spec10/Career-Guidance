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
- `FRONTEND_URL`: Primary frontend domain used for redirects and link buildings (e.g., `https://your-site.vercel.app`).
- `CORS_ORIGINS`: Comma-separated list of allowed CORS origins (e.g., `http://localhost:3000,http://localhost:5173,https://your-site.vercel.app`).

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

## ☁️ Production Cloud Deployment (Supabase, AWS EC2 & Vercel)

Our production deployment environment is split across **Supabase** (database), **AWS EC2** (FastAPI backend), and **Vercel** (React frontend SPA).

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
| `VITE_API_BASE_URL` | `http://<your-ec2-public-ip-or-domain>:8000` | The URL of your active AWS EC2 backend service (do not include a trailing `/`). |

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

### 6. Production Logging (AWS CloudWatch Integration)

The production Docker Compose configuration routes container logs directly to Amazon CloudWatch Logs, so you do not need to SSH into the EC2 instance for troubleshooting.

#### AWS Prerequisites:
1. **IAM Role**: Create or update your EC2 instance's IAM role to include the AWS-managed **`CloudWatchAgentServerPolicy`** policy (this grants write access to CloudWatch Logs).
2. **Assign Role**: Assign the role to your EC2 instance from the EC2 console under **Actions -> Security -> Modify IAM role**.

#### Log Driver Details:
* **Driver**: `awslogs`
* **Log Group**: Defaults to `career-guidance-backend` (automatically created by the driver if it doesn't exist).
* **Stream Prefix**: Dynamically tagged as `"backend"`.
* **AWS Region**: Defaults to `ap-south-1`.

If you need to customize the region or log group, you can define the following environment variables in your `.env.aws` file:
```ini
AWS_REGION=ap-south-1
AWS_LOGS_GROUP=career-guidance-backend
```

### 7. Automated Updates from Dev Machine

You can apply environment variable changes or force-recreate the remote backend container directly from your development machine using the provided PowerShell deploy script:

```powershell
.\deploy\aws\apply-ec2-env.ps1 -InstanceIp "your-ec2-public-ip" -PemPath "path-to-your-ssh-key.pem" -SourceEnvPath "path-to-local-env"
```

This will automatically securely upload your new configurations, pull the updated Docker Hub image, and restart the backend service cleanly.

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
2. **Backend CI (Tests & Migrations)**: Sets up Python 3.11, caches packages, downloads CPU-optimized PyTorch, and runs the pytest suite under mock LLM conditions (`GEMINI_MOCK_MODE=true`) with the in-memory SQLite stub (`CI_SKIP_DB_VALIDATION=true`). Only `test_api.py` is excluded — it is a live Gemini API connectivity smoke test, not a deterministic suite. A second step then verifies the full Alembic migration chain (`0001 → head`, run twice for idempotency) against a disposable PostgreSQL 16 service container, exercising PG-specific DDL that SQLite cannot.
3. **Docker Build & Push**: On merging/pushing to the `main` branch, it builds the backend Docker image and pushes it to Docker Hub under two tags: `:latest` and a unique commit SHA tag `:${{ github.sha }}`.
4. **AWS EC2 SSH Deploy**: Connects securely to the EC2 instance, checks out the latest code to pull Docker Compose config changes, triggers a remote `docker compose pull`, and restarts the containers using the environment variables inside `.env.aws`. Finally, it waits 30 seconds for the backend service to fully initialize and executes `verify_data.py` as a non-fatal check to ensure database connectivity (preventing OOM errors on low-memory hosts from failing the deployment).

#### Required GitHub Secrets:
To activate this pipeline, navigate to your GitHub Repository -> **Settings -> Secrets and variables -> Actions** and create the following **Repository Secrets**:
* `DOCKER_HUB_USERNAME`: Your Docker Hub username.
* `DOCKER_HUB_TOKEN`: A Personal Access Token (PAT) generated in Docker Hub settings.
* `EC2_HOST`: The public IP or domain of your EC2 instance (e.g. `13.235.51.86`).
* `EC2_USERNAME`: The SSH login username (e.g. `ubuntu`).
* `EC2_SSH_KEY`: The complete private key PEM file content (starting with `-----BEGIN OPENSSH PRIVATE KEY-----` or `-----BEGIN RSA PRIVATE KEY-----`).

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
   - Query: `GET http://<your-ec2-public-ip>:8000/`
   - Expected: HTTP `200` returning `{"status": "online", "message": "Welcome to the Career Guidance AI API"}`.
2. **API Docs Check**:
   - Query: `GET http://<your-ec2-public-ip>:8000/docs`
   - Expected: Swagger UI loads successfully.
3. **Health Check Endpoint**:
   - Query: `GET http://<your-ec2-public-ip>:8000/health`
   - Expected: HTTP `200` returning `{"status": "ok"}`.
4. **Stats Overview**:
   - Query: `GET http://<your-ec2-public-ip>:8000/api/stats`
   - Expected: HTTP `200` with parsed record metrics.
5. **Approved Jobs Retrieval**:
   - Query: `GET http://<your-ec2-public-ip>:8000/api/jobs`
   - Expected: A list of active, non-expired recruiting jobs.