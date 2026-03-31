# Database

## Current Database Strategy

The application supports PostgreSQL only. The ORM and runtime configuration assume a PostgreSQL database and no longer provide SQLite, MySQL, or Firestore fallback paths.

The active role model is:

- `student`
- `employer`
- `admin`

Legacy college-domain tables and enum values should be removed from existing databases with [resume_pipeline/scripts/drop_college_domain.py](../resume_pipeline/scripts/drop_college_domain.py).

## Core Tables

### Identity and Access

- `users`
- `email_verification_tokens`
- `password_reset_codes`
- `audit_logs`

### Student Profile and Parsing

- `applicants`
- `uploads`
- `llm_parsed_records`
- `embeddings`

### Recruiter and Jobs

- `employers`
- `jobs`
- `job_applications`
- `job_recommendations`

### Interview and Credits

- `interview_sessions`
- `interview_questions`
- `credit_accounts`
- `credit_transactions`

Exact table names and ORM definitions are in [resume_pipeline/resume_pipeline/db.py](../resume_pipeline/resume_pipeline/db.py).

## Primary Relationships

- `users.id -> applicants.user_id`
- `users.id -> employers.user_id`
- `applicants.id -> uploads.applicant_id`
- `applicants.id -> llm_parsed_records.applicant_id`
- `employers.id -> jobs.employer_id`
- `applicants.id -> job_recommendations.applicant_id`
- `jobs.id -> job_recommendations.job_id`
- `applicants.id -> job_applications.applicant_id`
- `jobs.id -> job_applications.job_id`

## Role Enum Expectations

The current application expects the `users.role` enum to contain only:

- `student`
- `employer`
- `admin`

If the database still includes `college`, the ORM and runtime will be out of sync until the cleanup migration is run.

## Recommendation Data

Only job recommendations are supported.

Stored fields typically include:

- applicant reference
- job reference
- aggregate score
- scoring breakdown JSON
- explanation JSON
- workflow status

There is no active `college_recommendations` model or endpoint contract.

## Job Visibility Rules

Public job visibility depends on both conditions:

- `status = 'approved'`
- `expires_at > now`

This behavior is reflected in the backend repository and API code.

## Local Setup Notes

Typical local commands from [resume_pipeline](../resume_pipeline):

```powershell
python scripts/seed_database.py
python scripts/verify_data.py
python scripts/update_content.py
```

To remove the old college domain from an existing database:

```powershell
python scripts/drop_college_domain.py
```

## Data Integrity Checks

Use [resume_pipeline/scripts/verify_data.py](../resume_pipeline/scripts/verify_data.py) for a quick sanity check of:

- total users
- student count
- recruiter count
- job count
- recommendation count
- application count

## Notes for Future Changes

- Keep schema changes aligned with [resume_pipeline/resume_pipeline/db.py](../resume_pipeline/resume_pipeline/db.py).
- Keep role changes aligned across ORM, auth logic, and cleanup scripts.
- Add new premium workflows through the credit tables and service layer instead of bypassing them.