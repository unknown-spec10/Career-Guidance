# Implementation Guide

## Goal

This guide documents how to extend the current platform without reintroducing removed architecture.

The supported implementation model is:

- PostgreSQL only
- student, employer, admin roles only
- job recommendations only

## Backend Change Rules

### New endpoints

- Add routes in [resume_pipeline/resume_pipeline/app.py](../resume_pipeline/resume_pipeline/app.py).
- Protect role-specific endpoints with the existing auth and role checks.
- Keep request and response shapes aligned with [resume_pipeline/resume_pipeline/schemas.py](../resume_pipeline/resume_pipeline/schemas.py).

### New persistence changes

- Add or update SQLAlchemy models in [resume_pipeline/resume_pipeline/db.py](../resume_pipeline/resume_pipeline/db.py).
- Keep repository interfaces aligned in [resume_pipeline/resume_pipeline/repos](../resume_pipeline/resume_pipeline/repos).
- Do not add alternative storage backends.

### Recommendation features

- Extend only the job recommendation pipeline in [resume_pipeline/resume_pipeline/recommendation](../resume_pipeline/resume_pipeline/recommendation).
- Do not reintroduce college recommendation paths or payload keys.

### Recruiter-facing features

- Use the `employer` role in backend code and data.
- Recruiter-facing UI wording can still say recruiter if needed.

## Frontend Change Rules

- Add pages and components under [frontend/src](../frontend/src).
- Keep routing aligned with the active student, recruiter, and admin flows.
- Do not add routes, dashboards, or navigation items for the removed college role.

## Scripts and Maintenance

Current maintenance scripts live in [resume_pipeline/scripts](../resume_pipeline/scripts):

- `seed_database.py`
- `update_content.py`
- `verify_data.py`
- `drop_college_domain.py`

When adding a new script:

- keep it PostgreSQL-aware
- keep it aligned to the current role model
- avoid referencing deleted tables or enums

## Database Compatibility

If working against an older local database, run the cleanup script before debugging code behavior:

```powershell
cd resume_pipeline
python scripts/drop_college_domain.py
```

This is required when the database still contains old college tables or the removed `college` enum value.

## Testing Guidance

Backend:

```powershell
cd resume_pipeline
pytest tests/ -q
```

Frontend lint:

```powershell
cd frontend
npm run lint
```

Minimum smoke tests after feature work:

1. Student auth flow.
2. Recruiter auth flow.
3. Resume upload and parse.
4. Job list and job detail endpoints.
5. Job recommendation generation and retrieval.

## Anti-Patterns

Do not add back:

- college routes
- college schemas or models
- `college` role logic
- MySQL or Firestore repository branches
- API payloads containing `college_recommendations`