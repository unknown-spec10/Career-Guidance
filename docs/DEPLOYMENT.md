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