# Plan: Security Audit for Career Guidance

## Architecture
- FastAPI Backend: `resume_pipeline/`
- React Frontend: `frontend/`
- Target Report: `docs/security_audit_report.md`

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Exploration & Tool Scans | Run automated security scanners (Bandit, npm audit, secret checks) and collect raw logs. | none | DONE (862f17bf-e2e2-4096-a547-5c9bfd7e14e8) |
| 2 | Codebase Security Review | Audit JWT verification, bcrypt, route guards, CORS, rate-limiting, and error handling. | M1 | DONE (58a0f804-281d-41dd-b078-5803fac694e6) |
| 3 | Report Generation | Draft `docs/security_audit_report.md` containing Executive Summary, Vulnerability Details Table, and Tool Scan Logs. | M2 | DONE (92f88ab2-2a22-4062-934f-388cd05a21b6) |
| 4 | Verification & Final Gate | Run review & forensic audit on the report to verify accuracy, structure, and integrity. | M3 | IN_PROGRESS |

## Interface Contracts
- Scanner output: Raw log text files or output captured in the subagent's working directory.
- Report location: `docs/security_audit_report.md` must be created in the repository root.
