# Deployment

## Runtime Model

The supported deployment model is:

- Frontend: React + Vite static build
- Backend: FastAPI application
- Database: PostgreSQL
- Queue: Redis (managed in production)
- Worker: Celery worker service for async embedding/indexing

There is no supported deployment path for SQLite, MySQL, Firestore, or the legacy college domain.

## Backend Configuration

Backend entrypoint:

```text
resume_pipeline.app:app
```

Required environment categories:

- PostgreSQL connection settings
- JWT secret
- Gemini API configuration if parsing/interview evaluation is enabled
- frontend URL and CORS configuration
- Celery/Redis broker and result backend configuration

## Async Embedding Pipeline

The embedding/indexing pipeline runs outside API request handlers.

- API service enqueues tasks on parse and job create/update.
- Celery worker consumes tasks and writes embeddings.
- Redis persists queued tasks and supports retries.

Required environment variables:

```text
CELERY_BROKER_URL=redis://<host>:6379/0
CELERY_RESULT_BACKEND=redis://<host>:6379/1
CELERY_DEFAULT_QUEUE=default
CELERY_EMBEDDINGS_QUEUE=embeddings
CELERY_TASK_ALWAYS_EAGER=false
```

Worker command:

```text
celery -A resume_pipeline.celery_app:celery_app worker --loglevel=INFO --queues=embeddings,default
```

## Local Deployment

### Backend

```powershell
cd resume_pipeline
..\myenv\Scripts\Activate.ps1
uvicorn resume_pipeline.app:app --reload --port 8000
```

### Worker (local)

```powershell
cd resume_pipeline
..\myenv\Scripts\Activate.ps1
celery -A resume_pipeline.celery_app:celery_app worker --loglevel=INFO --queues=embeddings,default
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

### Redis (local)

Use `docker compose up redis worker backend` or run a local Redis instance.

## Pre-Deployment Checklist

1. Confirm PostgreSQL credentials are valid.
2. Confirm the database schema matches the current ORM.
3. If the database is older, run `python scripts/drop_college_domain.py`.
4. Confirm backend CORS settings include the deployed frontend origin.
5. Confirm recruiter job records use valid statuses and expiry dates.
6. Confirm Redis broker connectivity from API and worker services.
7. Confirm worker service is deployed and healthy.
8. Run embedding backfill after first deployment:

```powershell
cd resume_pipeline
python scripts/backfill_embeddings.py --mode all --limit 500 --offset 0
```

## Database Migration Note

If a target database still contains legacy college data or the old `college` enum value, run:

```powershell
cd resume_pipeline
python scripts/drop_college_domain.py
```

This script drops old college tables, deletes legacy college users, and rebuilds the `user_role` enum to the current supported set.

## Smoke Tests

After deployment, verify:

1. `GET /docs` loads on the backend.
2. Student login succeeds.
3. Recruiter login succeeds.
4. `GET /api/jobs` returns approved, non-expired jobs.
5. `GET /api/recommendations/{db_applicant_id}` returns job recommendations only.
6. `GET /api/embeddings/health` returns non-zero coverage after backfill.
7. `POST /api/embeddings/reindex/jobs` enqueues jobs and returns task ids.

## Troubleshooting

- If the backend fails at startup, check PostgreSQL connectivity first.
- If role-related errors appear, check whether the database still contains the removed `college` enum value.
- If jobs are missing from public endpoints, verify approval state and expiry timestamps.
- If embeddings are not updating, verify worker logs and Redis connectivity.
- If recommendation latency spikes, verify embedding coverage and run backfill.

## AWS Deployment (Demo / Near-Zero Cost)

This project can run on a single AWS EC2 free-tier instance for personal demos.

Recommended profile:

- 1 EC2 instance (`t3.micro` or free-tier eligible equivalent)
- Docker Compose with only `frontend` + `backend`
- Reuse existing external PostgreSQL (for example Supabase) to avoid running DB on EC2
- Keep async/background workers disabled for demo mode
- Stop the instance when not in use

### Why this is cheapest

- No managed AWS database service required.
- No load balancer required.
- No always-on worker/queue required.
- You can stop the instance between demos.

### Files Added for AWS

- `docker-compose.aws-dev.yml` - lean runtime profile for EC2
- `.env.aws.example` - environment template for AWS deployment
- `deploy/aws/ec2-user-data.sh` - optional instance bootstrap script
- `deploy/aws/aws-demo-control.ps1` - start/stop/status helper

### 1) Launch EC2 (Ubuntu)

Minimal requirements:

- Open inbound ports `80` and `22` in the EC2 security group
- Attach a key pair for SSH access
- Use your normal AWS profile (`aws configure`)

Optional user-data script:

```bash
# paste content from deploy/aws/ec2-user-data.sh as instance user-data
```

### 2) Prepare App On EC2

```bash
cd /opt
git clone https://github.com/unknown-spec10/Career-Guidance.git career-guidance
cd career-guidance
cp .env.aws.example .env.aws
```

Edit `.env.aws` and set at least:

- `PG_HOST`, `PG_USER`, `PG_PASSWORD`, `PG_DB`
- `SECRET_KEY` (32+ chars)

For zero external AI cost, keep:

- `GEMINI_MOCK_MODE=true`
- `ASYNC_PARSE_ENABLED=false`
- `USE_VECTOR_RETRIEVAL=false`

### 3) Build and Run

```bash
docker compose --env-file .env.aws -f docker-compose.aws-dev.yml up -d --build
docker compose -f docker-compose.aws-dev.yml ps
```

App URL:

- `http://<ec2-public-ip>/`

### 4) Update and Redeploy Later

```bash
cd /opt/career-guidance
git pull --ff-only
docker compose --env-file .env.aws -f docker-compose.aws-dev.yml up -d --build
```

### 5) Keep Costs Near Zero

- Stop EC2 when idle:

```powershell
pwsh ./deploy/aws/aws-demo-control.ps1 -Action stop -InstanceId <your-instance-id> -Region us-east-1
```

- Start only when you need demo access:

```powershell
pwsh ./deploy/aws/aws-demo-control.ps1 -Action start -InstanceId <your-instance-id> -Region us-east-1
```

Important:

- AWS free tier has limits and expiry windows. Exceeding them may incur charges.
- If you need strict zero billing risk, shut down the instance after each demo.