# Project: Career Guidance Performance Audit and Optimization

## Architecture
- **Backend (FastAPI)**: Python 3.11 web service with SQLAlchemy ORM using PostgreSQL/SQLite. Uses repositories in `resume_pipeline/repos/` and database configuration in `resume_pipeline/db.py`.
- **Frontend (React/Vite)**: React SPA with routes, components (like `JobsPage`, `StudentProfile`), styling with Tailwind CSS, and global state/hooks.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Performance Audit & Discovery | Audit backend N+1 query patterns, async event-loop blockers (sync request calls, blocking I/O), and frontend React runtime crashes/thrashing (JobCard nesting, showToast calls). | none | DONE (b1e0b1dd-41ef, 16479fd1-9ad6, 129f5ff9-7e2c) |
| 2 | Backend Performance Fixes | Implement optimization fixes for N+1 loops in `/api/applicants` and recommendation engines, and mitigate blocking I/O/synchronous requests in async routes. | M1 | DONE (d3156a8f-2ddd) |
| 3 | Frontend Clean Code & Fixes | Fix `StudentProfile.jsx` `showToast` runtime crash and `JobsPage.jsx` nested component declarations (JobCard) to prevent DOM thrashing. | M1 | DONE (e6baf113-1a4d) |
| 4 | Verification & Validation | Run backend tests via `pytest` and build/lint frontend via `npm run lint` and `npm run build` to verify no functional regressions. Perform forensic audit. | M2, M3 | IN_PROGRESS (034ee413-ff79, 970623da-f051, 079d5c0f-a606) |

## Interface Contracts
- **N+1 Optimizations**: Eager loading relationships using `joinedload` or executing bulk database queries rather than individual iteration queries.
- **Async Concurrency**: Convert synchronous HTTP calls to asynchronous using `httpx.AsyncClient` or offload blocking execution to a separate executor thread.
- **Frontend Error Boundaries**: UI toast notifications must use valid handlers. React components must be defined at the module level rather than nested inside parent render functions.
