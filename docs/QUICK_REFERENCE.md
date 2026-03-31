# Quick Reference

## Run Locally

### Backend

```powershell
cd resume_pipeline
..\myenv\Scripts\Activate.ps1
uvicorn resume_pipeline.app:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Common Scripts

Run from [resume_pipeline](../resume_pipeline):

```powershell
python scripts/seed_database.py
python scripts/update_content.py
python scripts/verify_data.py
python scripts/drop_college_domain.py
```

## Supported Roles

- `student`
- `employer`
- `admin`

The UI may label `employer` as recruiter.

## Core Endpoints

### Auth

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### Resume Flow

```text
POST /upload
POST /parse/{applicant_id}
GET  /api/applicant/{id}
GET  /api/applicants
```

### Jobs and Recommendations

```text
GET  /api/jobs
GET  /api/job/{id}
GET  /api/recommendations/{db_applicant_id}
POST /api/applicant/{db_applicant_id}/generate-recommendations
PATCH /api/job-recommendation/{rec_id}/status
```

### Recruiter Flow

```text
POST   /api/employer/jobs
GET    /api/employer/jobs
GET    /api/employer/applications
PATCH  /api/job/applications/{application_id}/status
```

### Interview and Credits

```text
POST /api/interview/start
GET  /api/interview/{session_id}/question
POST /api/interview/{session_id}/answer
GET  /api/interview/history
GET  /api/credit/account
GET  /api/credit/transactions
POST /api/credit/check
```

## Validation Commands

### Backend tests

```powershell
cd resume_pipeline
pytest tests/ -q
```

### Frontend lint

```powershell
cd frontend
npm run lint
```

## PostgreSQL Notes

- The app is PostgreSQL-only.
- Existing databases from older versions may still contain the removed college schema.
- Run `python scripts/drop_college_domain.py` before assuming the database matches the current ORM.

## Typical Data Flow

1. Register or log in as a student.
2. Upload a resume.
3. Parse the uploaded resume.
4. Generate or fetch job recommendations.
5. Apply to jobs and track progress.
6. Use interview features if credits allow.

## Troubleshooting

- If startup fails on database connection, verify PostgreSQL credentials in the environment.
- If role errors appear, confirm the database no longer contains the old `college` enum value.
- If jobs do not appear publicly, confirm they are approved and not expired.