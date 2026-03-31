# Architecture

## Overview

The platform is a monorepo with two active product roles:

- Student
- Recruiter (`employer` in backend code and database)

The system is PostgreSQL-only. The legacy college domain has been removed from runtime code and should be removed from existing databases with the migration utility in [resume_pipeline/scripts/drop_college_domain.py](../resume_pipeline/scripts/drop_college_domain.py).

## Repository Layout

```text
Career Guidence/
|-- frontend/
|   |-- src/
|   |   |-- pages/
|   |   |-- components/
|   |   |-- hooks/
|   |   `-- config/
|-- resume_pipeline/
|   |-- resume_pipeline/
|   |   |-- app.py
|   |   |-- db.py
|   |   |-- schemas.py
|   |   |-- auth.py
|   |   |-- config.py
|   |   |-- recommendation/
|   |   |-- interview/
|   |   |-- resume/
|   |   `-- repos/
|   |-- scripts/
|   `-- tests/
`-- docs/
```

## Active Product Flow

1. A student uploads a resume through the backend.
2. The parser extracts normalized profile data and stores it in PostgreSQL.
3. The recommendation service generates job recommendations.
4. Recruiters create and manage jobs.
5. Students track applications and use interview features gated by credits.

## Backend Architecture

### API Layer

The FastAPI entrypoint is [resume_pipeline/resume_pipeline/app.py](../resume_pipeline/resume_pipeline/app.py).

Key responsibilities:

- request validation
- authentication and role guards
- upload and parse endpoints
- recruiter job management
- student recommendation and application flows
- interview and credit endpoints

### Persistence Layer

The SQLAlchemy models live in [resume_pipeline/resume_pipeline/db.py](../resume_pipeline/resume_pipeline/db.py).

Important active entities:

- `User`
- `Applicant`
- `Employer`
- `Job`
- `JobRecommendation`
- `JobApplication`
- `LLMParsedRecord`
- interview and credit tables

There is no supported SQLite, MySQL, Firestore, or college-domain runtime path.

### Service Layer

Key backend services:

- Resume parsing in [resume_pipeline/resume_pipeline/resume](../resume_pipeline/resume_pipeline/resume)
- Interview workflows in [resume_pipeline/resume_pipeline/interview](../resume_pipeline/resume_pipeline/interview)
- Job recommendation logic in [resume_pipeline/resume_pipeline/recommendation](../resume_pipeline/resume_pipeline/recommendation)
- Credit accounting in [resume_pipeline/resume_pipeline/core](../resume_pipeline/resume_pipeline/core)

### Repository Layer

Repository abstractions and PostgreSQL implementations live in [resume_pipeline/resume_pipeline/repos](../resume_pipeline/resume_pipeline/repos).

The active repository model is job-centric:

- applicant access
- employer access
- job access
- job recommendation persistence

## Frontend Architecture

The frontend is a React + Vite application under [frontend/src](../frontend/src).

Active UI areas:

- student dashboard
- recruiter dashboard
- admin dashboard
- job listing and detail flows
- resume upload and recommendation views
- authentication and route protection

College-specific pages, routes, and dashboards have been removed.

## Role Model

Supported roles:

- `student`
- `employer`
- `admin`

Notes:

- The UI may describe `employer` as recruiter.
- Registration rejects the removed `college` role.

## Recommendation Model

Recommendations are job-only.

Inputs include:

- normalized resume data
- skills match
- location preference match
- academic signals when available
- interview-derived improvements when available

Outputs are stored as `JobRecommendation` records and exposed to student-facing endpoints.

## Infrastructure Assumptions

- Backend runtime: FastAPI + SQLAlchemy
- Database: PostgreSQL
- Frontend runtime: React + Vite
- LLM integration: Gemini-based parsing and evaluation

## Maintenance Utilities

Useful scripts in [resume_pipeline/scripts](../resume_pipeline/scripts):

- `seed_database.py`
- `update_content.py`
- `verify_data.py`
- `drop_college_domain.py`

## Current Constraints

- Existing PostgreSQL databases created before the domain cleanup may still contain legacy college tables or enum values.
- Run the drop script before assuming schema parity with the current ORM.
- Documentation outside this file may still require smaller wording cleanups, but this file reflects the current supported architecture.