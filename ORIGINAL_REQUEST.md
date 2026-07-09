# Original User Request

## Initial Request — 2026-06-04T04:03:27Z

The project goal is to run a comprehensive security audit on the current repository (`Career Guidence`), which contains a FastAPI backend (`resume_pipeline/`) and React frontend (`frontend/`).

Working directory: D:/Career Guidence
Integrity mode: development

## Requirements

### R1. Comprehensive Repository Security Audit
- The audit must cover both the FastAPI backend (`resume_pipeline/`) and the React frontend (`frontend/`).
- Scope of audit:
  - Code vulnerability scanning (OWASP Top 10, SQL injection, XSS vectors, CSRF, insecure direct object references).
  - Hardcoded secrets check (API keys, database passwords, JWT secret keys).
  - Dependency vulnerability scan (outdated or compromised packages in both Python and Node.js environments).
  - Authentication & Authorization guards review (JWT verification, bcrypt hashing, role guards).
  - CORS, rate-limiting, and error-handling configurations.

### R2. Detailed Markdown Audit Report
- Deliver a comprehensive security report at `docs/security_audit_report.md` in the repository root.
- The report must contain:
  - An Executive Summary summarizing the security posture.
  - A table of all identified vulnerabilities with CVSS severity ratings (Critical, High, Medium, Low), file paths/line numbers, description of the vulnerability, impact, and concrete remediation instructions.
  - Verification logs or output from running local security scans (e.g., Bandit for Python, npm audit for Node.js, or similar tools).

## Acceptance Criteria

### Delivery and Structure
- [ ] A file named `docs/security_audit_report.md` exists and is non-empty.
- [ ] The report contains the sections: "Executive Summary", "Vulnerability Details Table", and "Tool Scan Logs".
- [ ] The Vulnerability Details Table includes at least 3 distinct columns: "Severity", "Location/File Path", and "Remediation".

### Verification Output
- [ ] The "Tool Scan Logs" section contains raw output or verified logs from executing at least one automated tool (e.g., Bandit or npm audit).

## Follow-up — 2026-06-23T16:54:06Z

The project goal is to perform a deep-dive performance audit, identify bottlenecks, and implement clean code optimizations across the backend (FastAPI) and frontend (React/Vite) codebases of the Career Guidance system.

Working directory: d:/Career Guidence
Integrity mode: development

## Requirements

### R1. Performance Audit & Optimization Discovery
Audit both frontend and backend codebases for additional CPU, memory, and database bottlenecks (e.g. N+1 queries, synchronous blocking calls in async routes, redundant computations, nested loops, inefficient array conversions).

### R2. Codebase Fix Implementation
Refactor the identified performance issues and bug patterns without breaking core functionality. This includes:
- Resolving the `StudentProfile.jsx` `showToast` runtime crash.
- Resolving nested component declarations in `JobsPage.jsx` to prevent DOM layout thrashing.
- Optimizing backend N+1 loops in `/api/applicants` and recommendation engine components.
- Mitigating blocking I/O and synchronous `requests` calls in async routers.

### R3. Test Suite Compatibility
Ensure all code changes compile cleanly, pass linting checks, and maintain compatibility with existing tests.

## Acceptance Criteria

### Technical Cleanliness
- [ ] No nested component definitions inside other React component bodies (specifically `JobCard`).
- [ ] No undefined function calls in toast notification bindings on the profile page.
- [ ] Backend database sessions and connections are properly pooled and closed.

### Performance & Concurrency
- [ ] Loop queries (N+1 queries) in active route handlers and recommendation engines are replaced with eager loading (`joinedload`) or batch lookups.
- [ ] SSE streams and background tasks do not block the main FastAPI event loop thread.

### Verification
- [ ] `pytest tests/` runs and passes successfully for all unit tests.
- [ ] `npm run lint` and `npm run build` in the `frontend` folder exit with code 0 (no compile or eslint errors).
