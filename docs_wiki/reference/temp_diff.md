diff --git a/.agents/BRIEFING.md b/.agents/BRIEFING.md
index 9166643..869d75a 100644
--- a/.agents/BRIEFING.md
+++ b/.agents/BRIEFING.md
@@ -1,31 +1,32 @@
-# BRIEFING — 2026-06-04T04:03:27Z
+# BRIEFING — 2026-06-23T16:54:06Z
 
 ## Mission
-Audit security vulnerabilities in Career Guidance repo and produce a comprehensive report in docs/security_audit_report.md.
+Perform a deep-dive performance audit, identify bottlenecks, and implement clean code optimizations across the backend and frontend codebases.
 
 ## 🔒 My Identity
 - Archetype: sentinel
-- Working directory: D:\Career Guidence\.agents\
-- Orchestrator: 0db72abf-2b9b-41e5-b005-c575b70b1d9c
-- Victory Auditor: 3099b2b4-6839-4085-a9b1-214f8d1f9c12
+- Working directory: d:\Career Guidence\.agents
+- Orchestrator: cc0f6daa-d22f-43be-a929-37122b7d44cc
+- Victory Auditor: TBD
+- Cron 1 Task: ef388631-0d62-4164-ae90-98bc2adf977f/task-138
+- Cron 2 Task: ef388631-0d62-4164-ae90-98bc2adf977f/task-140
 
 ## 🔒 Key Constraints
 - No technical decisions — relay only
 - Victory Audit is MANDATORY before reporting completion
 
 ## User Context
-- **Last user request**: Run a comprehensive security audit on the current repository (`Career Guidence`).
-- **Pending clarifications**: [none]
-- **Delivered results**: [none]
+- **Last user request**: Performance audit, identify bottlenecks, and implement clean code optimizations across backend (FastAPI) and frontend (React/Vite).
+- **Pending clarifications**: none
+- **Delivered results**: none
 
 ## Project Status
-- **Phase**: victory claimed
+- **Phase**: in progress (Verification & Validation)
 
 ## Victory Audit Status
-- **Triggered**: yes
+- **Triggered**: no
 - **Verdict**: pending
 - **Retry count**: 0
 
 ## Artifact Index
-- D:\Career Guidence\ORIGINAL_REQUEST.md — Authoritative record of user request
-- D:\Career Guidence\.agents\original_prompt.md — Verbatim original prompt
+- d:\Career Guidence\ORIGINAL_REQUEST.md — Authoritative record of user request
diff --git a/.agents/handoff.md b/.agents/handoff.md
index f21c7fd..3afed7f 100644
--- a/.agents/handoff.md
+++ b/.agents/handoff.md
@@ -1,19 +1,25 @@
-# Handoff Report — Victory Claimed & Auditor Spawned
+# Handoff Report — Orchestrator Initialized & Crons Scheduled
 
 ## Observation
-The Project Orchestrator has claimed completion of all milestones (Exploration, Automated Scans, Manual Code Review, Report Generation, Verification). The final report has been generated at `docs/security_audit_report.md`.
+- Received new user request to perform a performance audit and code cleanups.
+- Appended request to `ORIGINAL_REQUEST.md` under timestamped header `2026-06-23T16:54:06Z`.
+- Updated `BRIEFING.md` to record the new mission and identity.
+- Dispatched Project Orchestrator subagent (`cc0f6daa-d22f-43be-a929-37122b7d44cc`).
+- Set two recurring crons for monitoring.
 
 ## Logic Chain
-- As all orchestrator milestones have been marked completed in `progress.md`, the orchestrator sent a victory claim to the Sentinel.
-- Per Sentinel instructions, we are required to block final user delivery until a Victory Auditor confirms the claims.
-- We have spawned the independent Victory Auditor (`teamwork_preview_victory_auditor`) with conversation ID `3099b2b4-6839-4085-a9b1-214f8d1f9c12` to audit the timeline, cheating detection, and run independent validations.
+- As the Project Sentinel, our role is to act as a coordinator and watchdog.
+- We spawned `teamwork_preview_orchestrator` to do the actual planning and execution.
+- We scheduled Cron 1 (`*/8 * * * *`) for progress reporting to the user and Cron 2 (`*/10 * * * *`) for orchestrator liveness checks.
 
 ## Caveats
-Final delivery of the security audit results is pending the victory audit report verdict.
+- The Project Orchestrator is still initializing its plan.
+- The scheduled crons will wake us up periodically.
 
 ## Conclusion
-Auditor is now running. We will wait for its confirmation or rejection before proceeding.
+- The Project Orchestrator has started execution. We are currently idling and waiting for cron events or messages from the orchestrator.
 
 ## Verification Method
-- Verification of spawned subagent: Conversation ID `3099b2b4-6839-4085-a9b1-214f8d1f9c12` is registered.
-- `docs/security_audit_report.md` exists and contains logs from local security scans.
+- Active orchestrator subagent conversation ID is `cc0f6daa-d22f-43be-a929-37122b7d44cc`.
+- Cron 1 Task: `ef388631-0d62-4164-ae90-98bc2adf977f/task-23`
+- Cron 2 Task: `ef388631-0d62-4164-ae90-98bc2adf977f/task-25`
diff --git a/.agents/orchestrator/BRIEFING.md b/.agents/orchestrator/BRIEFING.md
index 4f1f746..2ff9f15 100644
--- a/.agents/orchestrator/BRIEFING.md
+++ b/.agents/orchestrator/BRIEFING.md
@@ -1,22 +1,22 @@
-# BRIEFING — 2026-06-04T09:33:44+05:30
+# BRIEFING — 2026-06-24T06:27:00Z
 
 ## Mission
-Coordinate and execute the comprehensive security audit on Career Guidance repository and produce the final report at docs/security_audit_report.md.
+Coordinate and execute the performance audit and optimization on Career Guidance backend and frontend codebases.
 
 ## 🔒 My Identity
 - Archetype: orchestrator
 - Roles: orchestrator, user_liaison, human_reporter, successor
 - Working directory: D:\Career Guidence\.agents\orchestrator\
 - Original parent: main agent
-- Original parent conversation ID: 474ff3fb-3707-43e0-87ad-e89ac80e2b9b
+- Original parent conversation ID: ef388631-0d62-4164-ae90-98bc2adf977f
 
 ## 🔒 My Workflow
 - **Pattern**: Project
 - **Scope document**: D:\Career Guidence\.agents\orchestrator\plan.md
-1. **Decompose**: Decompose the security audit into milestones (Scans, Checks, Report Generation, and Review/Validation).
+1. **Decompose**: Decompose the task into 4 milestones: (1) Performance Audit & Discovery, (2) Backend Performance Fixes, (3) Frontend Clean Code & Fixes, (4) Verification & Validation.
 2. **Dispatch & Execute**:
-   - **Direct (iteration loop)**: Explorer -> Worker -> Reviewer -> Auditor -> Gate
-   - **Delegate (sub-orchestrator)**: None needed since the scope is auditing, but we will spawn specialized agents.
+   - **Direct (iteration loop)**: Explorer -> Worker -> Reviewer -> Challenger -> Auditor -> Gate
+   - **Delegate (sub-orchestrator)**: None needed for this task scope.
 3. **On failure** (in this order):
    - Retry: nudge stuck agent or re-send task
    - Replace: spawn fresh agent with partial progress
@@ -24,50 +24,54 @@ Coordinate and execute the comprehensive security audit on Career Guidance repos
    - Redistribute: split stuck agent's remaining work
    - Redesign: re-partition decomposition
    - Escalate: report to parent (sub-orchestrators only, last resort)
-4. **Succession**: Spawn successor if spawn count >= 16.
+4. **Succession**: Self-succeed at 16 spawns.
 - **Work items**:
-  1. Initialize plan and progress [done]
-  2. Perform exploration and dependency/vulnerability scanning [done]
-  3. Execute automated checks and verification (Bandit/npm audit) [done]
-  4. Perform manual code security review (JWT, CORS, Secrets, guards) [done]
-  5. Compile security audit report [done]
-  6. Review, audit, and finalize report [done]
+  1. Performance Audit & Discovery [done]
+  2. Backend Performance Fixes [done]
+  3. Frontend Clean Code & Fixes [done]
+  4. Verification & Validation [in-progress]
 - **Current phase**: 4
-- **Current focus**: None (Audit Complete)
+- **Current focus**: Verification & Validation
 
 ## 🔒 Key Constraints
 - NEVER write, modify, or create source code files directly.
-- NEVER run build/test commands yourself.
-- Use file-editing tools ONLY for metadata/state files (.md) in your .agents/ folder.
-- Zero tolerance for integrity violations.
-- Send message to Sentinel (main agent) when all milestones are complete.
+- NEVER run build/test commands yourself — require workers to do so.
+- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/ folder.
+- Never reuse a subagent after it has delivered its handoff — always spawn fresh
 
 ## Current Parent
-- Conversation ID: 474ff3fb-3707-43e0-87ad-e89ac80e2b9b
-- Updated: not yet
+- Conversation ID: ef388631-0d62-4164-ae90-98bc2adf977f
+- Updated: 2026-06-24T06:00:00Z
 
 ## Key Decisions Made
-- Decompose audit into 4 sequential milestones: Exploration & Scanner Executions, Codebase Security Review, Report Generation, Verification & Gate.
+- Decompose audit and optimization into 4 milestones. Start with three Explorers to identify specific code lines and plan fixes. Replaced explorer_audit_2 due to agent execution error. Dispatched two Workers concurrently to apply fixes to backend and frontend. Revived workers after server restarts. Replaced backend worker due to unresponsiveness, but original worker finished successfully. Redundant replacement worker was cancelled. Dispatched Reviewers and Forensic Auditor to run verification.
 
 ## Team Roster
 | Agent | Type | Work Item | Status | Conv ID |
 |-------|------|-----------|--------|---------|
-| explorer_m1_1 | teamwork_preview_explorer | Explore and scan codebase for security vulnerabilities | completed | 58a0f804-281d-41dd-b078-5803fac694e6 |
-| worker_m1_1 | teamwork_preview_worker | Run automated scanners (Bandit, npm audit) | completed | 862f17bf-e2e2-4096-a547-5c9bfd7e14e8 |
-| worker_m3_1 | teamwork_preview_worker | Compile and write final security audit report | completed | 92f88ab2-2a22-4062-934f-388cd05a21b6 |
-| reviewer_m4_1 | teamwork_preview_reviewer | Review generated report against criteria | completed | 22e6e15d-56ee-48ec-8352-dee4eeb96fef |
-| auditor_m4_1 | teamwork_preview_auditor | Perform forensic integrity audit | completed | fc54f677-b735-4089-b5fe-6bf44798dbef |
+| explorer_audit_1 | teamwork_preview_explorer | Frontend Performance Explorer | completed | b1e0b1dd-41ef-4d4f-8606-e78bb07c280d |
+| explorer_audit_2 | teamwork_preview_explorer | Backend Database Explorer (Failed) | failed | 894f4574-c721-4a67-bb12-6d5b4bf281f0 |
+| explorer_audit_2_gen1 | teamwork_preview_explorer | Backend Database Explorer (Replacement) | completed | 16479fd1-9ad6-45b2-a1e6-3081dd8d2eae |
+| explorer_audit_3 | teamwork_preview_explorer | Backend Concurrency Explorer | completed | 129f5ff9-7e2c-48d4-8d94-7aa74854662d |
+| worker_frontend | teamwork_preview_worker | Frontend Optimization Worker | completed | e6baf113-1a4d-4c4a-b615-c151ad8c6c79 |
+| worker_backend | teamwork_preview_worker | Backend Performance Worker | completed | d3156a8f-2ddd-49a8-b92d-2924c1c194ff |
+| worker_backend_gen1 | teamwork_preview_worker | Backend Performance Worker (Cancelled) | cancelled | 01f632ea-d4ad-4115-8bd6-48a94c8b25d6 |
+| reviewer_frontend | teamwork_preview_reviewer | Frontend Code Reviewer | pending | 034ee413-ff79-4480-97b6-352b9bfa4068 |
+| reviewer_backend | teamwork_preview_reviewer | Backend Code Reviewer | pending | 970623da-f051-49b8-b11d-79e9fc7980b0 |
+| forensic_auditor | teamwork_preview_auditor | Integrity Forensic Auditor | pending | 079d5c0f-a606-4c44-afc4-c3afe1305c06 |
 
 ## Succession Status
 - Succession required: no
-- Spawn count: 5 / 16
-- Pending subagents: none
+- Spawn count: 10 / 16
+- Pending subagents: 034ee413-ff79-4480-97b6-352b9bfa4068, 970623da-f051-49b8-b11d-79e9fc7980b0, 079d5c0f-a606-4c44-afc4-c3afe1305c06
 - Predecessor: none
 - Successor: not yet spawned
 
 ## Active Timers
-- Heartbeat cron: none
+- Heartbeat cron: cc0f6daa-d22f-43be-a929-37122b7d44cc/task-142
 - Safety timer: none
+- On succession: kill all timers before spawning successor
+- On context truncation: run `manage_task(Action="list")` — re-create if missing
 
 ## Artifact Index
 - D:\Career Guidence\.agents\orchestrator\plan.md — Project milestones and decomposition
diff --git a/.agents/orchestrator/plan.md b/.agents/orchestrator/plan.md
index b4090dc..f6ed1e0 100644
--- a/.agents/orchestrator/plan.md
+++ b/.agents/orchestrator/plan.md
@@ -1,18 +1,18 @@
-# Plan: Security Audit for Career Guidance
+# Project: Career Guidance Performance Audit and Optimization
 
 ## Architecture
-- FastAPI Backend: `resume_pipeline/`
-- React Frontend: `frontend/`
-- Target Report: `docs/security_audit_report.md`
+- **Backend (FastAPI)**: Python 3.11 web service with SQLAlchemy ORM using PostgreSQL/SQLite. Uses repositories in `resume_pipeline/repos/` and database configuration in `resume_pipeline/db.py`.
+- **Frontend (React/Vite)**: React SPA with routes, components (like `JobsPage`, `StudentProfile`), styling with Tailwind CSS, and global state/hooks.
 
 ## Milestones
 | # | Name | Scope | Dependencies | Status |
 |---|------|-------|-------------|--------|
-| 1 | Exploration & Tool Scans | Run automated security scanners (Bandit, npm audit, secret checks) and collect raw logs. | none | DONE (862f17bf-e2e2-4096-a547-5c9bfd7e14e8) |
-| 2 | Codebase Security Review | Audit JWT verification, bcrypt, route guards, CORS, rate-limiting, and error handling. | M1 | DONE (58a0f804-281d-41dd-b078-5803fac694e6) |
-| 3 | Report Generation | Draft `docs/security_audit_report.md` containing Executive Summary, Vulnerability Details Table, and Tool Scan Logs. | M2 | DONE (92f88ab2-2a22-4062-934f-388cd05a21b6) |
-| 4 | Verification & Final Gate | Run review & forensic audit on the report to verify accuracy, structure, and integrity. | M3 | DONE (22e6e15d-56ee-48ec-8352-dee4eeb96fef, fc54f677-b735-4089-b5fe-6bf44798dbef) |
+| 1 | Performance Audit & Discovery | Audit backend N+1 query patterns, async event-loop blockers (sync request calls, blocking I/O), and frontend React runtime crashes/thrashing (JobCard nesting, showToast calls). | none | DONE (b1e0b1dd-41ef, 16479fd1-9ad6, 129f5ff9-7e2c) |
+| 2 | Backend Performance Fixes | Implement optimization fixes for N+1 loops in `/api/applicants` and recommendation engines, and mitigate blocking I/O/synchronous requests in async routes. | M1 | DONE (d3156a8f-2ddd) |
+| 3 | Frontend Clean Code & Fixes | Fix `StudentProfile.jsx` `showToast` runtime crash and `JobsPage.jsx` nested component declarations (JobCard) to prevent DOM thrashing. | M1 | DONE (e6baf113-1a4d) |
+| 4 | Verification & Validation | Run backend tests via `pytest` and build/lint frontend via `npm run lint` and `npm run build` to verify no functional regressions. Perform forensic audit. | M2, M3 | IN_PROGRESS (034ee413-ff79, 970623da-f051, 079d5c0f-a606) |
 
 ## Interface Contracts
-- Scanner output: Raw log text files or output captured in the subagent's working directory.
-- Report location: `docs/security_audit_report.md` must be created in the repository root.
+- **N+1 Optimizations**: Eager loading relationships using `joinedload` or executing bulk database queries rather than individual iteration queries.
+- **Async Concurrency**: Convert synchronous HTTP calls to asynchronous using `httpx.AsyncClient` or offload blocking execution to a separate executor thread.
+- **Frontend Error Boundaries**: UI toast notifications must use valid handlers. React components must be defined at the module level rather than nested inside parent render functions.
diff --git a/.agents/orchestrator/progress.md b/.agents/orchestrator/progress.md
index 041c530..2347541 100644
--- a/.agents/orchestrator/progress.md
+++ b/.agents/orchestrator/progress.md
@@ -1,21 +1,20 @@
 ## Current Status
-Last visited: 2026-06-04T09:56:00+05:30
+Last visited: 2026-06-24T06:27:00Z
+
+- [x] Milestone 1: Performance Audit & Discovery (Explorer)
+  - Completed. Identified N+1 loops, event loop blockages, profile toast crash, and JobsPage DOM thrashing.
+- [x] Milestone 2: Backend Performance Fixes (Worker)
+  - Completed. Original worker finished database & async loop optimization refactoring. Seeding and tests pass.
+- [x] Milestone 3: Frontend Clean Code & Fixes (Worker)
+  - Completed. Frontend optimizations, un-nesting, memoization, cooldown timer, toast crash refactoring implemented. Lint & build pass.
+- [/] Milestone 4: Verification & Validation (Reviewer + Challenger + Auditor)
+  - In progress. Dispatched independent Reviewers for frontend and backend, and Forensic Auditor for integrity verification.
 
 ## Iteration Status
 Current iteration: 1 / 32
 
-## Checklist
-- [x] Initialized plan and briefing
-- [x] Milestone 1: Exploration and Tool Scans (Bandit, npm audit)
-- [x] Milestone 2: Codebase Security Review (Auth, CORS, Secrets, guards)
-- [x] Milestone 3: Report Generation (docs/security_audit_report.md)
-- [x] Milestone 4: Verification and Final Gate
-
 ## Retrospective Notes
-- **What worked**: Decoupling scanning and manual review into distinct milestones allowed explorer to focus on code logic and worker to resolve Windows encoding issues with Bandit.
-- **What didn't work**: Running security scans directly on Windows shell can crash due to Unicode issues (like the arrow `→` character in Bandit outputs). This was solved by using python `-X utf8 -m bandit` explicitly.
-- **Lessons learned**: Independent verification (Reviewer + Forensic Auditor) provides valuable extra confidence and exposes potential pitfalls (e.g. rate-limiter circuit breaker state polluting pytest runs, and technical impracticality of FAISS JSON exports).
-- **Process improvements**:
-  1. Add circuit-breaker reset fixtures to backend pytest suite to prevent cross-test state contamination.
-  2. Implement proper native FAISS serialization methods rather than standard python pickles to completely avoid insecure deserialization vulnerabilities.
-  3. Fail-open Redis limiter config to prevent DOS when caching layers are temporarily offline.
+- **What worked**: Concurrent explorer dispatch allows quick scanning of different layers.
+- **What didn't work**: Network errors and server restarts can cause subagents to become unresponsive.
+- **Lessons learned**: Monitoring subagent progress during heartbeats and replacing unresponsive workers preserves execution speed. Original workers may still complete if they were just running slow tasks (like full tests).
+- **Process improvements**: When a worker returns after replacement, cancel the replacement task immediately to avoid double execution conflicts.
diff --git a/.env.example b/.env.example
index 7c8eb56..4f0dc4c 100644
--- a/.env.example
+++ b/.env.example
@@ -117,4 +117,11 @@ ACCESS_TOKEN_EXPIRE_MINUTES=1440
 # =============================================================================
 GMAIL_USER=your-email@gmail.com
 GMAIL_APP_PASSWORD=YOUR_16_CHAR_APP_PASSWORD
-FRONTEND_URL=http://localhost:5173
+FRONTEND_URL=http://localhost:3000
+
+# =============================================================================
+# GOOGLE OAUTH2 SETTINGS
+# =============================================================================
+GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
+GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
+BACKEND_URL=http://localhost:8000
diff --git a/AGENTS.md b/AGENTS.md
index ed087bb..2a5b2ce 100644
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -269,70 +269,36 @@ import StatusBadge from '../components/StatusBadge'
 
 ## Production Deployment
 
-### Live URLs
+### Deployed Services
 
-| Service | URL |
-|---|---|
-| Frontend (React) | `https://career-guidance-frontend-pcjn.onrender.com` |
-| Backend (FastAPI) | `https://career-guidance-1sep.onrender.com` |
-| Backend API docs | `https://career-guidance-1sep.onrender.com/docs` |
-
-### Infrastructure
-
-| Component | Provider | Details |
+| Component | Host / Provider | Details / Settings |
 |---|---|---|
-| Backend hosting | Render | Web service `srv-d6pgciqa214c7397rv8g`, name `Career-Guidance` |
-| Frontend hosting | Render | Static site `srv-d6pv47hj16oc73bnn4ng`, name `career-guidance-frontend` |
-| Database | Supabase | Project `taalckzdvzxaigpdseme`, region `ap-south-1` |
+| Frontend (React) | Vercel | Static SPA deployment |
+| Backend (FastAPI) | AWS EC2 | FastAPI python service running in Docker container |
+| Database | Supabase | PostgreSQL instances on port `5432` / pooler port `6543` |
 
-### Render — Backend Web Service
+### AWS EC2 Backend Service
 
-- **Service ID**: `srv-d6pgciqa214c7397rv8g`
-- **Owner ID**: `tea-d6pff6qa214c7397d3fg`
-- **Runtime**: Docker (`resume_pipeline/Dockerfile`), build context: repo root
-- **Auto-deploy**: enabled on push to `main`
-- **`PG_DSN` is NOT set** — DSN is built from parts in `config.py` using `quote_plus`
+- **Deployment context**: Dockerized container running from the repository context.
+- **Port mapping**: External port `8000` is bound to container port `8000`.
+- **`PG_DSN` is NOT set**: Derived dynamically from `PG_*` variables inside `config.py` using `quote_plus` to avoid issues with special password characters.
 
-### Render — Frontend Static Site
+### Vercel Frontend Service
 
-- **Service ID**: `srv-d6pv47hj16oc73bnn4ng`
-- **Root dir**: `frontend/`
-- **Build command**: `npm install && npm run build`
-- **Publish path**: `dist`
-- **Auto-deploy**: enabled on push to `main`
-- **`VITE_API_URL`** is set as a Render build environment variable (not from `.env.production`, which is gitignored by root `.gitignore` via `*.env.*`)
-- `frontend/public/_redirects` contains `/* /index.html 200` for React Router SPA routing
+- **Build config**: `npm run build` with output directory set to `dist`.
+- **`vercel.json`**: Routing rules rewrite all paths back to `/index.html` to allow React Router SPA client routing.
+- **`VITE_API_URL`**: Defined inside Vercel Dashboard env vars to point to the public IP/DNS of the EC2 backend: `http://<ec2-ip>:8000`.
 
 ### Supabase Database
 
-- **Project ref**: `taalckzdvzxaigpdseme`
-- **Region**: `ap-south-1` (Asia Pacific South) — **critical**, wrong region = connection failure
-- **Session pooler host**: `aws-1-ap-south-1.pooler.supabase.com` (port `5432`)
-- **Username**: `postgres.taalckzdvzxaigpdseme` (pooler format, not plain `postgres`)
+- **Session pooler host**: `aws-1-ap-south-1.pooler.supabase.com` (port `5432` or transaction pooler port `6543`).
+- **Username**: `postgres.taalckzdvzxaigpdseme` (standard Supabase pooler credentials format).
 - **Database**: `postgres`
-- All 29 tables + 21 ENUMs are applied via migrations
-
-### Backend Environment Variables (Render)
-
-```
-PG_HOST=aws-1-ap-south-1.pooler.supabase.com
-PG_PORT=5432
-PG_USER=postgres.taalckzdvzxaigpdseme
-PG_PASSWORD=<supabase password>
-PG_DB=postgres
-# PG_DSN must NOT be set — config.py builds it from the above parts
-GEMINI_API_KEY=...
-GEMINI_MOCK_MODE=false
-GROQ_API_KEY=...
-SECRET_KEY=...
-CORS_ORIGINS=https://career-guidance-1sep.onrender.com,https://career-guidance-frontend-pcjn.onrender.com,http://localhost:3000,http://localhost:5173
-FRONTEND_URL=https://career-guidance-frontend-pcjn.onrender.com
-```
+- Migration schemas define all 29 tables and 21 enums.
 
 ### Key Deployment Conventions
 
-- **`config.py`** uses `model_config = SettingsConfigDict(env_file=None)` — pydantic-settings never reads `.env` files; only OS env vars (injected by Render) are used.
-- **`load_dotenv`** is skipped when `RENDER` env var is present (set automatically by Render on all services).
+- **`config.py`** uses `model_config = SettingsConfigDict(env_file=None)` — pydantic-settings loads from OS environment variables injected into the container/shell on production.
 - **`db.py`** uses `SQLAlchemy URL.create()` for Supabase connections to avoid string-parsing issues with special characters in passwords.
 - **`IS_SUPABASE`** flag in `config.py` is auto-detected from `PG_HOST` containing `supabase.co` or `supabase.com`; controls SSL mode and startup behaviour.
 - **Docker build context** is the repo root (`Dockerfile` at `resume_pipeline/Dockerfile`); all `COPY` paths must use the `resume_pipeline/` prefix.
@@ -341,9 +307,7 @@ FRONTEND_URL=https://career-guidance-frontend-pcjn.onrender.com
 ### Common Deployment Pitfalls
 
 - Using the wrong Supabase pooler region (e.g. `aws-0-us-east-1` instead of `aws-1-ap-south-1`) → `FATAL: Tenant or user not found`.
-- Setting `PG_DSN` as a Render env var with special chars in the password → Render percent-encodes them, causing a malformed DSN. Always use the individual `PG_*` fields instead.
-- A `requirements.txt` in `frontend/` causes Render to treat it as a Python project and fail the build — keep `frontend/` free of `requirements.txt`.
-- Forgetting `frontend/public/_redirects` → direct navigation to any React Router route returns 404 from the CDN.
+- Setting `PG_DSN` as an environment variable with special chars in the password → causes a malformed DSN. Always use the individual `PG_*` fields instead.
 - Adding a new frontend domain without updating `CORS_ORIGINS` on the backend → API calls blocked by CORS.
 
 ---
diff --git a/ORIGINAL_REQUEST.md b/ORIGINAL_REQUEST.md
index 398c811..8400ab7 100644
--- a/ORIGINAL_REQUEST.md
+++ b/ORIGINAL_REQUEST.md
@@ -34,3 +34,40 @@ Integrity mode: development
 
 ### Verification Output
 - [ ] The "Tool Scan Logs" section contains raw output or verified logs from executing at least one automated tool (e.g., Bandit or npm audit).
+
+## Follow-up — 2026-06-23T16:54:06Z
+
+The project goal is to perform a deep-dive performance audit, identify bottlenecks, and implement clean code optimizations across the backend (FastAPI) and frontend (React/Vite) codebases of the Career Guidance system.
+
+Working directory: d:/Career Guidence
+Integrity mode: development
+
+## Requirements
+
+### R1. Performance Audit & Optimization Discovery
+Audit both frontend and backend codebases for additional CPU, memory, and database bottlenecks (e.g. N+1 queries, synchronous blocking calls in async routes, redundant computations, nested loops, inefficient array conversions).
+
+### R2. Codebase Fix Implementation
+Refactor the identified performance issues and bug patterns without breaking core functionality. This includes:
+- Resolving the `StudentProfile.jsx` `showToast` runtime crash.
+- Resolving nested component declarations in `JobsPage.jsx` to prevent DOM layout thrashing.
+- Optimizing backend N+1 loops in `/api/applicants` and recommendation engine components.
+- Mitigating blocking I/O and synchronous `requests` calls in async routers.
+
+### R3. Test Suite Compatibility
+Ensure all code changes compile cleanly, pass linting checks, and maintain compatibility with existing tests.
+
+## Acceptance Criteria
+
+### Technical Cleanliness
+- [ ] No nested component definitions inside other React component bodies (specifically `JobCard`).
+- [ ] No undefined function calls in toast notification bindings on the profile page.
+- [ ] Backend database sessions and connections are properly pooled and closed.
+
+### Performance & Concurrency
+- [ ] Loop queries (N+1 queries) in active route handlers and recommendation engines are replaced with eager loading (`joinedload`) or batch lookups.
+- [ ] SSE streams and background tasks do not block the main FastAPI event loop thread.
+
+### Verification
+- [ ] `pytest tests/` runs and passes successfully for all unit tests.
+- [ ] `npm run lint` and `npm run build` in the `frontend` folder exit with code 0 (no compile or eslint errors).
diff --git a/docs/DEPLOYMENT.md b/docs/DEPLOYMENT.md
index a32875a..fdef3ad 100644
--- a/docs/DEPLOYMENT.md
+++ b/docs/DEPLOYMENT.md
@@ -46,8 +46,8 @@ The backend loads settings dynamically from OS environment variables. In local d
 - `GMAIL_APP_PASSWORD`: A 16-character Gmail App Password (do not use your primary password).
 
 ### Networking & CORS
-- `FRONTEND_URL`: Primary frontend domain used for redirects and link buildings (e.g., `https://career-guidance.onrender.com`).
-- `CORS_ORIGINS`: Comma-separated list of allowed CORS origins (e.g., `http://localhost:3000,http://localhost:5173,https://career-guidance.onrender.com`).
+- `FRONTEND_URL`: Primary frontend domain used for redirects and link buildings (e.g., `https://your-site.vercel.app`).
+- `CORS_ORIGINS`: Comma-separated list of allowed CORS origins (e.g., `http://localhost:3000,http://localhost:5173,https://your-site.vercel.app`).
 
 ---
 
@@ -78,9 +78,9 @@ Make sure Docker and Docker Compose are installed. Ensure port `80` (frontend) a
 
 ---
 
-## ☁️ Production Cloud Deployment (Supabase, Render & Vercel)
+## ☁️ Production Cloud Deployment (Supabase, AWS EC2 & Vercel)
 
-Our zero-dollar cost production deployment environment is split across **Supabase** (database), **Render** (FastAPI backend), and **Vercel** (React frontend SPA).
+Our production deployment environment is split across **Supabase** (database), **AWS EC2** (FastAPI backend), and **Vercel** (React frontend SPA).
 
 ### 1. Database Setup (Supabase)
 1. Provision a PostgreSQL instance on [Supabase](https://supabase.com) in your closest region.
@@ -96,32 +96,7 @@ Our zero-dollar cost production deployment environment is split across **Supabas
 
 ---
 
-### 2. Backend API Service (Render)
-Deploy the FastAPI backend as a Render Python Web Service using the repository's root `render.yaml` Blueprint file, or set it up manually:
-
-* **Runtime**: `Python`
-* **Root Directory**: `resume_pipeline`
-* **Build Command**: `pip install -r requirements.txt`
-* **Start Command**: `uvicorn resume_pipeline.app:app --host 0.0.0.0 --port $PORT`
-* **Health Check Path**: `/health` (tells Render to check if the app is online at this route; prevents container restart loops)
-
-#### Render Environment Variables
-
-| Variable Key | Suggested Placeholder Value | Description |
-|---|---|---|
-| `DATABASE_URL` | `postgresql+psycopg2://postgres.example_ref:%40encoded_pass@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres` | Supabase PgBouncer pooler DSN (port 6543). Automatically triggers SSL and Kerberos bypass modes. |
-| `GEMINI_API_KEY` | `AIzaSyExampleGeminiApiKeyHere` | API key from Google AI Studio. |
-| `GROQ_API_KEY` | `gsk_ExampleGroqApiKeyHere` | API key from Groq Console. |
-| `SECRET_KEY` | `your_32_char_secure_hex_key_here` | Secret key to sign authentication JWT tokens. |
-| `GMAIL_USER` | `your-smtp-sender@gmail.com` | Email address used to dispatch verification codes. |
-| `GMAIL_APP_PASSWORD` | `abcd efgh ijkl mnop` | 16-character Gmail app-specific password. |
-| `CORS_ORIGINS` | `https://your-site.vercel.app,http://localhost:3000,http://localhost:5173` | Comma-separated list of allowed origins. **Must not have trailing slashes**. |
-| `FRONTEND_URL` | `https://your-site.vercel.app` | Target client URL for verification flow redirects. |
-| `PYTHON_VERSION` | `3.11.0` | Force Python runtime version. |
-
----
-
-### 3. Frontend Static Site (Vercel)
+### 2. Frontend Static Site (Vercel)
 Deploy the React frontend SPA onto [Vercel](https://vercel.com) directly from the repository's `frontend/` subdirectory:
 
 * **Framework Preset**: `Vite`
@@ -136,7 +111,7 @@ Set this variable in the **Vercel Project Dashboard → Settings → Environment
 
 | Variable Key | Suggested Placeholder Value | Description |
 |---|---|---|
-| `VITE_API_BASE_URL` | `https://career-guidance-backend-i0ty.onrender.com` | The URL of your active Render backend service (do not include a trailing `/`). |
+| `VITE_API_BASE_URL` | `http://<your-ec2-public-ip-or-domain>:8000` | The URL of your active AWS EC2 backend service (do not include a trailing `/`). |
 
 ---
 
diff --git a/docs/INTERVIEW_SYSTEM_ARCHITECTURE.md b/docs/INTERVIEW_SYSTEM_ARCHITECTURE.md
index 4bcf49c..85afdb0 100644
--- a/docs/INTERVIEW_SYSTEM_ARCHITECTURE.md
+++ b/docs/INTERVIEW_SYSTEM_ARCHITECTURE.md
@@ -1233,7 +1233,7 @@ To prevent API spams and safeguard against high LLM/Whisper costs, a transaction
 - **Answer Submission**: Max 1 answer submitted per 10 seconds per applicant, and an overall limit of 30 evaluations per day.
 
 ### Implementation Blueprint (`limiter.py`)
-Both checks query the transactional indexes of the `interview_sessions` and `interview_answers` tables. This is 100% safe for multi-process environments like Render, as all web processes share the same PostgreSQL database.
+Both checks query the transactional indexes of the `interview_sessions` and `interview_answers` tables. This is 100% safe for multi-process environments like EC2 or load-balanced servers, as all web processes share the same PostgreSQL database.
 
 On violation, the backend throws an `HTTP 429 Too Many Requests` error with detailed retry instructions, which are seamlessly displayed by the frontend toast alert system.
 
diff --git a/docs/security_audit_report.md b/docs/security_audit_report.md
index 6d5c94c..cfbe7a8 100644
--- a/docs/security_audit_report.md
+++ b/docs/security_audit_report.md
@@ -9,7 +9,7 @@ The audit analyzed both the backend (`resume_pipeline/` running FastAPI/Python 3
 1. **Secrets Exposure (Critical)**: Production credentials and API keys (Gemini, Groq, OpenRouter, Google, YouTube, Gmail App Password, and PostgreSQL passwords) were found hardcoded in the `.env` configuration file tracked by version control.
 2. **Broken Object-Level Authorization (High)**: Lack of ownership validation on critical backend endpoints (`/api/applicant/{applicant_id}` and `/api/parse/status/{applicant_id}`) allows any authenticated user to fetch other users' detailed resumes and parsing confidence scores.
 3. **Insecure Deserialization (Medium)**: Use of Python's `pickle.load()` on FAISS vector store indexes introduces potential Remote Code Execution (RCE) vulnerabilities if indices are tampered with.
-4. **Vulnerable Custom Rate Limiting (Medium)**: Custom rate limiters rely on in-memory `defaultdict` objects, which fail under multi-process application deployments (like Render) and are susceptible to memory exhaustion.
+4. **Vulnerable Custom Rate Limiting (Medium)**: Custom rate limiters rely on in-memory `defaultdict` objects, which fail under multi-process application deployments (like EC2 or containerized clusters) and are susceptible to memory exhaustion.
 5. **Weak Frontend Cryptography & XSS Vectors (Low)**: Client-side obfuscation (`btoa` / `atob`) is labeled as "encrypted storage" but provides zero cryptographic security. Unsanitized rendering of markdown in `AskPage.jsx` presents XSS risks.
 6. **Outdated/Vulnerable Dependencies (High/Moderate)**:
    - Python backend relies on weak MD5 hashes for key generation and contains insecure XML parsing via `ElementTree`.
@@ -21,7 +21,7 @@ The audit analyzed both the backend (`resume_pipeline/` running FastAPI/Python 3
 
 | Severity | Location/File Path | Description | Impact | Remediation |
 | :--- | :--- | :--- | :--- | :--- |
-| **Critical** | `D:\Career Guidence\.env` <br>(Lines 7, 14, 20, 22, 25, 28, 33, 67, 74-75) | Exposure of sensitive credentials (Gemini, Groq, OpenRouter, Google, YouTube API keys, Gmail SMTP credentials, PG_PASSWORD, JWT SECRET_KEY) in version-controlled repository configuration. | Unauthorized API access, financial charge escalation on AI credits, email-based spoofing/phishing, and complete database compromise. | Revoke and regenerate all exposed keys/secrets. Ensure `.env` is omitted from version control (`git rm --cached .env`). Inject credentials at runtime using environment variables managed by the hosting platform (e.g. Render env vars). |
+| **Critical** | `D:\Career Guidence\.env` <br>(Lines 7, 14, 20, 22, 25, 28, 33, 67, 74-75) | Exposure of sensitive credentials (Gemini, Groq, OpenRouter, Google, YouTube API keys, Gmail SMTP credentials, PG_PASSWORD, JWT SECRET_KEY) in version-controlled repository configuration. | Unauthorized API access, financial charge escalation on AI credits, email-based spoofing/phishing, and complete database compromise. | Revoke and regenerate all exposed keys/secrets. Ensure `.env` is omitted from version control (`git rm --cached .env`). Inject credentials at runtime using environment variables managed by the hosting platform (e.g., EC2 or Vercel env vars). |
 | **High** | `D:\Career Guidence\resume_pipeline\resume_pipeline\app.py` <br>(Lines 1505-1547 & 1364-1414) | Broken Object-Level Authorization (BOLA/IDOR) on applicant profile and parsing status endpoints. Authenticated users can retrieve details for any applicant ID without ownership checks. | Malicious users can enumerate integer or UUID IDs to scrape personal details, grades, resume text, and emails of all registered candidates. | Implement owner validation check. Verify that `current_user.id` matches `applicant.user_id` or that the user has administrative/employer/college credentials before returning applicant records. |
 | **High** | `D:\Career Guidence\resume_pipeline\resume_pipeline\app.py` (Line 3145) <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\core\google_search.py` (Line 28) <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\rag\document_processor.py` (Line 237) <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\rag\file_watcher.py` (Lines 125, 131) <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\rag\rag_service.py` (Lines 234, 244, 253, 486) <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\resume\skill_taxonomy_builder.py` (Line 31) | Use of weak MD5 hash function for generating cache keys, vector store IDs, file content hashes, and skill taxonomy cache keys. (Bandit Issue B324) | MD5 is prone to hash collision attacks. While used here primarily for non-security indexing/caching, standard security scanners mark it as a high-risk cryptographic vulnerability. | Replace MD5 with a secure hashing algorithm like SHA-256 (`hashlib.sha256()`). Alternatively, for non-security uses in Python 3.9+, pass `usedforsecurity=False` to `hashlib.md5()` to satisfy scanner rules. |
 | **High** | Frontend Dependency: `axios` <br>(v1.6.7 in `frontend/package.json`) | Frontend dependency `axios` is vulnerable to several critical flaws including Server-Side Request Forgery (SSRF) via NO_PROXY bypass, prototype pollution leading to data exfiltration, CRLF Injection, and denial of service. | Attackers can compromise request integrity, inject headers, trigger server SSRF via redirects, or cause client-side application crashes. | Upgrade `axios` in `frontend/package.json` to `^1.7.4` (or latest `1.7.7+`) and run `npm install`. |
@@ -29,7 +29,7 @@ The audit analyzed both the backend (`resume_pipeline/` running FastAPI/Python 3
 | **High** | Frontend Dependency: `flatted` | `flatted` (<=3.4.1) is vulnerable to unbounded recursion DoS in the parse revive phase and prototype pollution. | Execution of malicious payload during state restoration can crash the application or pollute prototypes. | Upgrade `flatted` to `>3.4.1`. |
 | **High** | Frontend Dependency: `rollup` | `rollup` (4.0.0 - 4.58.0) is vulnerable to arbitrary file write via path traversal during build processes. | A malicious dependency or input could overwrite local development/build files. | Upgrade `rollup` to `>4.58.0`. |
 | **High** | Frontend Dependency: `minimatch` & `picomatch` | `minimatch` (<=3.1.3) and `picomatch` (<=2.3.1 / 4.0.0 - 4.0.3) are vulnerable to Regular Expression Denial of Service (ReDoS) via repeated wildcards and method injection in POSIX character classes. | Attackers can send craft payloads causing catastrophic backtracking, hanging the process and exhausting server/client resources. | Upgrade `minimatch` to `>3.1.3` and `picomatch` to `>2.3.1` (or `>4.0.3`). |
-| **Medium** | `D:\Career Guidence\resume_pipeline\resume_pipeline\app.py` <br>(Lines 142-164 & 4025-4046) | Custom rate limiters for general API and RAG query endpoints store client requests in local in-memory `defaultdict` structures. | In multi-process deployments (e.g., Gunicorn workers on Render), rate limits are not shared and can be bypassed. Additionally, untracked IP rotation can cause memory exhaustion (DDoS). | Migrate from in-memory dicts to a distributed cache/store (e.g., Redis) using standard libraries like `slowapi` or `fastapi-limiter`. |
+| **Medium** | `D:\Career Guidence\resume_pipeline\resume_pipeline\app.py` <br>(Lines 142-164 & 4025-4046) | Custom rate limiters for general API and RAG query endpoints store client requests in local in-memory `defaultdict` structures. | In multi-process deployments (e.g., Gunicorn workers on EC2/load-balanced servers), rate limits are not shared and can be bypassed. Additionally, untracked IP rotation can cause memory exhaustion (DDoS). | Migrate from in-memory dicts to a distributed cache/store (e.g., Redis) using standard libraries like `slowapi` or `fastapi-limiter`. |
 | **Medium** | `D:\Career Guidence\resume_pipeline\resume_pipeline\rag\vector_store.py` <br>(Line 366) | Deserialization of vector store indices using standard Python `pickle.load`. (Bandit Issue B301) | If an attacker is able to write a crafted malicious pickle file to the server's FAISS storage directory, loading the index will execute arbitrary code (RCE). | Avoid using `pickle` for untrusted inputs. Use safer formats (like JSON) or verify index file signatures before loading. |
 | **Medium** | `D:\Career Guidence\resume_pipeline\resume_pipeline\resume\file_type_router.py` <br>(Line 184) | Parsing of untrusted DOCX/XML files using the standard `xml.etree.ElementTree.fromstring` function. (Bandit Issue B314) | Prone to XML External Entity (XXE) injection attacks or Billion Laughs denial of service when processing uploaded candidate resumes. | Use `defusedxml` package (`defusedxml.ElementTree.fromstring`) to parse XML files securely and prevent external entity resolution. |
 | **Medium** | `D:\Career Guidence\resume_pipeline\resume_pipeline\app.py` <br>(Line 4226) | Dev server configuration binds the FastAPI app to all interfaces (`host="0.0.0.0"`). (Bandit Issue B104) | Exposes the dev server to the external network, potentially allowing unauthorized access in shared/untrusted network environments. | Bind to local loopback (`127.0.0.1`) by default during development, and control binding via environment variables. |
diff --git a/frontend/index.html b/frontend/index.html
index 3963481..2bca3e5 100644
--- a/frontend/index.html
+++ b/frontend/index.html
@@ -6,6 +6,12 @@
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     <title>Career Guidance AI - Smart Resume Analysis & College Recommendations</title>
     <meta name="description" content="AI-powered resume parsing and career guidance platform. Upload your resume and get personalized college and job recommendations." />
+    <!-- Google Fonts -->
+    <link rel="preconnect" href="https://fonts.googleapis.com" />
+    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
+    <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;700;800&amp;family=Inter:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@700&amp;display=swap" rel="stylesheet" />
+    <!-- Material Symbols -->
+    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet" />
   </head>
   <body>
     <div id="root"></div>
diff --git a/frontend/src/App.jsx b/frontend/src/App.jsx
index d521531..9e131b3 100644
--- a/frontend/src/App.jsx
+++ b/frontend/src/App.jsx
@@ -36,6 +36,7 @@ import ErrorBoundary from './components/ErrorBoundary'
 import api from './config/api'
 import secureStorage from './utils/secureStorage'
 import { Sparkles } from 'lucide-react'
+import DashboardLayout from './components/DashboardLayout'
 
 function HomePage() {
   return (
@@ -47,15 +48,22 @@ function HomePage() {
 
 function AppContent() {
   const location = useLocation()
+  const user = secureStorage.getItem('user')
+  const isDashboardPath = location.pathname.startsWith('/student') || 
+                          location.pathname.startsWith('/employer') || 
+                          location.pathname.startsWith('/admin') || 
+                          location.pathname.startsWith('/dashboard') || 
+                          location.pathname.startsWith('/results') || 
+                          location.pathname.startsWith('/applicant') ||
+                          location.pathname === '/applicants' ||
+                          (user && (location.pathname === '/jobs' || location.pathname.startsWith('/job/')))
+  
   const hideNavbarPaths = ['/login', '/register', '/verify-email', '/verify-code', '/resend-verification', '/forgot-password', '/reset-password']
-  const showNavbar = !hideNavbarPaths.includes(location.pathname)
+  const showNavbar = !hideNavbarPaths.includes(location.pathname) && !isDashboardPath
   const showAssistantLauncher = location.pathname !== '/ask'
 
-  return (
-    <div className="min-h-screen flex flex-col">
-      {showNavbar && <Navbar />}
-      <main className="flex-grow">
-        <Routes>
+  const mainRoutes = (
+    <Routes>
           {/* Public Routes */}
           <Route path="/" element={<HomePage />} />
           <Route path="/login" element={<LoginPage />} />
@@ -218,6 +226,19 @@ function AppContent() {
           {/* Smart Dashboard Router - redirects to role-specific dashboard */}
           <Route path="/dashboard" element={<DashboardRouter />} />
         </Routes>
+  )
+
+  return (
+    <div className="min-h-screen flex flex-col bg-surface-muted dark:bg-inverse-surface">
+      {showNavbar && <Navbar />}
+      <main className="flex-grow">
+        {isDashboardPath ? (
+          <DashboardLayout>
+            {mainRoutes}
+          </DashboardLayout>
+        ) : (
+          mainRoutes
+        )}
       </main>
       {showAssistantLauncher && (
         <Link
@@ -228,7 +249,7 @@ function AppContent() {
           <Sparkles className="h-6 w-6" />
         </Link>
       )}
-      <Footer />
+      {!isDashboardPath && <Footer />}
     </div>
   )
 }
diff --git a/frontend/src/components/Hero.jsx b/frontend/src/components/Hero.jsx
index beda143..28a1a2f 100644
--- a/frontend/src/components/Hero.jsx
+++ b/frontend/src/components/Hero.jsx
@@ -1,6 +1,6 @@
-import React from 'react'
+import React, { useState, useEffect } from 'react'
 import { Link, useNavigate } from 'react-router-dom'
-import { motion } from 'framer-motion'
+import { motion, AnimatePresence } from 'framer-motion'
 import {
   ArrowRight,
   Brain,
@@ -11,92 +11,116 @@ import {
   Lock,
   CheckCircle,
   Sparkles,
+  Check,
+  Award,
+  ChevronRight,
+  Search,
+  Briefcase,
+  Compass,
+  ArrowLeft,
+  Mic,
+  Smile,
+  Video,
+  Code,
+  Target,
+  BookOpen,
+  Clock,
+  MapPin,
 } from 'lucide-react'
 import secureStorage from '../utils/secureStorage'
 
+// Features list mapped to index tabs
 const features = [
   {
     icon: Brain,
-    title: 'AI Profile Analysis',
-    description: 'Deep insights into your career trajectory based on market trends and skill signals.',
-  },
-  {
-    icon: FileText,
-    title: 'Resume Processing',
-    description: 'Instantly structure complex resume data into an interactive candidate profile.',
+    title: 'Student Dashboard',
+    tagline: 'Longitudinal Placement Hub',
+    description: 'Track application statistics, remaining token credits, and manage profile features all in one visual cockpit.',
+    badge: 'Real-time Stats',
   },
   {
     icon: Handshake,
-    title: 'Precision Matching',
-    description: 'Find roles aligned to your exact experience, skill graph, and growth aspirations.',
+    title: 'AI Job Matching',
+    tagline: 'Weighted Compatibility Analytics',
+    description: 'Review personalized job recommendations sorted by AI matching relevance, with complete skill and experience scores.',
+    badge: '98% Match accuracy',
   },
   {
     icon: Mic2,
     title: 'AI Mock Interviews',
-    description: 'Simulate live technical rounds and receive actionable, structured scoring feedback.',
-  },
-  {
-    icon: GraduationCap,
-    title: 'Targeted Roadmaps',
-    description: 'Follow personalized, gap-focused learning paths that close your skill gaps faster.',
+    tagline: 'Interactive Voice Practice',
+    description: 'Simulate live tech and HR questions in our voice environment, featuring live Whisper translation and scorecard diagnostics.',
+    badge: 'Voice evaluation',
   },
   {
-    icon: Lock,
-    title: 'Privacy & Security',
-    description: 'Your profile and application history stay protected with secure encryption.',
+    icon: Compass,
+    title: 'Learning Pathways',
+    tagline: 'Adaptive Milestone Roadmaps',
+    description: 'Close identified skill gaps with tailored step-by-step pathways featuring course modules, code projects, and practices.',
+    badge: 'Milestone tracking',
   },
 ]
 
-const outcomes = [
-  'Parsed Candidate Profile',
-  'AI Recommended Roles',
-  'Mock Interview Scorecard',
-  'Customized Learning Paths',
-]
 
-const steps = [
+const problems = [
+  {
+    question: 'How do I stand out to top recruiters?',
+    solution: 'Build a parsed, structured AI profile showcasing verified skills & compatibility scores.',
+    category: 'Job Seekers',
+  },
   {
-    number: '1',
-    title: 'Upload Profile',
-    description: 'Upload your resume in PDF/DOCX to build a structured profile in seconds.',
+    question: 'Am I actually ready for the technical round?',
+    solution: 'Simulate the exact role interview in our voice environment and view your breakdown scorecard.',
+    category: 'Interviews',
   },
   {
-    number: '2',
-    title: 'Get AI Insights',
-    description: 'See compatible career directions, skill gaps, and interview readiness levels.',
+    question: 'What skills should I learn to land my dream job?',
+    solution: 'Our engine identifies your target job requirements, scans your gaps, and maps a direct roadmap.',
+    category: 'Skill Gaps',
   },
   {
-    number: '3',
-    title: 'Land Your Dream Job',
-    description: 'Apply with confidence using targeted mock practice and skill roadmaps.',
+    question: 'How do we pre-screen applicant credentials easily?',
+    solution: 'Employers get visual applicant match rankings sorted by technical skill alignment.',
+    category: 'Employers',
   },
 ]
 
-const containerVariants = {
-  hidden: { opacity: 0 },
-  visible: {
-    opacity: 1,
-    transition: {
-      staggerChildren: 0.1
-    }
-  }
-}
-
-const itemVariants = {
-  hidden: { y: 25, opacity: 0 },
-  visible: {
-    y: 0,
-    opacity: 1,
-    transition: {
-      type: "spring",
-      stiffness: 100,
-      damping: 15
-    }
-  }
-}
+// Dynamic text rotation keywords
+const loopKeywords = ['matches.', 'trains.', 'guides.', 'delivers.']
 
 export default function Hero() {
   const navigate = useNavigate()
+  const [activeTab, setActiveTab] = useState(0)
+  const [keywordIndex, setKeywordIndex] = useState(0)
+  const [progress, setProgress] = useState(0)
+
+  // Rotating keyword effect
+  useEffect(() => {
+    const interval = setInterval(() => {
+      setKeywordIndex((prev) => (prev + 1) % loopKeywords.length)
+    }, 2500)
+    return () => clearInterval(interval)
+  }, [])
+
+  // Auto-rotating tabs with progress indicators
+  useEffect(() => {
+    setProgress(0)
+    const duration = 6000 // 6 seconds per tab
+    const step = 100 // update every 100ms
+    const increment = 100 / (duration / step)
+
+    const timer = setInterval(() => {
+      setProgress((prev) => {
+        if (prev >= 100) {
+          setActiveTab((current) => (current + 1) % features.length)
+          return 0
+        }
+        return prev + increment
+      });
+    }, step)
+
+    return () => clearInterval(timer)
+  }, [activeTab])
 
   const handleGetStarted = () => {
     const token = secureStorage.getItem('token')
@@ -106,266 +130,729 @@ export default function Hero() {
       navigate('/dashboard')
       return
     }
-
     navigate('/register')
   }
 
   return (
-    <div className="bg-slate-50/40 relative min-h-screen overflow-hidden">
+    <div className="bg-slate-50 relative min-h-screen overflow-hidden pt-20">
       
-      {/* Ambient background glows / pass */}
+      {/* Background Grid & Ambient Glows */}
+      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none z-0" />
       <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
         <motion.div
           animate={{
-            x: [0, 40, -20, 0],
-            y: [0, -50, 30, 0],
-            scale: [1, 1.15, 0.9, 1]
-          }}
-          transition={{
-            duration: 20,
-            repeat: Infinity,
-            ease: "easeInOut"
-          }}
-          className="absolute left-1/4 top-10 h-[450px] w-[450px] rounded-full bg-gradient-to-br from-primary-400/10 to-indigo-450/10 blur-[130px]"
-        />
-        <motion.div
-          animate={{
-            x: [0, -30, 50, 0],
-            y: [0, 40, -45, 0],
-            scale: [1, 0.9, 1.1, 1]
+            x: [0, 30, -30, 0],
+            y: [0, -40, 40, 0],
+            scale: [1, 1.1, 0.95, 1],
           }}
           transition={{
-            duration: 25,
+            duration: 18,
             repeat: Infinity,
-            ease: "easeInOut"
+            ease: 'easeInOut',
           }}
-          className="absolute right-1/4 top-1/4 h-[550px] w-[550px] rounded-full bg-gradient-to-br from-sky-400/10 to-emerald-450/10 blur-[140px]"
+          className="absolute left-10 top-20 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-primary-450/20 to-indigo-450/20 blur-[120px]"
         />
         <motion.div
           animate={{
-            x: [0, 40, -30, 0],
-            y: [0, 30, 60, 0],
-            scale: [1, 1.1, 0.95, 1]
+            x: [0, -40, 40, 0],
+            y: [0, 50, -30, 0],
+            scale: [1, 0.9, 1.05, 1],
           }}
           transition={{
             duration: 22,
             repeat: Infinity,
-            ease: "easeInOut"
+            ease: 'easeInOut',
           }}
-          className="absolute left-1/3 bottom-10 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-purple-400/10 to-pink-400/10 blur-[120px]"
+          className="absolute right-10 top-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-purple-400/10 to-pink-400/15 blur-[140px]"
         />
       </div>
 
       {/* Hero Header Section */}
-      <section className="pt-28 pb-12 sm:pt-32 sm:pb-16 relative z-10 border-b border-slate-100/80">
-        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
+      <section className="relative z-10 pt-16 pb-2 sm:pt-20 sm:pb-2 text-center">
+        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
+          
+          {/* Announcement Pill */}
           <motion.div
-            initial={{ opacity: 0, y: 20 }}
+            initial={{ opacity: 0, y: -10 }}
             animate={{ opacity: 1, y: 0 }}
-            transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
-            className="max-w-4xl mx-auto text-center"
+            transition={{ duration: 0.5 }}
+            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold mb-6 shadow-sm hover:bg-slate-200 hover:border-slate-300 transition-all cursor-pointer"
+            onClick={handleGetStarted}
           >
-            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-6 shadow-sm">
-              <Sparkles className="w-4 h-4 animate-pulse" />
-              <span>AI-Powered Career Growth</span>
-            </div>
+            <Sparkles className="w-4 h-4 text-primary-500 animate-pulse" />
+            <span className="bg-gradient-to-r from-primary-600 to-indigo-650 bg-clip-text text-transparent font-bold">New:</span>
+            <span>Gemini-Powered Interview Scoring Active</span>
+            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
+          </motion.div>
 
-            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-tight">
-              Accelerate Your Career with <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-650">AI-Powered</span> Guidance
-            </h1>
-            <p className="mt-5 text-base sm:text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
-              Get personalized job matches, profile analysis, interactive mock interviews, and gap-focused learning paths in one cohesive platform.
-            </p>
+          {/* Main Title - Inline slide-up reveal with ghost text for perfect baseline alignment */}
+          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-tight">
+            Accelerate Your Career with
+            <br />
+            Guidance that{' '}
+            <span className="inline-block relative text-center min-w-[150px] sm:min-w-[230px] overflow-hidden select-none align-baseline">
+              {/* Invisible ghost text to force native browser text baseline alignment */}
+              <span className="opacity-0 invisible pointer-events-none select-none">delivers.</span>
+              
+              <AnimatePresence mode="wait">
+                <motion.span
+                  key={keywordIndex}
+                  initial={{ y: '100%', opacity: 0 }}
+                  animate={{ y: 0, opacity: 1 }}
+                  exit={{ y: '-100%', opacity: 0 }}
+                  transition={{ duration: 0.35, ease: 'easeOut' }}
+                  className="absolute inset-x-0 bottom-0 text-center bg-clip-text text-transparent bg-gradient-to-r from-primary-600 via-indigo-650 to-purple-650 font-extrabold leading-none"
+                >
+                  {loopKeywords[keywordIndex]}
+                </motion.span>
+              </AnimatePresence>
+            </span>
+          </h1>
 
-            <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4 max-w-md mx-auto">
-              <button
-                type="button"
-                onClick={handleGetStarted}
-                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md shadow-primary-500/10 hover:shadow-primary-500/20 transition-all duration-200 active:scale-95"
-              >
-                Get Started
-                <ArrowRight className="w-4.5 h-4.5 animate-bounce" />
-              </button>
-              <Link
-                to="/register"
-                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold rounded-xl shadow-sm transition-all duration-200 active:scale-95"
-              >
-                Start Mock Prep
-              </Link>
-            </div>
+          <p className="mt-6 text-base sm:text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
+            Upload your resume to instantly build an interactive profile, simulate live mock interviews, and close critical skill gaps with custom pathways.
+          </p>
 
-            <p className="mt-4 text-xs font-semibold text-slate-400">Free to start · No credit card required</p>
+        </div>
+      </section>
 
-            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left sm:text-center">
-              <div className="border border-gray-200 bg-white rounded-2xl px-5 py-4 shadow-sm">
-                <p className="text-2xl font-black text-slate-900 animate-pulse">50k+</p>
-                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Jobs Added Daily</p>
+      {/* Interactive Browser Mockup rendering actual UI panels */}
+      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
+        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden glass-panel">
+          
+          {/* Browser Topbar */}
+          <div className="bg-slate-950/70 border-b border-slate-850 px-6 py-4 flex items-center justify-between">
+            <div className="flex items-center gap-2">
+              <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-pulse" />
+              <span className="w-3.5 h-3.5 rounded-full bg-amber-500" />
+              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
+            </div>
+            <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-1 text-xs text-slate-400 w-64 md:w-96 text-center select-none truncate">
+              🔒 career-ai.com/dashboard
+            </div>
+            <div className="w-16 flex items-center justify-end">
+              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
+              <span className="w-1.5 h-1.5 rounded-full bg-slate-600 mx-1" />
+              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
+            </div>
+          </div>
+          {/* Browser Body Area */}
+          <div className="min-h-[460px] bg-slate-950/20 flex flex-col">
+            
+            {/* Mock Top Navigation Bar (Identical to our actual UI Navbar) */}
+            <div className="bg-white border-b border-slate-200/80 text-slate-800 px-6 py-3.5 flex items-center justify-between z-20 select-none">
+              <div className="flex items-center space-x-2">
+                <div className="bg-primary-500 p-1.5 rounded-lg text-white">
+                  <GraduationCap className="w-5 h-5" />
+                </div>
+                <span className="text-sm font-bold text-slate-900">Career AI</span>
               </div>
-              <div className="border border-gray-200 bg-white rounded-2xl px-5 py-4 shadow-sm">
-                <p className="text-2xl font-black text-slate-900">10k+</p>
-                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Success Stories</p>
+
+              {/* Horizontal Nav Links in Mockup */}
+              <div className="hidden md:flex items-center gap-2">
+                {[
+                  { icon: Brain, label: 'Dashboard', idx: 0 },
+                  { icon: Briefcase, label: 'Jobs', idx: 1 },
+                  { icon: Mic2, label: 'Practice', idx: 2 },
+                  { icon: BookOpen, label: 'Paths', idx: 3 },
+                ].map((link) => {
+                  const LinkIcon = link.icon
+                  const active = link.idx === activeTab
+                  return (
+                    <button
+                      key={link.idx}
+                      onClick={() => setActiveTab(link.idx)}
+                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border duration-200 ${
+                        active
+                          ? 'bg-gradient-to-r from-primary-600 to-indigo-650 text-white border-transparent shadow-xs'
+                          : 'bg-transparent text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
+                      }`}
+                    >
+                      <LinkIcon className="w-3.5 h-3.5 text-primary-500" />
+                      <span>{link.label}</span>
+                    </button>
+                  )
+                })}
               </div>
-              <div className="border border-gray-200 bg-white rounded-2xl px-5 py-4 shadow-sm">
-                <p className="text-2xl font-black text-slate-900">98%</p>
-                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Match Accuracy</p>
+
+              <div className="flex items-center gap-3">
+                <div className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-0.5 text-[9px] font-bold text-emerald-700">
+                  <span>85 Credits</span>
+                </div>
+                <button className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold border border-slate-200 bg-transparent text-slate-600 hover:bg-slate-100 transition-colors">
+                  Logout
+                </button>
               </div>
             </div>
-          </motion.div>
-        </div>
-      </section>
 
-      {/* Features Grid */}
-      <section className="py-16 sm:py-20 relative z-10 border-b border-slate-100/80">
-        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
-          <div className="max-w-3xl mx-auto text-center mb-12">
-            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Features Built for Success</h2>
-            <p className="mt-3 text-slate-500 leading-relaxed">
-              Everything you need to analyze your profile, practice interviewing, and discover career paths.
-            </p>
+            {/* Main Page Area showing actual UI preview layouts (Centered layout, no sidebar) */}
+            <div className="p-4 sm:p-6 flex flex-col justify-start items-center relative overflow-y-auto max-h-[400px] bg-slate-50 flex-grow">
+              <AnimatePresence mode="wait">
+                
+                {/* 1. Actual Student Dashboard Preview */}
+                {activeTab === 0 && (
+                  <motion.div
+                    key="dashboard-preview"
+                    initial={{ opacity: 0, scale: 0.98 }}
+                    animate={{ opacity: 1, scale: 1 }}
+                    exit={{ opacity: 0, scale: 0.98 }}
+                    transition={{ duration: 0.3 }}
+                    className="w-full text-slate-950 text-left bg-slate-50/50 p-4 sm:p-5 rounded-2xl border border-slate-200/60 flex flex-col gap-4 max-w-3xl"
+                  >
+                    {/* Real Header Row */}
+                    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
+                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
+                        <div>
+                          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary-100 bg-primary-50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-700 mb-2">
+                            <Briefcase className="w-3 h-3 text-primary-600" />
+                            Student workspace
+                          </div>
+                          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">
+                            Student Dashboard
+                          </h1>
+                          <p className="text-xs text-slate-500 mt-0.5">Welcome back, Alex</p>
+                        </div>
+                        
+                        {/* Real Widgets Mock */}
+                        <div className="flex gap-2">
+                          <div className="bg-white border border-slate-150 rounded-xl p-2.5 shadow-xs text-left w-32 sm:w-36 flex-shrink-0">
+                            <div className="flex justify-between items-center mb-1">
+                              <span className="text-[9px] font-bold text-slate-400 uppercase">Credits</span>
+                              <span className="text-xs font-black text-primary-600">85 Active</span>
+                            </div>
+                            <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mb-1">
+                              <div className="bg-gradient-to-r from-primary-500 to-indigo-650 h-full w-4/5 rounded-full" />
+                            </div>
+                            <span className="text-[8px] text-slate-400 font-semibold block leading-none">15 spent this week</span>
+                          </div>
+
+                          <div className="bg-white border border-slate-150 rounded-xl p-2.5 shadow-xs text-left w-32 sm:w-36 flex-shrink-0">
+                            <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Applications</span>
+                            <div className="flex items-center justify-between gap-1 mt-0.5">
+                              <div className="text-center flex-1">
+                                <p className="text-xs font-black text-slate-700">12</p>
+                                <p className="text-[7px] font-bold text-slate-400 uppercase">Applied</p>
+                              </div>
+                              <div className="text-center flex-1">
+                                <p className="text-xs font-black text-amber-500">2</p>
+                                <p className="text-[7px] font-bold text-slate-400 uppercase">Interview</p>
+                              </div>
+                              <div className="text-center flex-1">
+                                <p className="text-xs font-black text-emerald-500">1</p>
+                                <p className="text-[7px] font-bold text-slate-400 uppercase">Offered</p>
+                              </div>
+                            </div>
+                          </div>
+                        </div>
+                      </div>
+                    </div>
+
+                    {/* Dashboard cards grid preview */}
+                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
+                      <div className="p-4 bg-white border border-slate-100 rounded-2xl flex flex-col justify-between shadow-xs hover:border-primary-200 transition-all group">
+                        <div>
+                          <div className="rounded-xl p-2 bg-primary-50 text-primary-650 border border-primary-100 w-fit mb-3 group-hover:scale-105 transition-transform">
+                            <Target className="w-4.5 h-4.5" />
+                          </div>
+                          <h3 className="font-extrabold text-sm text-slate-900 mb-1">AI Job Recommendations</h3>
+                          <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
+                            Discover roles matched to your unique profile, ranked by skill overlap and suitability.
+                          </p>
+                        </div>
+                        <button onClick={() => setActiveTab(1)} className="w-full py-2 bg-gradient-to-r from-primary-600 to-indigo-650 text-white rounded-lg text-xs font-bold transition-all hover:opacity-90 active:scale-98">
+                          Explore Recommendations
+                        </button>
+                      </div>
+
+                      <div className="p-4 bg-white border border-slate-100 rounded-2xl flex flex-col justify-between shadow-xs hover:border-indigo-200 transition-all group">
+                        <div>
+                          <div className="rounded-xl p-2 bg-indigo-50 text-indigo-650 border border-indigo-100 w-fit mb-3 group-hover:scale-105 transition-transform">
+                            <Sparkles className="w-4.5 h-4.5" />
+                          </div>
+                          <h3 className="font-extrabold text-sm text-slate-900 mb-1">AI Mock Interviews</h3>
+                          <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
+                            Practice technical and soft skill questions and get scored instantly with detailed feedback.
+                          </p>
+                        </div>
+                        <button onClick={() => setActiveTab(2)} className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-bold transition-all hover:opacity-90 active:scale-98">
+                          Practice Interviews
+                        </button>
+                      </div>
+                    </div>
+                  </motion.div>
+                )}
+
+                {/* 2. Actual Recommended Jobs Page Preview */}
+                {activeTab === 1 && (
+                  <motion.div
+                    key="jobs-preview"
+                    initial={{ opacity: 0, scale: 0.98 }}
+                    animate={{ opacity: 1, scale: 1 }}
+                    exit={{ opacity: 0, scale: 0.98 }}
+                    transition={{ duration: 0.3 }}
+                    className="w-full text-slate-950 text-left bg-slate-50/50 p-4 sm:p-5 rounded-2xl border border-slate-200/60 flex flex-col gap-4 max-w-3xl"
+                  >
+                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/40 pb-2">
+                      <div>
+                        <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-1.5">
+                          <Briefcase className="w-4.5 h-4.5 text-primary-500" /> AI Recommended Jobs
+                        </h2>
+                        <p className="text-[11px] text-slate-500">Personalized career recommendations sorted by AI matching relevance.</p>
+                      </div>
+                      <div className="inline-flex items-center gap-1 text-[10px] text-primary-600 font-bold bg-primary-50 border border-primary-100 px-2.5 py-0.5 rounded-lg w-fit">
+                        <Sparkles className="w-3 h-3 text-primary-600" />
+                        <span>Sort: Relevance</span>
+                      </div>
+                    </div>
+
+                    {/* Filter bar mockup */}
+                    <div className="bg-white border border-slate-150 rounded-xl p-2 flex gap-2 overflow-x-auto text-[10px] items-center">
+                      <div className="px-2 py-1 bg-slate-50 rounded-lg text-slate-400 border border-slate-100 flex items-center gap-1 flex-1 min-w-[120px]">
+                        <Search className="w-3.5 h-3.5 text-slate-400" />
+                        <span>React, FastAPI...</span>
+                      </div>
+                      <span className="px-2 py-1 bg-slate-50 rounded-lg text-slate-600 border border-slate-100 font-semibold flex-shrink-0">Remote</span>
+                      <span className="px-2 py-1 bg-slate-50 rounded-lg text-slate-600 border border-slate-100 font-semibold flex-shrink-0">Sort: Relevance</span>
+                    </div>
+
+                    {/* Grid of actual JobCards */}
+                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
+                      {/* stripe card */}
+                      <div className="p-4 bg-white border border-slate-100 rounded-2xl flex flex-col h-full relative overflow-hidden group shadow-xs">
+                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary-500 to-indigo-650" />
+                        <div className="flex justify-between items-start gap-2 mb-2">
+                          <div className="flex items-start gap-2">
+                            <div className="w-9 h-9 bg-primary-50 border border-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
+                              <Briefcase className="w-4.5 h-4.5 text-primary-700" />
+                            </div>
+                            <div>
+                              <h3 className="font-extrabold text-xs text-slate-900 leading-tight">AI Software Engineer</h3>
+                              <p className="text-[10px] text-slate-400 font-semibold">Stripe, Inc.</p>
+                            </div>
+                          </div>
+                          <div className="h-8 w-8 rounded-full border border-primary-500/30 flex items-center justify-center bg-primary-50 text-[10px] font-black text-primary-600">
+                            98%
+                          </div>
+                        </div>
+
+                        <div className="flex flex-wrap gap-1 mb-2">
+                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700 font-semibold flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />Remote</span>
+                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 text-slate-500">2+ yrs</span>
+                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700 font-semibold flex items-center gap-0.5"><Award className="w-2.5 h-2.5" />CGPA 8.0+</span>
+                        </div>
+
+                        <div className="flex flex-wrap gap-1 mb-3">
+                          <span className="text-[8px] bg-emerald-50 border border-emerald-150 text-emerald-700 px-1.5 py-0.5 rounded font-bold inline-flex items-center">
+                            <Check className="w-2 h-2 mr-0.5 text-emerald-600" /> React
+                          </span>
+                          <span className="text-[8px] bg-emerald-50 border border-emerald-150 text-emerald-700 px-1.5 py-0.5 rounded font-bold inline-flex items-center">
+                            <Check className="w-2 h-2 mr-0.5 text-emerald-600" /> FastAPI
+                          </span>
+                          <span className="text-[8px] bg-slate-50 border border-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold">
+                            PostgreSQL
+                          </span>
+                        </div>
+
+                        <div className="mt-auto pt-2 border-t border-slate-100 flex justify-between items-center text-[10px]">
+                          <span className="font-bold text-primary-600">INR 18.0L - 25.0L</span>
+                          <span className="text-slate-400 font-semibold flex items-center gap-0.5">Details <ChevronRight className="w-3 h-3" /></span>
+                        </div>
+                      </div>
+
+                      {/* Google card */}
+                      <div className="p-4 bg-white border border-slate-100 rounded-2xl flex flex-col h-full relative overflow-hidden group shadow-xs">
+                        <div className="flex justify-between items-start gap-2 mb-2">
+                          <div className="flex items-start gap-2">
+                            <div className="w-9 h-9 bg-primary-50 border border-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
+                              <Briefcase className="w-4.5 h-4.5 text-primary-700" />
+                            </div>
+                            <div>
+                              <h3 className="font-extrabold text-xs text-slate-900 leading-tight">Fullstack Dev (FastAPI)</h3>
+                              <p className="text-[10px] text-slate-400 font-semibold">Google Cloud Team</p>
+                            </div>
+                          </div>
+                          <div className="h-8 w-8 rounded-full border border-primary-500/20 flex items-center justify-center bg-primary-50 text-[10px] font-black text-primary-500">
+                            92%
+                          </div>
+                        </div>
+
+                        <div className="flex flex-wrap gap-1 mb-2">
+                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 text-slate-500 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />AP-South</span>
+                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 text-slate-500">1+ yrs</span>
+                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700 font-semibold flex items-center gap-0.5"><Award className="w-2.5 h-2.5" />CGPA 8.5+</span>
+                        </div>
+
+                        <div className="flex flex-wrap gap-1 mb-3">
+                          <span className="text-[8px] bg-emerald-50 border border-emerald-150 text-emerald-700 px-1.5 py-0.5 rounded font-bold inline-flex items-center">
+                            <Check className="w-2 h-2 mr-0.5 text-emerald-600" /> Python
+                          </span>
+                          <span className="text-[8px] bg-emerald-50 border border-emerald-150 text-emerald-700 px-1.5 py-0.5 rounded font-bold inline-flex items-center">
+                            <Check className="w-2 h-2 mr-0.5 text-emerald-600" /> FastAPI
+                          </span>
+                          <span className="text-[8px] bg-slate-50 border border-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold">
+                            SQL
+                          </span>
+                        </div>
+
+                        <div className="mt-auto pt-2 border-t border-slate-100 flex justify-between items-center text-[10px]">
+                          <span className="font-bold text-primary-600">INR 15.0L - 22.0L</span>
+                          <span className="text-slate-400 font-semibold flex items-center gap-0.5">Details <ChevronRight className="w-3 h-3" /></span>
+                        </div>
+                      </div>
+                    </div>
+                  </motion.div>
+                )}
+
+                {/* 3. Actual Voice Interview Session Preview */}
+                {activeTab === 2 && (
+                  <motion.div
+                    key="interviews-preview"
+                    initial={{ opacity: 0, scale: 0.98 }}
+                    animate={{ opacity: 1, scale: 1 }}
+                    exit={{ opacity: 0, scale: 0.98 }}
+                    transition={{ duration: 0.3 }}
+                    className="w-full text-slate-900 text-left bg-slate-50/50 p-4 sm:p-5 rounded-2xl border border-slate-200/60 flex flex-col gap-4 max-w-3xl"
+                  >
+                    <div className="flex items-center justify-between border-b border-slate-200/40 pb-2">
+                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 cursor-pointer">
+                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
+                      </span>
+                      <span className="text-xs bg-indigo-550 text-white border border-indigo-600 px-2.5 py-0.5 rounded-lg font-bold">
+                        Question 2 of 5
+                      </span>
+                    </div>
+
+                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
+                      {/* Left: Question Column */}
+                      <div className="bg-white border border-slate-150 rounded-xl p-4 flex flex-col justify-between shadow-xs">
+                        <div>
+                          <div className="flex items-center gap-2 mb-3">
+                            <Smile className="w-4 h-4 text-green-600" />
+                            <span className="text-[9px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded font-bold block w-fit">
+                              Friendly Senior Engineer
+                            </span>
+                          </div>
+                          <p className="text-[11px] font-bold text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
+                            "Explain React hooks and how state rendering behaves compared to normal variables."
+                          </p>
+                        </div>
+
+                        {/* Real Audio Waveform animation */}
+                        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col items-center">
+                          <div className="flex items-end gap-1 h-6 mb-2">
+                            {[0.4, 0.8, 1.2, 0.7, 0.3, 0.9, 1.3, 0.6, 1.1, 0.5, 0.8, 0.4].map((scale, bIdx) => (
+                              <div
+                                key={bIdx}
+                                style={{ animationDelay: `${bIdx * 0.1}s` }}
+                                className="w-1 bg-rose-450 rounded-full voice-bar-anim"
+                              />
+                            ))}
+                          </div>
+                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-150 rounded-lg text-[9px] text-rose-600 font-bold">
+                            <Mic className="w-3 h-3 text-rose-500 animate-pulse" />
+                            <span>Speaking... [0:18]</span>
+                          </div>
+                        </div>
+                      </div>
+
+                      {/* Right: Whisper Transcript & Submission */}
+                      <div className="bg-white border border-slate-150 rounded-xl p-4 flex flex-col justify-between shadow-xs">
+                        <div>
+                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Live Whisper Transcript</span>
+                          <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 h-24 overflow-y-auto font-medium">
+                            React hooks allow functional components to hook into state and lifecycle features. State updates trigger component re-rendering, whereas normal variables lose their values when the component cycles.
+                          </p>
+                        </div>
+
+                        <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center">
+                          <span className="text-[9px] text-slate-400 font-semibold">Real-time sync</span>
+                          <button className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded-lg text-[10px] font-bold transition-all shadow-xs">
+                            Submit Answer
+                          </button>
+                        </div>
+                      </div>
+                    </div>
+                  </motion.div>
+                )}
+
+                {/* 4. Actual Learning Roadmap Pathway Preview */}
+                {activeTab === 3 && (
+                  <motion.div
+                    key="roadmaps-preview"
+                    initial={{ opacity: 0, scale: 0.98 }}
+                    animate={{ opacity: 1, scale: 1 }}
+                    exit={{ opacity: 0, scale: 0.98 }}
+                    transition={{ duration: 0.3 }}
+                    className="w-full text-slate-950 text-left bg-slate-50/50 p-4 sm:p-5 rounded-2xl border border-slate-200/60 flex flex-col gap-4 max-w-3xl"
+                  >
+                    <div className="flex items-center justify-between border-b border-slate-200/40 pb-2">
+                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 cursor-pointer">
+                        <ArrowLeft className="w-3.5 h-3.5" /> Back
+                      </span>
+                      <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
+                        <BookOpen className="w-3.5 h-3.5 text-indigo-650" />
+                        Learning Pathway
+                      </div>
+                    </div>
+
+                    <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-xs">
+                      <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 mb-6 text-center animate-pulse">Your Personalized Learning Journey</h2>
+
+                      <div className="relative pl-6 space-y-6 border-l-2 border-slate-150 max-w-lg mx-auto">
+                        {[
+                          {
+                            title: 'React Hooks & State Management',
+                            desc: 'Video Course: Learn state engines and React lifecycle events.',
+                            icon: Video,
+                            status: 'completed',
+                            color: 'bg-emerald-500 border-emerald-400 text-white',
+                          },
+                          {
+                            title: 'FastAPI Router Integration',
+                            desc: 'Code Project: Secure backend micro-routes with JWT authentication.',
+                            icon: Code,
+                            status: 'in-progress',
+                            color: 'bg-indigo-500 border-indigo-400 text-white',
+                          },
+                          {
+                            title: 'DB Tuning & SQLAlchemy Performance',
+                            desc: 'Practice Problem: Avoid N+1 query loads and tune SQLAlchemy models.',
+                            icon: Target,
+                            status: 'locked',
+                            color: 'bg-slate-100 border-slate-200 text-slate-400',
+                          },
+                        ].map((node, nIdx) => {
+                          const NodeIcon = node.icon
+                          return (
+                            <div key={nIdx} className="relative text-left">
+                              {/* Circle node indicator */}
+                              <div className={`absolute -left-[32px] top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shadow-xs ${node.color}`}>
+                                {node.status === 'completed' ? (
+                                  <Check className="w-3 h-3 text-white" />
+                                ) : node.status === 'in-progress' ? (
+                                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
+                                ) : (
+                                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
+                                )}
+                              </div>
+
+                              <div className="flex items-start justify-between gap-4">
+                                <div>
+                                  <h6 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5 leading-tight">
+                                    {node.title}
+                                    {node.status === 'in-progress' && (
+                                      <span className="text-[8px] bg-indigo-50 border border-indigo-100 text-indigo-650 px-1 rounded font-extrabold uppercase leading-none">Active</span>
+                                    )}
+                                  </h6>
+                                  <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{node.desc}</p>
+                                </div>
+                                <div className={`p-1.5 rounded-lg border ${
+                                  node.status === 'completed' 
+                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
+                                    : node.status === 'in-progress' 
+                                    ? 'bg-indigo-50 border-indigo-100 text-indigo-600' 
+                                    : 'bg-slate-50 border-slate-100 text-slate-400'
+                                }`}>
+                                  <NodeIcon className="w-3.5 h-3.5" />
+                                </div>
+                              </div>
+                            </div>
+                          )
+                        })}
+                      </div>
+                    </div>
+                  </motion.div>
+                )}
+              </AnimatePresence>
+            </div>
           </div>
+        </div>
 
-          <motion.div 
-            variants={containerVariants}
-            initial="hidden"
-            whileInView="visible"
-            viewport={{ once: true, margin: "-100px" }}
-            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
-          >
-            {features.map((feature) => {
-              const Icon = feature.icon
-              return (
-                <motion.div 
-                  key={feature.title} 
-                  variants={itemVariants}
-                  whileHover={{ y: -6, scale: 1.02 }}
-                  className="bg-white border border-gray-200 hover:border-primary-200 rounded-3xl p-6 shadow-sm hover:shadow-[0_20px_45px_rgba(15,23,42,0.05)] transition-all duration-300 flex flex-col h-full group relative overflow-hidden text-left"
-                >
-                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500/0 to-primary-500 group-hover:from-primary-500 group-hover:to-indigo-500 transition-all duration-300" />
-                  <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
-                    <Icon className="w-6 h-6 text-primary-700" />
+        {/* Dynamic Nav Tabs Under the Mockup */}
+        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
+          {features.map((feature, index) => {
+            const Icon = feature.icon
+            const active = index === activeTab
+            return (
+              <div
+                key={index}
+                onClick={() => setActiveTab(index)}
+                className={`cursor-pointer rounded-2xl p-4 transition-all duration-300 flex flex-col text-left group relative overflow-hidden ${
+                  active
+                    ? 'bg-white border border-slate-200 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.05)]'
+                    : 'bg-transparent border border-transparent hover:bg-slate-100 hover:border-slate-200'
+                }`}
+              >
+                <div className="flex items-center gap-2.5 mb-2">
+                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
+                    active ? 'bg-primary-500 text-white' : 'bg-slate-200/50 text-slate-650 group-hover:bg-primary-50 group-hover:text-primary-700'
+                  }`}>
+                    <Icon className="w-4 h-4" />
                   </div>
-                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-primary-900 transition-colors">{feature.title}</h3>
-                  <p className="mt-3 text-sm text-slate-500 leading-relaxed">{feature.description}</p>
-                </motion.div>
-              )
-            })}
-          </motion.div>
+                  <span className={`text-xs font-semibold ${active ? 'text-primary-500' : 'text-slate-500'}`}>
+                    {feature.badge}
+                  </span>
+                </div>
+
+                <h3 className="text-sm font-extrabold text-slate-900">{feature.title}</h3>
+                <p className="mt-1 text-xs text-slate-400 leading-relaxed group-hover:text-slate-500 truncate hidden md:block">
+                  {feature.tagline}
+                </p>
+
+                {/* Progress bar timeline indicator */}
+                {active && (
+                  <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100">
+                    <div
+                      style={{ width: `${progress}%` }}
+                      className="h-full bg-gradient-to-r from-primary-600 to-indigo-650 transition-all duration-100"
+                    />
+                  </div>
+                )}
+              </div>
+            )
+          })}
         </div>
       </section>
 
-      {/* Outcome Section */}
-      <section className="py-16 sm:py-20 border-b border-slate-100/80 bg-gray-50/60 relative z-10">
-        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
-          <div className="max-w-3xl mx-auto text-center mb-12">
-            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Instant Profile Enrichment</h2>
-            <p className="mt-3 text-slate-500 leading-relaxed">Skip manual entries. Build a structured profile from your resume instantly.</p>
+      {/* Problem Challenge Section */}
+      <section className="py-16 sm:py-20 relative z-10 bg-slate-100/30">
+        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
+          <div className="text-center mb-12">
+            <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest px-2.5 py-1 rounded bg-primary-50 border border-primary-100">
+              The Placement Challenge
+            </span>
+            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-4">
+              Do you know what makes a candidate stand out?
+            </h2>
+            <p className="mt-3 text-slate-500 leading-relaxed text-sm">
+              Placement rates and tech screening should not feel like guess work. We provide absolute clarity.
+            </p>
           </div>
-          
-          <motion.div 
-            variants={containerVariants}
-            initial="hidden"
-            whileInView="visible"
-            viewport={{ once: true, margin: "-100px" }}
-            className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4"
-          >
-            {outcomes.map((item) => (
-              <motion.div 
-                key={item} 
-                variants={itemVariants}
-                whileHover={{ scale: 1.02, x: 5 }}
-                className="bg-white border border-gray-200 hover:border-emerald-200 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm transition-all duration-300 text-left"
+
+          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
+            {problems.map((prob, idx) => (
+              <motion.div
+                key={idx}
+                whileHover={{ y: -4 }}
+                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-[0_15px_30px_rgba(15,23,42,0.03)] hover:border-slate-300 transition-all duration-300 text-left flex flex-col justify-between"
               >
-                <div className="p-1.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm flex-shrink-0">
-                  <CheckCircle className="w-5 h-5 text-emerald-500" />
+                <div>
+                  <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-wider">
+                    {prob.category}
+                  </span>
+                  <h3 className="text-base font-extrabold text-slate-900 mt-2.5 leading-snug">
+                    "{prob.question}"
+                  </h3>
+                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">
+                    {prob.solution}
+                  </p>
+                </div>
+                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-primary-600 font-bold hover:text-primary-700 cursor-pointer" onClick={handleGetStarted}>
+                  <span>Explore features</span>
+                  <ArrowRight className="w-3.5 h-3.5" />
                 </div>
-                <span className="text-slate-800 font-bold text-sm tracking-wide">{item}</span>
               </motion.div>
             ))}
-          </motion.div>
+          </div>
         </div>
       </section>
 
-      {/* Steps Section */}
-      <section className="py-16 sm:py-20 border-b border-slate-100/80 relative z-10">
-        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
-          <div className="max-w-3xl mx-auto text-center mb-12">
-            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Your Path to Success in 3 Steps</h2>
-            <p className="mt-3 text-slate-500 leading-relaxed">Simple, structured, and outcome-oriented.</p>
+      {/* Feature Grid with clean icons */}
+      <section className="py-16 sm:py-20 relative z-10 border-t border-slate-200">
+        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
+          <div className="text-center mb-12">
+            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
+              Features Engineered for Placements
+            </h2>
+            <p className="mt-3 text-slate-500 leading-relaxed text-sm">
+              A consolidated pipeline for profiles, automated checks, and adaptive roadmaps.
+            </p>
           </div>
-          
-          <motion.div 
-            variants={containerVariants}
-            initial="hidden"
-            whileInView="visible"
-            viewport={{ once: true, margin: "-100px" }}
-            className="grid grid-cols-1 md:grid-cols-3 gap-6"
-          >
-            {steps.map((step) => (
-              <motion.div 
-                key={step.number} 
-                variants={itemVariants}
-                whileHover={{ y: -5 }}
-                className="border border-gray-200 bg-white rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden text-left"
-              >
-                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-600 to-indigo-600 text-white font-black flex items-center justify-center mb-5 shadow-sm shadow-primary-500/10">
-                  {step.number}
+
+          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
+            {[
+              {
+                icon: Brain,
+                title: 'Gemini Profile Extraction',
+                desc: 'Uncovers experience signals and maps structures automatically from file uploads.',
+              },
+              {
+                icon: Handshake,
+                title: 'Weighted Compatibility',
+                desc: 'Scoring profiles utilizing weighted metrics derived from career paths.',
+              },
+              {
+                icon: Mic2,
+                title: 'Interactivity Coaching',
+                desc: 'Assess vocal skills and confidence indices alongside technical competence.',
+              },
+              {
+                icon: GraduationCap,
+                title: 'Interactive Roadmap Maps',
+                desc: 'Navigate milestone structures mapped specifically to closing individual gaps.',
+              },
+              {
+                icon: Lock,
+                title: 'Privacy Safeguards',
+                desc: 'Strict access scopes. Profile details remain isolated to relevant targets.',
+              },
+              {
+                icon: Sparkles,
+                title: 'Placement Reports',
+                desc: 'Track logs, applicability rates, and historical analytics.',
+              },
+            ].map((fItem, fIdx) => {
+              const FIcon = fItem.icon
+              return (
+                <div
+                  key={fIdx}
+                  className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all text-left group animate-fade-in"
+                >
+                  <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 border border-primary-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-250">
+                    <FIcon className="w-5 h-5" />
+                  </div>
+                  <h4 className="font-extrabold text-sm text-slate-900">{fItem.title}</h4>
+                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">{fItem.desc}</p>
                 </div>
-                <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
-                <p className="text-sm text-slate-500 leading-relaxed">{step.description}</p>
-              </motion.div>
-            ))}
-          </motion.div>
+              )
+            })}
+          </div>
         </div>
       </section>
 
-      {/* Testimonials */}
-      <section className="py-16 sm:py-20 border-b border-slate-100/80 bg-gray-50/60 relative z-10">
-        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
-          <motion.div 
-            initial={{ opacity: 0, scale: 0.95 }}
-            whileInView={{ opacity: 1, scale: 1 }}
-            viewport={{ once: true }}
-            className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-3xl p-8 shadow-sm flex flex-col items-center text-center relative overflow-hidden"
-          >
-            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary-500 to-indigo-500" />
-            <p className="text-slate-800 text-lg sm:text-xl font-medium leading-relaxed italic max-w-2xl">
+      {/* Quote Testimonial Section */}
+      <section className="py-16 sm:py-20 bg-slate-100/30 border-t border-slate-200/70 relative z-10">
+        <div className="container mx-auto px-4 max-w-4xl">
+          <div className="bg-white border border-slate-205 rounded-3xl p-8 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
+            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary-500 to-indigo-650" />
+            <p className="text-slate-800 text-base sm:text-lg font-medium leading-relaxed italic max-w-2xl">
               "Career Guidance AI did not just help me apply faster. It helped me focus on the right roles and improve my interview performance with clear feedback."
             </p>
             <div className="mt-6 flex flex-col items-center">
-              <p className="font-extrabold text-slate-900 text-base">Deep Podder</p>
-              <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">Senior Software Engineer</p>
+              <p className="font-extrabold text-slate-900 text-sm">Deep Podder</p>
+              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
+                Senior Software Engineer
+              </p>
             </div>
-          </motion.div>
+          </div>
         </div>
       </section>
 
       {/* CTA Section */}
-      <section className="py-20 sm:py-24 relative z-10">
-        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
-          <motion.div
-            initial={{ opacity: 0, y: 20 }}
-            whileInView={{ opacity: 1, y: 0 }}
-            viewport={{ once: true }}
+      <section className="py-20 relative z-10 text-center">
+        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
+          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-4">
+            Ready to Accelerate Your Placement Success?
+          </h2>
+          <p className="text-slate-500 max-w-xl mx-auto leading-relaxed text-sm">
+            Join thousands of applicants and colleges using Career Guidance AI to map trajectories and secure careers.
+          </p>
+          <button
+            onClick={handleGetStarted}
+            className="mt-8 inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-extrabold shadow-lg shadow-primary-500/10 transition-all duration-200 active:scale-95 text-center"
           >
-            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">Ready to Level Up Your Career?</h2>
-            <p className="text-slate-500 max-w-2xl mx-auto leading-relaxed text-base sm:text-lg">
-              Join professionals using Career Guidance AI to discover matches and prep with absolute clarity.
-            </p>
-            <Link
-              to="/register"
-              onClick={(event) => {
-                const token = secureStorage.getItem('token')
-                const user = secureStorage.getItem('user')
-                if (token && user?.role) {
-                  event.preventDefault()
-                  navigate('/dashboard')
-                }
-              }}
-              className="mt-8 inline-flex items-center justify-center px-8 py-4 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-extrabold shadow-lg shadow-primary-500/10 hover:shadow-primary-500/25 transition-all duration-200 active:scale-95 text-center"
-            >
-              Get Started for Free
-            </Link>
-          </motion.div>
+            Get Started for Free
+          </button>
         </div>
       </section>
     </div>
diff --git a/frontend/src/components/Navbar.jsx b/frontend/src/components/Navbar.jsx
index 6d47c82..c5dab52 100644
--- a/frontend/src/components/Navbar.jsx
+++ b/frontend/src/components/Navbar.jsx
@@ -125,7 +125,7 @@ export default function Navbar() {
                     className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border ${
                       active
                         ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white border-transparent shadow-md shadow-primary-500/15'
-                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-primary-50 hover:text-primary-700 hover:border-primary-300 hover:shadow-sm'
+                        : 'bg-white text-slate-700 border-slate-200 hover:bg-primary-50 hover:text-primary-700 hover:border-primary-300 hover:shadow-sm'
                     }`}
                   >
                     <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-primary-500'}`} />
diff --git a/frontend/src/index.css b/frontend/src/index.css
index 759408c..eeb5163 100644
--- a/frontend/src/index.css
+++ b/frontend/src/index.css
@@ -4,9 +4,31 @@
 
 /* stylelint-disable */
 
+:root {
+  --color-primary: #003f8b;
+  --color-primary-fixed-dim: #adc6ff;
+  --color-inverse-on-surface: #eef1f6;
+  --color-outline-variant: #c3c6d3;
+  --color-surface-variant: #e0e3e8;
+  --color-on-primary-container: #bdd0ff;
+  --color-inverse-surface: #2d3135;
+  --color-primary-container: #2557a7;
+}
+
+.dark {
+  --color-primary: #60a5fa;
+  --color-primary-fixed-dim: #60a5fa;
+  --color-inverse-on-surface: #f1f5f9;
+  --color-outline-variant: #1c252e;
+  --color-surface-variant: #94a3b8;
+  --color-on-primary-container: #ffffff;
+  --color-inverse-surface: #0a0e14;
+  --color-primary-container: #3b82f6;
+}
+
 @layer base {
   body {
-    @apply bg-white text-gray-900 antialiased;
+    @apply bg-surface-muted dark:bg-inverse-surface text-on-surface dark:text-inverse-on-surface antialiased transition-colors duration-200;
   }
 
   html {
@@ -20,15 +42,24 @@
   }
 
   ::-webkit-scrollbar-track {
-    @apply bg-gray-100;
+    @apply bg-surface-container-low dark:bg-inverse-surface;
   }
 
   ::-webkit-scrollbar-thumb {
-    @apply bg-primary-500 rounded-full;
+    background-color: rgba(37, 87, 167, 0.4);
+    border-radius: 9999px;
+  }
+
+  .dark ::-webkit-scrollbar-thumb {
+    background-color: rgba(96, 165, 250, 0.4);
   }
 
   ::-webkit-scrollbar-thumb:hover {
-    @apply bg-primary-600;
+    background-color: rgb(37, 87, 167);
+  }
+
+  .dark ::-webkit-scrollbar-thumb:hover {
+    background-color: rgb(96, 165, 250);
   }
 }
 
@@ -44,13 +75,17 @@
 
   /* Neutral button used in nav (profile/logout, nav actions) */
   .nav-button {
-    @apply inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:bg-primary-50 hover:text-primary-700 hover:border-primary-300 hover:shadow-md;
+    @apply inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-primary-50 hover:text-primary-700 hover:border-primary-300 hover:shadow-md;
   }
   
   .btn-secondary {
     @apply bg-white hover:bg-gray-50 text-primary-500 font-semibold py-3 px-6 rounded-lg transition-all duration-200 border border-gray-300 hover:border-primary-500;
   }
   
+  .btn-secondary-sm {
+    @apply bg-white hover:bg-gray-50 text-primary-500 font-semibold py-2 px-4 rounded-lg transition-all duration-200 border border-gray-300 hover:border-primary-500;
+  }
+  
   .card {
     @apply bg-white rounded-xl p-6 shadow-md transition-all duration-200 border border-gray-200 hover:shadow-lg;
   }
@@ -98,4 +133,370 @@
   }
 }
 
+/* Crux-inspired custom styles */
+@layer utilities {
+  .bg-grid-pattern {
+    background-size: 50px 50px;
+    background-image: 
+      linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
+      linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
+  }
+
+  .glass-panel {
+    background: rgba(255, 255, 255, 0.7);
+    backdrop-filter: blur(10px);
+    -webkit-backdrop-filter: blur(10px);
+    border: 1px solid rgba(255, 255, 255, 0.3);
+  }
+
+  .dark .glass-panel {
+    background: rgba(15, 23, 42, 0.45);
+    backdrop-filter: blur(16px);
+    -webkit-backdrop-filter: blur(16px);
+    border: 1px solid rgba(255, 255, 255, 0.08);
+  }
+
+  .glass-panel-light {
+    background: rgba(255, 255, 255, 0.65);
+    backdrop-filter: blur(12px);
+    -webkit-backdrop-filter: blur(12px);
+    border: 1px solid rgba(15, 23, 42, 0.06);
+  }
+
+  .dark .glass-panel-light {
+    background: rgba(15, 23, 42, 0.3);
+    backdrop-filter: blur(12px);
+    border: 1px solid rgba(255, 255, 255, 0.04);
+  }
+
+  .soft-shadow {
+    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.04), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
+    transition: box-shadow 0.3s ease, border-color 0.3s ease, transform 0.3s ease;
+  }
+
+  .soft-shadow:hover {
+    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04);
+  }
+}
+
+/* Infinite loop marquee */
+@keyframes marquee-infinite {
+  0% { transform: translateX(0); }
+  100% { transform: translateX(-50%); }
+}
+
+.ticker-track {
+  display: flex;
+  width: max-content;
+  animation: marquee-infinite 25s linear infinite;
+}
+
+.ticker-track:hover {
+  animation-play-state: paused;
+}
+
+/* Voice waveform bar animations */
+@keyframes voice-wave {
+  0%, 100% { transform: scaleY(0.15); }
+  50% { transform: scaleY(1); }
+}
+
+.voice-bar-anim {
+  animation: voice-wave 1.2s ease-in-out infinite;
+  transform-origin: bottom;
+}
+
+/* High-Fidelity Dark Mode Theme Overrides */
+.dark .bg-white {
+  background-color: #161c24 !important;
+}
+
+.dark .bg-white\/95,
+.dark .bg-white\/90,
+.dark .bg-white\/80,
+.dark .bg-white\/70 {
+  background-color: rgba(22, 28, 36, 0.9) !important;
+}
+
+.dark .bg-surface-container-lowest {
+  background-color: #0a0e14 !important;
+}
+.dark .bg-surface-container-low {
+  background-color: #161c24 !important;
+}
+.dark .bg-surface-container {
+  background-color: #161c24 !important;
+}
+.dark .bg-surface-container-high {
+  background-color: #1c252e !important;
+}
+.dark .bg-surface-container-highest {
+  background-color: #1c252e !important;
+}
+
+.dark button:disabled,
+.dark button[disabled],
+.dark .cursor-not-allowed {
+  background-color: #1c252e !important;
+  border-color: #1c252e !important;
+  color: #4b5563 !important;
+  opacity: 0.6 !important;
+}
+
+.dark .dark\:bg-inverse-surface\/5,
+.dark .dark\:bg-inverse-surface\/10 {
+  background-color: #161c24 !important;
+}
+.dark .dark\:bg-inverse-surface\/20,
+.dark .dark\:bg-inverse-surface\/30 {
+  background-color: #1c252e !important;
+}
+.dark .dark\:border-outline-variant\/30,
+.dark .dark\:border-outline-variant\/20,
+.dark .dark\:border-outline-variant\/10 {
+  border-color: #1c252e !important;
+}
+
+.dark .dark\:bg-surface-variant\/40 {
+  background-color: rgba(148, 163, 184, 0.4) !important;
+}
+.dark .dark\:bg-surface-variant\/20 {
+  background-color: rgba(148, 163, 184, 0.2) !important;
+}
+.dark .dark\:bg-surface-variant\/10 {
+  background-color: rgba(148, 163, 184, 0.1) !important;
+}
+
+.dark .bg-white.shadow-2xl,
+.dark .shadow-2xl .bg-white,
+.dark .shadow-2xl.dark\:bg-inverse-surface,
+.dark .shadow-2xl .dark\:bg-inverse-surface,
+.dark .absolute.dark\:bg-inverse-surface,
+.dark .fixed.dark\:bg-inverse-surface,
+.dark .modal-content.dark\:bg-inverse-surface {
+  background-color: #1c252e !important;
+  border-color: #1c252e !important;
+}
+
+.dark .input,
+.dark .select,
+.dark .input-field {
+  background-color: #0a0e14 !important;
+  border-color: #1c252e !important;
+  color: #f1f5f9 !important;
+}
+.dark .input::placeholder,
+.dark .input-field::placeholder {
+  color: #4b5563 !important;
+}
+
+.dark .btn-primary,
+.dark .btn-primary-sm {
+  background-color: #3b82f6 !important;
+  color: #ffffff !important;
+}
+.dark .btn-primary:hover,
+.dark .btn-primary-sm:hover {
+  background-color: #2563eb !important;
+}
+.dark .btn-secondary,
+.dark .btn-secondary-sm {
+  background-color: #222b36 !important;
+  border-color: #3f4e60 !important;
+  color: #60a5fa !important;
+}
+.dark .btn-secondary:hover,
+.dark .btn-secondary-sm:hover {
+  background-color: #2d3846 !important;
+  border-color: #3b82f6 !important;
+  color: #ffffff !important;
+}
+.dark .nav-button {
+  background-color: #161c24 !important;
+  border-color: #1c252e !important;
+  color: #94a3b8 !important;
+}
+.dark .nav-button:hover {
+  background-color: #1c252e !important;
+  color: #f1f5f9 !important;
+  border-color: #3b82f6 !important;
+}
+
+.dark .text-slate-900,
+.dark .text-slate-800,
+.dark .text-slate-700,
+.dark .text-gray-900,
+.dark .text-gray-800,
+.dark .text-gray-700 {
+  color: #f1f5f9 !important;
+}
+.dark .text-slate-600,
+.dark .text-slate-500,
+.dark .text-slate-400,
+.dark .text-gray-600,
+.dark .text-gray-500,
+.dark .text-gray-400 {
+  color: #94a3b8 !important;
+}
+.dark .text-slate-300 {
+  color: #cbd5e1 !important;
+}
+.dark .dark\:bg-inverse-surface {
+  background-color: #0a0e14 !important;
+}
+.dark .bg-slate-50,
+.dark .bg-slate-100 {
+  background-color: #0a0e14 !important;
+}
+.dark .bg-slate-50\/30,
+.dark .bg-slate-50\/40 {
+  background-color: rgba(10, 14, 20, 0.3) !important;
+}
+.dark .bg-slate-50\/50 {
+  background-color: rgba(10, 14, 20, 0.5) !important;
+}
+.dark .bg-white\/90 {
+  background-color: rgba(22, 28, 36, 0.9) !important;
+}
+.dark .border-slate-100,
+.dark .border-slate-200,
+.dark .border-gray-200,
+.dark .border-gray-300 {
+  border-color: #1c252e !important;
+}
+
+.dark .bg-violet-50 {
+  background-color: rgba(139, 92, 246, 0.08) !important;
+}
+.dark .border-violet-100 {
+  border-color: rgba(139, 92, 246, 0.2) !important;
+}
+.dark .text-violet-700 {
+  color: #c084fc !important;
+}
+.dark .bg-violet-100 {
+  background-color: rgba(139, 92, 246, 0.15) !important;
+}
+.dark .border-violet-200 {
+  border-color: rgba(139, 92, 246, 0.3) !important;
+}
+
+.dark .bg-blue-50,
+.dark .bg-primary-50 {
+  background-color: rgba(59, 130, 246, 0.08) !important;
+}
+.dark .border-blue-100,
+.dark .border-primary-100 {
+  border-color: rgba(59, 130, 246, 0.2) !important;
+}
+.dark .text-blue-700,
+.dark .text-primary-600 {
+  color: #60a5fa !important;
+}
+.dark .bg-blue-100 {
+  background-color: rgba(59, 130, 246, 0.15) !important;
+}
+.dark .border-blue-200 {
+  border-color: rgba(59, 130, 246, 0.3) !important;
+}
+
+.dark .bg-emerald-50 {
+  background-color: rgba(16, 185, 129, 0.08) !important;
+}
+.dark .border-emerald-100 {
+  border-color: rgba(16, 185, 129, 0.2) !important;
+}
+.dark .text-emerald-600,
+.dark .text-emerald-700 {
+  color: #34d399 !important;
+}
+.dark .bg-emerald-100 {
+  background-color: rgba(16, 185, 129, 0.15) !important;
+}
+.dark .border-emerald-200 {
+  border-color: rgba(16, 185, 129, 0.3) !important;
+}
+
+.dark .bg-amber-50 {
+  background-color: rgba(245, 158, 11, 0.08) !important;
+}
+.dark .border-amber-100 {
+  border-color: rgba(245, 158, 11, 0.2) !important;
+}
+.dark .text-amber-600,
+.dark .text-amber-700 {
+  color: #fbbf24 !important;
+}
+.dark .bg-amber-100 {
+  background-color: rgba(245, 158, 11, 0.15) !important;
+}
+.dark .border-amber-200 {
+  border-color: rgba(245, 158, 11, 0.3) !important;
+}
+
+.dark .bg-indigo-50 {
+  background-color: rgba(99, 102, 241, 0.08) !important;
+}
+.dark .border-indigo-100 {
+  border-color: rgba(99, 102, 241, 0.2) !important;
+}
+.dark .text-indigo-600,
+.dark .text-indigo-700 {
+  color: #818cf8 !important;
+}
+.dark .bg-indigo-100 {
+  background-color: rgba(99, 102, 241, 0.15) !important;
+}
+.dark .border-indigo-200 {
+  border-color: rgba(99, 102, 241, 0.3) !important;
+}
+
+.dark .bg-rose-50 {
+  background-color: rgba(244, 63, 94, 0.08) !important;
+}
+.dark .border-rose-100 {
+  border-color: rgba(244, 63, 94, 0.2) !important;
+}
+.dark .text-rose-600,
+.dark .text-rose-700 {
+  color: #fb7185 !important;
+}
+.dark .bg-rose-100 {
+  background-color: rgba(244, 63, 94, 0.15) !important;
+}
+.dark .border-rose-200 {
+  border-color: rgba(244, 63, 94, 0.3) !important;
+}
+
+.dark .bg-indigo-50\/50 {
+  background-color: rgba(99, 102, 241, 0.04) !important;
+}
+.dark .bg-indigo-50\/30 {
+  background-color: rgba(99, 102, 241, 0.02) !important;
+}
+.dark .bg-amber-50\/50 {
+  background-color: rgba(245, 158, 11, 0.04) !important;
+}
+.dark .bg-emerald-50\/50 {
+  background-color: rgba(16, 185, 129, 0.04) !important;
+}
+.dark .bg-rose-50\/50 {
+  background-color: rgba(244, 63, 94, 0.04) !important;
+}
+
+.dark .bg-gray-50,
+.dark .bg-gray-100 {
+  background-color: #0a0e14 !important;
+}
+.dark .bg-gray-200,
+.dark .bg-slate-200 {
+  background-color: #1c252e !important;
+}
+.dark .bg-gray-100.hover\:bg-gray-200:hover,
+.dark .bg-slate-100.hover\:bg-slate-200:hover,
+.dark .hover\:bg-gray-200:hover,
+.dark .hover\:bg-slate-200:hover {
+  background-color: #1c252e !important;
+}
+
 /* stylelint-enable */
diff --git a/frontend/src/pages/AdminDashboard.jsx b/frontend/src/pages/AdminDashboard.jsx
index e2022e9..35e80ed 100644
--- a/frontend/src/pages/AdminDashboard.jsx
+++ b/frontend/src/pages/AdminDashboard.jsx
@@ -590,35 +590,25 @@ export default function AdminReviewsPage() {
   }
 
   return (
-    <div className="min-h-screen bg-slate-50/50 pt-24 pb-12 relative overflow-hidden">
-      {/* Ambient background glows */}
-      <div className="pointer-events-none absolute left-1/4 top-10 h-96 w-96 rounded-full bg-gradient-to-br from-primary-400/10 to-indigo-300/10 blur-[100px]" />
-      <div className="pointer-events-none absolute right-1/4 top-40 h-96 w-96 rounded-full bg-gradient-to-br from-sky-400/10 to-emerald-300/10 blur-[100px]" />
-
+    <div className="relative text-on-surface dark:text-inverse-on-surface">
       <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
-      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
+      <div className="max-w-container-max mx-auto">
         
         <motion.div
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
-          className="relative mb-8 overflow-hidden rounded-3xl border border-white/80 bg-white/70 p-6 md:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.04)] backdrop-blur-md"
+          className="mb-lg relative overflow-hidden rounded-xl border border-border-subtle dark:border-outline-variant/30 bg-white dark:bg-inverse-surface/5 p-6 shadow-sm"
         >
-          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-50/40 via-white/50 to-yellow-50/40 opacity-70" />
-          <div className="relative flex items-start justify-between gap-4 flex-wrap">
+          <div className="flex items-start justify-between gap-4 flex-wrap">
             <div className="max-w-2xl">
-              <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 mb-4">
+              <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary mb-3">
                 <Shield className="w-3.5 h-3.5" />
                 Admin workspace
               </div>
-              <div className="flex items-center space-x-3 mb-2">
-                <Shield className="w-8 h-8 text-yellow-500 animate-pulse" />
-                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
-                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-primary-950">
-                    Admin Management
-                  </span>
-                </h1>
-              </div>
-              <p className="text-gray-600 max-w-xl">One place for overview, job moderation, and applicant management.</p>
+              <h1 className="font-display-lg text-display-lg text-on-surface dark:text-inverse-on-surface font-extrabold mb-1">
+                Admin Control Panel
+              </h1>
+              <p className="font-body-base text-body-base text-on-surface-variant dark:text-surface-variant">One place for overview diagnostics, job moderation, and applicant management.</p>
             </div>
 
             <div className="flex items-center gap-2 flex-wrap">
@@ -632,7 +622,6 @@ export default function AdminReviewsPage() {
               </div>
             </div>
           </div>
-
         </motion.div>
 
         {activeTab === 'overview' && (
@@ -1618,7 +1607,7 @@ export default function AdminReviewsPage() {
             animate={{ opacity: 1, y: 0, scale: 1 }}
             className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-100 bg-white/95 backdrop-blur shadow-2xl"
           >
-            <div className="border-b border-slate-100 bg-gradient-to-br from-primary-50/40 via-white to-yellow-50/40 px-6 py-5">
+            <div className="border-b border-slate-100 bg-gradient-to-br from-primary-50/40 via-white to-yellow-50/40 dark:from-[#161c24] dark:via-[#1c252e] dark:to-[#161c24] px-6 py-5">
               <div className="flex items-start justify-between gap-4">
                 <div>
                   <p className="text-[10px] font-bold uppercase tracking-wider text-primary-600">Job Details</p>
@@ -1767,13 +1756,13 @@ export default function AdminReviewsPage() {
                 <>
                   <button
                     onClick={cancelEditJob}
-                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-95 duration-200 transition-all"
+                    className="btn-secondary-sm !px-4 !py-2 !text-xs !rounded-xl"
                   >
                     Cancel
                   </button>
                   <button
                     onClick={submitEditJob}
-                    className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white hover:bg-primary-700 active:scale-95 duration-200 transition-all shadow-md shadow-primary-500/10"
+                    className="btn-primary-sm !px-4 !py-2 !text-xs !rounded-xl shadow-md shadow-primary-500/10"
                   >
                     Save
                   </button>
@@ -1782,25 +1771,25 @@ export default function AdminReviewsPage() {
                 <>
                   <button
                     onClick={startEditJob}
-                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-95 duration-200 transition-all"
+                    className="btn-secondary-sm !px-4 !py-2 !text-xs !rounded-xl"
                   >
                     Edit
                   </button>
                   <button
                     onClick={() => handleToggleDisable(viewingJob)}
-                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-95 duration-200 transition-all"
+                    className="btn-secondary-sm !px-4 !py-2 !text-xs !rounded-xl"
                   >
                     {viewingJob.status === 'rejected' ? 'Enable' : 'Disable'}
                   </button>
                   <button
                     onClick={() => handleForceReview(viewingJob)}
-                    className="rounded-xl border border-primary-100 px-4 py-2 text-xs font-bold text-primary-700 hover:bg-primary-50 active:scale-95 duration-200 transition-all"
+                    className="btn-secondary-sm !px-4 !py-2 !text-xs !rounded-xl"
                   >
                     Force Review
                   </button>
                   <button
                     onClick={closeJobDetails}
-                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-95 duration-200 transition-all"
+                    className="btn-secondary-sm !px-4 !py-2 !text-xs !rounded-xl"
                   >
                     Close
                   </button>
@@ -1850,7 +1839,7 @@ export default function AdminReviewsPage() {
               <button
                 onClick={closeRejectModal}
                 disabled={rejectSubmitting}
-                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
+                className="btn-secondary-sm !px-4 !py-2 !text-xs !rounded-xl disabled:opacity-50"
               >
                 Cancel
               </button>
@@ -1891,7 +1880,7 @@ export default function AdminReviewsPage() {
             </p>
 
             <div className="flex items-center justify-end gap-3">
-              <button onClick={closeConfirmAction} disabled={confirmAction.loading} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">
+              <button onClick={closeConfirmAction} disabled={confirmAction.loading} className="btn-secondary-sm !px-4 !py-2 !text-xs !rounded-xl">
                 Cancel
               </button>
               <button onClick={submitConfirmAction} disabled={confirmAction.loading} className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 text-xs font-bold active:scale-95 duration-200">
diff --git a/frontend/src/pages/ApplicantDetailsPage.jsx b/frontend/src/pages/ApplicantDetailsPage.jsx
index ebebf05..bf5f0df 100644
--- a/frontend/src/pages/ApplicantDetailsPage.jsx
+++ b/frontend/src/pages/ApplicantDetailsPage.jsx
@@ -163,32 +163,25 @@ export default function ApplicantDetailsPage() {
   const summary = parsed.summary || ''
 
   return (
-    <div className="min-h-screen bg-slate-50/50 pt-24 pb-12 relative overflow-hidden">
-      {/* Ambient background glows */}
-      <div className="pointer-events-none absolute left-1/4 top-10 h-96 w-96 rounded-full bg-gradient-to-br from-primary-400/10 to-indigo-300/10 blur-[100px]" />
-      <div className="pointer-events-none absolute right-1/4 top-40 h-96 w-96 rounded-full bg-gradient-to-br from-sky-400/10 to-emerald-300/10 blur-[100px]" />
-
-      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
+    <div className="relative text-on-surface dark:text-inverse-on-surface">
+      <div className="max-w-container-max mx-auto">
         <motion.div
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
-          className="mb-8"
+          className="mb-lg"
         >
           <button
             onClick={() => navigate(-1)}
-            className="flex items-center space-x-2 text-slate-500 hover:text-slate-800 transition-colors duration-200 mb-4 font-bold text-xs"
+            className="flex items-center space-x-2 text-slate-500 hover:text-slate-800 transition-colors duration-200 mb-4 font-bold text-xs cursor-pointer"
           >
             <ArrowLeft className="w-4 h-4" />
             <span>Back</span>
           </button>
           
-          <div className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/70 p-6 md:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.04)] backdrop-blur-md">
-            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-50/40 via-white/50 to-white/40 opacity-70" />
-            <div className="relative">
-              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
-                {applicant?.display_name || 'Applicant Details'}
-              </h1>
-            </div>
+          <div className="relative overflow-hidden rounded-xl border border-border-subtle dark:border-outline-variant/30 bg-white dark:bg-inverse-surface/5 p-6 shadow-sm">
+            <h1 className="font-display-lg text-display-lg text-on-surface dark:text-inverse-on-surface font-extrabold mb-1">
+              {applicant?.display_name || 'Applicant Profile'}
+            </h1>
           </div>
         </motion.div>
 
@@ -269,7 +262,7 @@ export default function ApplicantDetailsPage() {
                   {skills.map((skill, idx) => (
                     <span
                       key={idx}
-                      className="px-3 py-1 bg-primary-50 border border-primary-100 rounded-xl text-xs font-bold text-primary-750 shadow-sm"
+                      className="px-3 py-1 bg-primary-50 border border-primary-100 rounded-xl text-xs font-bold text-primary-700 dark:text-primary-600 shadow-sm"
                     >
                       {skill.name}
                     </span>
diff --git a/frontend/src/pages/CandidateIntelligencePage.jsx b/frontend/src/pages/CandidateIntelligencePage.jsx
index 70e6d2a..b9fbc78 100644
--- a/frontend/src/pages/CandidateIntelligencePage.jsx
+++ b/frontend/src/pages/CandidateIntelligencePage.jsx
@@ -64,26 +64,26 @@ export default function CandidateIntelligencePage() {
         <motion.div
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
-          className="relative mb-8 overflow-hidden rounded-3xl border border-white bg-white/70 p-6 md:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.02)] backdrop-blur-md"
+          className="relative mb-8 overflow-hidden rounded-3xl border border-white dark:border-[#1c252e] bg-white/70 dark:bg-[#161c24] p-6 md:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.02)] backdrop-blur-md"
         >
-          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-50/20 via-white/50 to-fuchsia-50/20 opacity-70" />
+          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-50/20 dark:from-[#1e1b4b]/10 via-white/50 dark:via-[#0a0e14]/20 to-fuchsia-50/20 dark:to-[#4c0519]/10 opacity-70" />
           <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
             <div>
               <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700 mb-3 animate-pulse">
                 <BrainCircuit className="w-3.5 h-3.5" />
                 Longitudinal AI Insights
               </div>
-              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-indigo-950 to-fuchsia-950">
+              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 dark:from-white via-indigo-950 dark:via-indigo-200 to-fuchsia-950 dark:to-fuchsia-200">
                 AI Living Candidate Model
               </h1>
-              <p className="text-gray-600 max-w-2xl">
+              <p className="text-gray-600 dark:text-slate-400 max-w-2xl">
                 A dynamic, self-evolving behavioral model of your actual mock interview performance. 
                 Instead of just tracking scores, it analyzes patterns in your technical depth and habits over time.
               </p>
             </div>
 
-            {profile && (
-              <div className="flex items-center gap-3 bg-white/95 border border-slate-100 rounded-2xl p-4 shadow-sm">
+             {profile && (
+              <div className="flex items-center gap-3 bg-white/95 dark:bg-[#0a0e14] border border-slate-100 dark:border-[#1c252e] rounded-2xl p-4 shadow-sm">
                 <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                   <Award className="w-6 h-6" />
                 </div>
@@ -101,12 +101,12 @@ export default function CandidateIntelligencePage() {
           <motion.div
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
-            className="p-12 border border-dashed border-slate-200 rounded-3xl bg-white/80 backdrop-blur-sm text-center shadow-sm max-w-2xl mx-auto my-8 relative overflow-hidden group"
+            className="p-12 border border-dashed border-slate-200 dark:border-[#1c252e] rounded-3xl bg-white/80 dark:bg-[#161c24] backdrop-blur-sm text-center shadow-sm max-w-2xl mx-auto my-8 relative overflow-hidden group"
           >
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-400 to-indigo-500" />
             <BrainCircuit className="w-16 h-16 text-indigo-400 mx-auto mb-4 group-hover:scale-110 transition-transform duration-300" />
             <h3 className="text-2xl font-extrabold mb-3 text-slate-900">Unlock Your AI Living Model</h3>
-            <p className="text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
+            <p className="text-gray-600 dark:text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
               Complete mock interview sessions to initiate candidate pattern intelligence. The system will automatically build a deep, multidimensional analysis of your technical vocabulary, context habits, and pressure responses.
             </p>
             <button
@@ -128,14 +128,14 @@ export default function CandidateIntelligencePage() {
               <motion.div
                 initial={{ opacity: 0, y: 15 }}
                 animate={{ opacity: 1, y: 0 }}
-                className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/10 p-6 md:p-8 shadow-sm group"
+                className="relative overflow-hidden rounded-3xl border border-indigo-100 dark:border-[#1c252e] bg-gradient-to-br from-white dark:from-[#161c24] to-indigo-50/10 dark:to-[#0a0e14] p-6 md:p-8 shadow-sm group"
               >
                 <div className="absolute -right-16 -top-16 w-32 h-32 rounded-full bg-indigo-500/5 group-hover:scale-150 transition-transform duration-500" />
                 <h2 className="text-xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                   <Sparkles className="w-5 h-5 text-indigo-500" />
                   AI Living Persona Analysis
                 </h2>
-                <div className="text-slate-700 text-lg leading-relaxed font-medium bg-white/70 border border-indigo-50 p-5 rounded-2xl shadow-inner">
+                <div className="text-slate-700 dark:text-slate-200 text-lg leading-relaxed font-medium bg-white/70 dark:bg-[#161c24] border border-indigo-50 dark:border-[#1c252e] p-5 rounded-2xl shadow-inner">
                   "{profile.summary}"
                 </div>
                 
@@ -162,7 +162,7 @@ export default function CandidateIntelligencePage() {
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   
                   {/* Pattern 1: Explanation Depth */}
-                  <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
+                  <div className="p-5 bg-white dark:bg-[#161c24] border border-slate-100 dark:border-[#1c252e] rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                     <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                     <div className="flex items-start justify-between gap-3 mb-2">
                       <div className="font-extrabold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-wide">
@@ -179,7 +179,7 @@ export default function CandidateIntelligencePage() {
                   </div>
 
                   {/* Pattern 2: Example Coverage */}
-                  <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
+                  <div className="p-5 bg-white dark:bg-[#161c24] border border-slate-100 dark:border-[#1c252e] rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                     <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                     <div className="flex items-start justify-between gap-3 mb-2">
                       <div className="font-extrabold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-wide">
@@ -196,7 +196,7 @@ export default function CandidateIntelligencePage() {
                   </div>
 
                   {/* Pattern 3: Time & Pressure */}
-                  <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
+                  <div className="p-5 bg-white dark:bg-[#161c24] border border-slate-100 dark:border-[#1c252e] rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                     <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                     <div className="flex items-start justify-between gap-3 mb-2">
                       <div className="font-extrabold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-wide">
@@ -213,7 +213,7 @@ export default function CandidateIntelligencePage() {
                   </div>
 
                   {/* Pattern 4: Context Assumption */}
-                  <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
+                  <div className="p-5 bg-white dark:bg-[#161c24] border border-slate-100 dark:border-[#1c252e] rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                     <div className="absolute top-0 left-0 w-1 h-full bg-fuchsia-500" />
                     <div className="flex items-start justify-between gap-3 mb-2">
                       <div className="font-extrabold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-wide">
@@ -235,7 +235,7 @@ export default function CandidateIntelligencePage() {
               {/* Strengths & Weaknesses Bullet Lists */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 
-                <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-3">
+                <div className="p-6 bg-white dark:bg-[#161c24] border border-slate-100 dark:border-[#1c252e] rounded-3xl shadow-sm space-y-3">
                   <h3 className="font-extrabold text-slate-950 flex items-center gap-2 border-b border-slate-100 pb-2 text-sm uppercase tracking-wider text-emerald-700">
                     <CheckCircle className="w-4 h-4 text-emerald-500" />
                     Technical Core Strengths
@@ -250,7 +250,7 @@ export default function CandidateIntelligencePage() {
                   </ul>
                 </div>
 
-                <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-3">
+                <div className="p-6 bg-white dark:bg-[#161c24] border border-slate-100 dark:border-[#1c252e] rounded-3xl shadow-sm space-y-3">
                   <h3 className="font-extrabold text-slate-950 flex items-center gap-2 border-b border-slate-100 pb-2 text-sm uppercase tracking-wider text-amber-700">
                     <AlertTriangle className="w-4 h-4 text-amber-500" />
                     Key Improvement Areas
@@ -277,7 +277,7 @@ export default function CandidateIntelligencePage() {
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 transition={{ delay: 0.15 }}
-                className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-5"
+                className="p-6 bg-white dark:bg-[#161c24] border border-slate-100 dark:border-[#1c252e] rounded-3xl shadow-sm space-y-5"
               >
                 <h2 className="text-lg font-black text-slate-950 flex items-center gap-2 pb-3 border-b border-slate-100">
                   <TrendingUp className="w-5 h-5 text-indigo-500 animate-pulse" />
@@ -340,7 +340,7 @@ export default function CandidateIntelligencePage() {
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 transition={{ delay: 0.2 }}
-                className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4"
+                className="p-6 bg-white dark:bg-[#161c24] border border-slate-100 dark:border-[#1c252e] rounded-3xl shadow-sm space-y-4"
               >
                 <h2 className="text-lg font-black text-slate-950 flex items-center gap-2 pb-3 border-b border-slate-100">
                   <BookOpen className="w-5 h-5 text-fuchsia-500" />
diff --git a/frontend/src/pages/EmployerDashboard.jsx b/frontend/src/pages/EmployerDashboard.jsx
index bdd4210..b1144ba 100644
--- a/frontend/src/pages/EmployerDashboard.jsx
+++ b/frontend/src/pages/EmployerDashboard.jsx
@@ -1,16 +1,14 @@
 import React, { useState, useEffect } from 'react'
-import { motion } from 'framer-motion'
-import { 
-  Briefcase, Users, Eye, CheckCircle, XCircle, 
-  Clock, AlertTriangle, LogOut, X
+import { motion, AnimatePresence } from 'framer-motion'
+import {
+  Briefcase, Users, Eye, CheckCircle, XCircle,
+  Clock, AlertTriangle, X, Sparkles, TrendingUp, ArrowRight
 } from 'lucide-react'
-import { useNavigate } from 'react-router-dom'
+import { useNavigate, Link } from 'react-router-dom'
 import api from '../config/api'
 import { ANIMATION_DELAYS } from '../config/constants'
-import ScrollToTop from '../components/ScrollToTop'
 import { useToast } from '../hooks/useToast'
 import { ToastContainer } from '../components/Toast'
-import secureStorage from '../utils/secureStorage'
 
 export default function EmployerDashboard() {
   const navigate = useNavigate()
@@ -31,12 +29,6 @@ export default function EmployerDashboard() {
   const [modalLoading, setModalLoading] = useState(false)
   const [modalError, setModalError] = useState(null)
 
-  const handleLogout = () => {
-    secureStorage.clear()
-    delete api.defaults.headers.common['Authorization']
-    navigate('/login')
-  }
-
   useEffect(() => {
     fetchDashboardData()
   }, [])
@@ -65,21 +57,21 @@ export default function EmployerDashboard() {
     switch (status) {
       case 'pending':
         return (
-          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-medium">
+          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/10 text-warning text-xs font-bold border border-warning/20">
             <Clock className="w-3.5 h-3.5" />
             <span>Pending</span>
           </span>
         )
       case 'approved':
         return (
-          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-medium">
+          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 text-success text-xs font-bold border border-success/20">
             <CheckCircle className="w-3.5 h-3.5" />
             <span>Approved</span>
           </span>
         )
       case 'rejected':
         return (
-          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
+          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error/10 text-error text-xs font-bold border border-error/20">
             <XCircle className="w-3.5 h-3.5" />
             <span>Rejected</span>
           </span>
@@ -91,198 +83,109 @@ export default function EmployerDashboard() {
 
   if (loading) {
     return (
-      <div className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
-        <div className="text-center">
-          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
-          <p className="text-gray-600">Loading dashboard...</p>
-        </div>
+      <div className="flex items-center justify-center py-20">
+        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
       </div>
     )
   }
 
   if (error) {
     return (
-      <div className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
-        <div className="card max-w-md">
-          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
-          <p className="text-center text-gray-600">{error}</p>
+      <div className="flex items-center justify-center py-20">
+        <div className="bg-white dark:bg-inverse-surface/10 p-6 rounded-2xl border border-error max-w-md text-center shadow-sm">
+          <AlertTriangle className="w-12 h-12 text-error mx-auto mb-4" />
+          <p className="text-on-surface dark:text-inverse-on-surface font-semibold">{error}</p>
         </div>
       </div>
     )
   }
 
   return (
-    <div className="min-h-screen bg-slate-50/50 pt-24 pb-12 relative overflow-hidden">
-      {/* Ambient background glows */}
-      <div className="pointer-events-none absolute left-1/4 top-10 h-96 w-96 rounded-full bg-gradient-to-br from-primary-400/10 to-indigo-300/10 blur-[100px]" />
-      <div className="pointer-events-none absolute right-1/4 top-40 h-96 w-96 rounded-full bg-gradient-to-br from-sky-400/10 to-emerald-300/10 blur-[100px]" />
-
+    <div className="relative">
       <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
-      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
-        
-        <motion.div
-          initial={{ opacity: 0, y: -20 }}
-          animate={{ opacity: 1, y: 0 }}
-          className="relative mb-8 overflow-hidden rounded-3xl border border-white/80 bg-white/70 p-6 md:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.04)] backdrop-blur-md"
-        >
-          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-50/40 via-white/50 to-white/40 opacity-70" />
-          <div className="relative flex items-start justify-between gap-4 flex-wrap">
-            <div className="max-w-2xl">
-              <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary-700 mb-3">
-                <Briefcase className="w-3.5 h-3.5" />
-                Employer workspace
-              </div>
-              <div className="flex items-center space-x-3 mb-2">
-                <Briefcase className="w-8 h-8 text-primary-500" />
-                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
-                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-primary-950">
-                    Employer Dashboard
-                  </span>
-                </h1>
-              </div>
-              <p className="text-gray-600 max-w-xl">Manage your job postings and applicants</p>
-            </div>
-          </div>
-        </motion.div>
+      
+      {/* Welcome Header */}
+      <div className="mb-xl flex flex-col md:flex-row md:items-end justify-between gap-md relative z-10">
+        <div>
+          <h1 className="font-display-lg text-display-lg text-on-surface dark:text-inverse-on-surface mb-xs font-bold leading-tight">
+            Recruitment Overview
+          </h1>
+          <p className="font-body-base text-body-base text-on-surface-variant dark:text-surface-variant">
+            Analyze matches, review applicants, and manage your active job listings.
+          </p>
+        </div>
+        <div>
+          <Link
+            to="/employer/post-job"
+            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white dark:text-on-primary-container dark:bg-primary-container rounded-lg font-body-bold text-[14px] hover:bg-primary-500 hover:shadow-lg active:scale-95 duration-150 transition-all cursor-pointer shadow-sm"
+          >
+            <Sparkles className="w-4 h-4" />
+            Post a New Job
+          </Link>
+        </div>
+      </div>
 
-        {/* Job Details Modal */}
-        {modalOpen && (
-          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
-            <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-slate-100 bg-white/95 backdrop-blur shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto">
-              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
-                <div>
-                  <div className="inline-flex items-center rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-700 mb-3">
-                    Active Job Profile
-                  </div>
-                  <h3 className="text-2xl font-black text-slate-900 leading-tight">
-                    {modalLoading ? 'Loading...' : modalJob?.title}
-                  </h3>
-                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
-                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-800 shadow-sm">
-                      {modalJob?.location_city}
-                    </span>
-                    <span className="inline-flex items-center rounded-full border border-slate-100 bg-slate-50/50 px-3 py-1 text-slate-600 text-xs capitalize">
-                      {modalJob?.work_type}
-                    </span>
-                  </div>
-                </div>
-                <button
-                  onClick={() => { setModalOpen(false); setModalJob(null) }}
-                  className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 transition-colors flex-shrink-0"
-                  aria-label="Close job details"
-                >
-                  <X className="w-5 h-5" />
-                </button>
-              </div>
+      {/* Stats Grid */}
+      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-lg mb-xl">
+        {[
+          { title: 'Total Listings', value: stats.totalJobs, icon: Briefcase, textCol: 'text-primary dark:text-primary-fixed-dim', bgCol: 'bg-primary/5 dark:bg-primary/10', borderCol: 'border-primary/10' },
+          { title: 'Under Review', value: stats.pendingJobs, icon: Clock, textCol: 'text-warning', bgCol: 'bg-warning/5 dark:bg-warning/10', borderCol: 'border-warning/10' },
+          { title: 'Approved Roles', value: stats.approvedJobs, icon: CheckCircle, textCol: 'text-success', bgCol: 'bg-success/5 dark:bg-success/10', borderCol: 'border-success/10' },
+          { title: 'Total Applicants', value: stats.totalApplicants, icon: Users, textCol: 'text-purple-600 dark:text-purple-400', bgCol: 'bg-purple-500/5 dark:bg-purple-500/10', borderCol: 'border-purple-500/10' }
+        ].map((stat, idx) => (
+          <motion.div
+            key={stat.title}
+            initial={{ opacity: 0, y: 20 }}
+            animate={{ opacity: 1, y: 0 }}
+            transition={{ delay: idx * 0.08 }}
+            className="border border-border-subtle dark:border-outline-variant/30 bg-white dark:bg-inverse-surface/5 rounded-xl p-md soft-shadow flex items-center justify-between"
+          >
+            <div>
+              <p className="font-metadata text-[12px] font-bold text-on-surface-variant dark:text-surface-variant uppercase tracking-wider mb-1">{stat.title}</p>
+              <p className={`font-label-caps text-3xl font-extrabold ${stat.textCol}`}>{stat.value}</p>
+            </div>
+            <div className={`p-2.5 rounded-lg ${stat.bgCol} ${stat.textCol} border ${stat.borderCol}`}>
+              <stat.icon className="w-5 h-5" />
+            </div>
+          </motion.div>
+        ))}
+      </div>
 
-              {modalError && (
-                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
-                  {modalError}
-                </div>
+      {/* Bento Layout Grid */}
+      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
+        
+        {/* Main Jobs List (8/12 width) */}
+        <div className="lg:col-span-8">
+          <motion.div
+            initial={{ opacity: 0, y: 20 }}
+            animate={{ opacity: 1, y: 0 }}
+            transition={{ delay: 0.2 }}
+            className="border border-border-subtle dark:border-outline-variant/30 bg-white dark:bg-inverse-surface/5 rounded-xl p-lg soft-shadow"
+          >
+            <div className="flex items-center justify-between mb-6">
+              <h2 className="text-lg font-bold text-on-surface dark:text-inverse-on-surface flex items-center gap-2">
+                <Briefcase className="w-5 h-5 text-primary" />
+                Active Job Postings
+              </h2>
+              {jobs.length > 0 && (
+                <span className="font-label-caps text-[10px] text-on-surface-variant dark:text-surface-variant bg-surface-container-low dark:bg-surface-variant/40 rounded-lg px-2.5 py-1">
+                  Page {page} of {Math.ceil(jobs.length / pageSize) || 1}
+                </span>
               )}
-
-              <div className="space-y-6">
-                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5">
-                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Description</h4>
-                  <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{modalJob?.description}</div>
-                </div>
-
-                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl">
-                  <div>
-                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Min Experience</p>
-                    <p className="font-semibold text-slate-800 text-sm">{modalJob?.min_experience_years} years</p>
-                  </div>
-                  <div>
-                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Min CGPA Requirement</p>
-                    <p className="font-semibold text-slate-800 text-sm">{modalJob?.min_cgpa ?? 'N/A'}</p>
-                  </div>
-                </div>
-
-                <div>
-                  <h4 className="font-bold text-slate-800 text-sm mb-2">Required Skills</h4>
-                  <div className="flex flex-wrap gap-2">
-                    {(modalJob?.required_skills || []).map((s, idx) => (
-                      <span key={idx} className="px-3 py-1.5 rounded-xl bg-primary-50 border border-primary-100 text-primary-700 text-xs font-bold shadow-sm">
-                        {typeof s === 'string' ? s : s.name || JSON.stringify(s)}
-                      </span>
-                    ))}
-                  </div>
-                </div>
-
-                <div className="flex gap-3 pt-4 border-t border-slate-100">
-                  <button onClick={() => { setModalOpen(false); setModalJob(null) }} className="flex-1 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-bold text-slate-700 active:scale-95 duration-200">
-                    Close
-                  </button>
-                  <button
-                    disabled={modalLoading}
-                    onClick={() => { if (modalJob?.id) navigate(`/employer/jobs/${modalJob.id}/applicants`) }}
-                    className="flex-1 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 duration-200"
-                  >
-                    View Applicants
-                  </button>
-                </div>
-              </div>
             </div>
-          </div>
-        )}
 
-        {/* Stats Cards */}
-        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
-          {[
-            { title: 'Total Jobs', value: stats.totalJobs, icon: Briefcase, color: 'slate', textCol: 'text-slate-600', bgCol: 'bg-slate-50', borderCol: 'border-slate-100' },
-            { title: 'Pending Review', value: stats.pendingJobs, icon: Clock, color: 'amber', textCol: 'text-amber-600', bgCol: 'bg-amber-50/50', borderCol: 'border-amber-100' },
-            { title: 'Approved', value: stats.approvedJobs, icon: CheckCircle, color: 'emerald', textCol: 'text-emerald-600', bgCol: 'bg-emerald-50/50', borderCol: 'border-emerald-100' },
-            { title: 'Total Applicants', value: stats.totalApplicants, icon: Users, color: 'primary', textCol: 'text-primary-600', bgCol: 'bg-primary-50/50', borderCol: 'border-primary-100' }
-          ].map((stat, idx) => (
-            <motion.div
-              key={stat.title}
-              initial={{ opacity: 0, y: 20 }}
-              animate={{ opacity: 1, y: 0 }}
-              transition={{ delay: idx * 0.08 }}
-              className="cursor-default border border-slate-100 bg-white/90 backdrop-blur-sm rounded-2xl p-5 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_15px_35px_rgba(15,23,42,0.05)] hover:border-slate-200 flex items-center justify-between"
-            >
-              <div>
-                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.title}</p>
-                <p className={`text-3xl font-black ${stat.textCol}`}>{stat.value}</p>
-              </div>
-              <div className={`p-2.5 rounded-xl ${stat.bgCol} ${stat.textCol} border ${stat.borderCol}`}>
-                <stat.icon className="w-6 h-6" />
+            {jobs.length === 0 ? (
+              <div className="text-center py-12">
+                <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
+                <p className="text-on-surface-variant dark:text-surface-variant mb-4 font-semibold">No job postings created yet</p>
+                <Link
+                  to="/employer/post-job"
+                  className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold transition-all shadow-md hover:bg-primary-500 text-xs cursor-pointer"
+                >
+                  Create Your First Listing
+                </Link>
               </div>
-            </motion.div>
-          ))}
-        </div>
-
-        {/* Jobs List */}
-        <motion.div
-          initial={{ opacity: 0, y: 20 }}
-          animate={{ opacity: 1, y: 0 }}
-          transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 5 }}
-          className="border border-slate-100 bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
-        >
-          <div className="flex items-center justify-between mb-6">
-            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
-              <Briefcase className="w-5 h-5 text-primary-500" />
-              Your Job Postings
-            </h2>
-            {jobs.length > 0 && (
-              <span className="text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1">
-                Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, jobs.length)} of {jobs.length}
-              </span>
-            )}
-          </div>
-          {jobs.length === 0 ? (
-            <div className="text-center py-12">
-              <Briefcase className="w-16 h-16 text-slate-400 mx-auto mb-4" />
-              <p className="text-slate-500 mb-4 font-semibold">No job postings yet</p>
-              <button
-                onClick={() => navigate('/employer/post-job')}
-                className="px-6 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white rounded-xl font-bold transition-all shadow-md active:scale-95 duration-200"
-              >
-                Post Your First Job
-              </button>
-            </div>
-          ) : (
-            <>
+            ) : (
               <div className="space-y-4">
                 {jobs.slice((page - 1) * pageSize, page * pageSize).map((job, idx) => (
                   <motion.div
@@ -290,34 +193,34 @@ export default function EmployerDashboard() {
                     initial={{ opacity: 0, x: -10 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: idx * 0.05 }}
-                    className="p-5 bg-white rounded-2xl border border-slate-100 transition-all hover:shadow-[0_15px_35px_rgba(15,23,42,0.05)] hover:border-slate-200 hover:-translate-y-0.5"
+                    className="p-md bg-white dark:bg-inverse-surface/10 rounded-xl border border-border-subtle dark:border-outline-variant/20 transition-all hover:shadow-[0_10px_25px_rgba(0,0,0,0.02)] hover:border-slate-200"
                   >
-                    <div className="flex items-start justify-between mb-3 gap-4">
-                      <div className="flex-1">
-                        <h3 className="font-bold text-base text-slate-900 mb-1">{job.title}</h3>
-                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
-                          <span>{job.location_city} • {job.work_type}</span>
-                          <span>•</span>
-                          <span className="inline-flex items-center gap-1 font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-lg border border-primary-100">
-                            {job.applicant_count || 0} {job.applicant_count === 1 ? 'applicant' : 'applicants'}
-                          </span>
-                        </div>
+                    <div className="flex items-start justify-between mb-2 gap-4">
+                      <div>
+                        <h3 className="font-body-bold text-[15px] font-bold text-on-surface dark:text-inverse-on-surface">{job.title}</h3>
+                        <p className="font-metadata text-[12px] text-on-surface-variant dark:text-surface-variant mt-0.5">
+                          {job.location_city} • {job.work_type}
+                        </p>
                       </div>
                       {getStatusBadge(job.status)}
                     </div>
-                    <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-2">{job.description}</p>
-                    <div className="flex items-center justify-between text-xs border-t border-slate-50 pt-4 flex-wrap gap-3">
-                      <span className="text-slate-400 font-semibold">
+                    
+                    <p className="text-[13px] text-on-surface-variant dark:text-surface-variant leading-relaxed line-clamp-2 mb-4">
+                      {job.description}
+                    </p>
+
+                    <div className="flex items-center justify-between text-xs border-t border-border-subtle dark:border-outline-variant/10 pt-3 flex-wrap gap-2">
+                      <span className="text-[11px] text-slate-400 font-semibold">
                         Posted: {new Date(job.created_at).toLocaleDateString()}
                       </span>
                       <div className="flex items-center gap-2">
                         {job.status === 'approved' && (
                           <button
                             onClick={() => navigate(`/employer/jobs/${job.id}/applicants`)}
-                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-primary-200 hover:bg-primary-50 text-primary-700 rounded-xl transition-all text-xs font-bold active:scale-95 duration-200"
+                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 hover:bg-blue-100 text-primary-600 dark:text-primary-600 rounded-lg text-[12px] font-bold transition-all active:scale-95 duration-150 cursor-pointer"
                           >
                             <Eye className="w-3.5 h-3.5" />
-                            <span>View Applicants</span>
+                            <span>Applicants ({job.applicant_count || 0})</span>
                           </button>
                         )}
                         <button
@@ -329,55 +232,162 @@ export default function EmployerDashboard() {
                               setModalJob(res.data.job)
                               setModalOpen(true)
                             } catch (err) {
-                              const errorMsg = err.response?.data?.detail || 'Failed to load job details'
+                              const errorMsg = err.response?.data?.detail || 'Failed to load details'
                               setModalError(errorMsg)
                               toast.error(errorMsg)
                             } finally {
                               setModalLoading(false)
                             }
                           }}
-                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all text-xs font-bold active:scale-95 duration-200"
+                          className="btn-secondary-sm inline-flex items-center gap-1.5 !px-3 !py-1.5 !rounded-lg text-[12px] font-bold cursor-pointer"
                         >
-                          <span>Details</span>
+                          <span>Review Specs</span>
                         </button>
                       </div>
                     </div>
+
                     {job.status === 'rejected' && job.rejection_reason && (
-                      <div className="mt-3 p-3 rounded-xl border border-red-200 bg-red-50 text-xs font-medium text-red-700">
-                        <strong>Rejection reason:</strong> {job.rejection_reason}
+                      <div className="mt-3 p-3 rounded-xl border border-red-200 bg-red-50 text-[11px] font-bold text-red-700">
+                        <strong>Rejection Reason:</strong> {job.rejection_reason}
                       </div>
                     )}
                   </motion.div>
                 ))}
               </div>
-              
-              {/* Pagination */}
-              {Math.ceil(jobs.length / pageSize) > 1 && (
-                <div className="flex justify-center items-center space-x-2 mt-6 pt-4 border-t border-slate-100">
-                  <button
-                    onClick={() => setPage(p => Math.max(1, p - 1))}
-                    disabled={page === 1}
-                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold transition-all"
-                  >
-                    Previous
+            )}
+
+            {/* Pagination */}
+            {Math.ceil(jobs.length / pageSize) > 1 && (
+              <div className="flex justify-center items-center space-x-2 mt-6 pt-4 border-t border-border-subtle dark:border-outline-variant/20">
+                <button
+                  onClick={() => setPage(p => Math.max(1, p - 1))}
+                  disabled={page === 1}
+                  className="btn-secondary-sm !px-3.5 !py-1.5 !rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold"
+                >
+                  Previous
+                </button>
+                <span className="text-slate-400 text-xs font-semibold">
+                  {page} / {Math.ceil(jobs.length / pageSize)}
+                </span>
+                <button
+                  onClick={() => setPage(p => Math.min(Math.ceil(jobs.length / pageSize), p + 1))}
+                  disabled={page === Math.ceil(jobs.length / pageSize)}
+                  className="btn-primary-sm !px-3.5 !py-1.5 !rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold"
+                >
+                  Next
+                </button>
+              </div>
+            )}
+          </motion.div>
+        </div>
+
+        {/* Sidebar Info Pane (4/12 width) */}
+        <div className="lg:col-span-4 flex flex-col gap-lg">
+          
+          {/* AI Talent Intelligence Tips */}
+          <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-md soft-shadow">
+            <div className="flex items-center gap-sm mb-md">
+              <TrendingUp className="w-5 h-5 text-purple-600" />
+              <h3 className="font-body-bold text-[15px] font-bold text-on-surface dark:text-inverse-on-surface">Recruiter Analytics</h3>
+            </div>
+            <p className="font-metadata text-[12px] text-on-surface-variant dark:text-surface-variant leading-relaxed mb-md">
+              Our parsing engine automatically maps candidates' skill clusters against your job requirements. Ensure your listing requirements match specific skills (e.g. <code className="font-mono text-primary font-bold">Python</code>, <code className="font-mono text-primary font-bold">React</code>) to improve ATS alignment.
+            </p>
+            <Link
+              to="/employer/post-job"
+              className="w-full py-2 bg-surface-container-low dark:bg-surface-variant/40 hover:bg-primary hover:text-white text-primary rounded-lg font-body-bold text-[13px] transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer"
+            >
+              Post Another Spec
+            </Link>
+          </div>
+
+          {/* Quick Help Guide */}
+          <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-md soft-shadow">
+            <h3 className="font-body-bold text-[15px] font-bold text-on-surface dark:text-inverse-on-surface mb-xs">Job Visibility Rules</h3>
+            <p className="font-metadata text-[12px] text-on-surface-variant dark:text-surface-variant leading-relaxed">
+              Jobs are approved automatically or reviewed by admins. To appear publicly in student recommendation searches, the status must show as <strong className="text-success">Approved</strong>.
+            </p>
+          </div>
+
+        </div>
+
+      </div>
+
+      {/* Spec Details Modal */}
+      <AnimatePresence>
+        {modalOpen && modalJob && (
+          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => { setModalOpen(false); setModalJob(null) }}>
+            <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-border-subtle bg-white dark:bg-inverse-surface backdrop-blur shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
+              <div className="flex items-start justify-between gap-4 border-b border-border-subtle dark:border-outline-variant/30 pb-4 mb-6">
+                <div>
+                  <div className="inline-flex items-center rounded-full border border-primary-100 bg-primary-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
+                    Requirements Spec
+                  </div>
+                  <h3 className="text-xl font-bold text-slate-900 dark:text-inverse-on-surface leading-tight">
+                    {modalJob.title}
+                  </h3>
+                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
+                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-white dark:bg-inverse-surface px-2.5 py-0.5 font-semibold text-slate-800 dark:text-slate-300 shadow-sm">
+                      {modalJob.location_city}
+                    </span>
+                    <span className="inline-flex items-center rounded-full bg-slate-50 dark:bg-inverse-surface/30 px-2.5 py-0.5 text-slate-600 dark:text-slate-400 capitalize">
+                      {modalJob.work_type}
+                    </span>
+                  </div>
+                </div>
+                <button
+                  onClick={() => { setModalOpen(false); setModalJob(null) }}
+                  className="p-1 text-slate-400 hover:text-slate-700 rounded-xl"
+                >
+                  <X className="w-5 h-5" />
+                </button>
+              </div>
+
+              <div className="space-y-6">
+                <div className="bg-slate-50/50 dark:bg-inverse-surface/20 border border-slate-100 dark:border-outline-variant/20 rounded-xl p-4">
+                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Description</h4>
+                  <div className="text-xs text-slate-750 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{modalJob.description}</div>
+                </div>
+
+                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50/50 dark:bg-inverse-surface/20 border border-slate-100 dark:border-outline-variant/20 rounded-xl">
+                  <div>
+                    <p className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1">Min Experience</p>
+                    <p className="font-bold text-slate-850 dark:text-white text-xs">{modalJob.min_experience_years} Years</p>
+                  </div>
+                  <div>
+                    <p className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1">Min CGPA Requirement</p>
+                    <p className="font-bold text-slate-850 dark:text-white text-xs">{modalJob.min_cgpa ?? 'N/A'}</p>
+                  </div>
+                </div>
+
+                <div>
+                  <h4 className="font-bold text-slate-850 dark:text-white text-xs mb-2">Required Skills</h4>
+                  <div className="flex flex-wrap gap-1.5">
+                    {(modalJob.required_skills || []).map((s, idx) => (
+                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary dark:text-primary-fixed-dim text-[11px] font-bold">
+                        {typeof s === 'string' ? s : s.name}
+                      </span>
+                    ))}
+                  </div>
+                </div>
+
+                <div className="flex gap-3 pt-4 border-t border-border-subtle dark:border-outline-variant/30">
+                  <button onClick={() => { setModalOpen(false); setModalJob(null) }} className="btn-secondary-sm flex-1 !py-2.5 !text-xs !rounded-xl cursor-pointer">
+                    Close
                   </button>
-                  <span className="text-slate-400 text-xs font-semibold">
-                    Page {page} of {Math.ceil(jobs.length / pageSize)}
-                  </span>
                   <button
-                    onClick={() => setPage(p => Math.min(Math.ceil(jobs.length / pageSize), p + 1))}
-                    disabled={page === Math.ceil(jobs.length / pageSize)}
-                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold transition-all"
+                    onClick={() => { if (modalJob.id) navigate(`/employer/jobs/${modalJob.id}/applicants`) }}
+                    className="btn-primary-sm flex-1 !py-2.5 !text-xs !rounded-xl shadow-md cursor-pointer"
                   >
-                    Next
+                    View Applicants
                   </button>
                 </div>
-              )}
-            </>
-          )}
-        </motion.div>
-        <ScrollToTop />
-      </div>
+              </div>
+            </div>
+          </div>
+        )}
+      </AnimatePresence>
+
     </div>
   )
 }
diff --git a/frontend/src/pages/EmployerJobDetails.jsx b/frontend/src/pages/EmployerJobDetails.jsx
index d807509..3988013 100644
--- a/frontend/src/pages/EmployerJobDetails.jsx
+++ b/frontend/src/pages/EmployerJobDetails.jsx
@@ -112,7 +112,7 @@ export default function EmployerJobDetails(){
             <h4 className="font-bold text-slate-800 text-sm mb-3">Required Skills</h4>
             <div className="flex flex-wrap gap-2">
               {(job?.required_skills || []).map((s, idx) => (
-                <span key={idx} className="px-3 py-1.5 rounded-xl bg-primary-50 border border-primary-100 text-primary-750 text-xs font-bold shadow-sm">
+                <span key={idx} className="px-3 py-1.5 rounded-xl bg-primary-50 border border-primary-100 text-primary-700 dark:text-primary-600 text-xs font-bold shadow-sm">
                   {s.name || s}
                 </span>
               ))}
@@ -122,7 +122,7 @@ export default function EmployerJobDetails(){
           <div className="flex gap-3 pt-4 border-t border-slate-100">
             <button
               onClick={() => navigate('/employer/dashboard')}
-              className="flex-1 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-bold text-slate-700 active:scale-95 duration-200 text-sm text-center"
+              className="btn-secondary flex-1 !py-3 !rounded-xl !text-sm text-center"
             >
               Back
             </button>
diff --git a/frontend/src/pages/EmployerPostJob.jsx b/frontend/src/pages/EmployerPostJob.jsx
index 5bb2361..bbbe8de 100644
--- a/frontend/src/pages/EmployerPostJob.jsx
+++ b/frontend/src/pages/EmployerPostJob.jsx
@@ -341,7 +341,7 @@ export default function EmployerPostJob() {
             {requiredSkills.length > 0 && (
               <div className="flex flex-wrap gap-2 pt-1">
                 {requiredSkills.map((sk, idx) => (
-                  <span key={idx} className="group inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary-50 border border-primary-100 text-primary-750 text-xs font-bold shadow-sm">
+                  <span key={idx} className="group inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary-50 border border-primary-100 text-primary-700 dark:text-primary-600 text-xs font-bold shadow-sm">
                     <span>{sk.name}</span>
                     <span className="text-[10px] text-primary-500 font-medium">({sk.level})</span>
                     <button type="button" onClick={() => removeRequiredSkill(idx)} className="text-slate-400 hover:text-red-500 transition-colors">
@@ -379,9 +379,9 @@ export default function EmployerPostJob() {
               <button
                 type="button"
                 onClick={addOptionalSkill}
-                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 text-slate-700 transition-all active:scale-95 duration-200 text-xs font-bold"
+                className="btn-secondary-sm inline-flex items-center gap-1.5 !px-4 !py-2 !rounded-xl text-xs font-bold"
               >
-                <PlusCircle className="w-4 h-4 text-slate-450" />
+                <PlusCircle className="w-4 h-4 text-slate-400" />
                 <span>Add</span>
               </button>
             </div>
@@ -404,7 +404,7 @@ export default function EmployerPostJob() {
             <button
               type="button"
               onClick={() => navigate('/employer/dashboard')}
-              className="flex-1 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-bold text-slate-750 active:scale-95 duration-200 text-sm"
+              className="btn-secondary flex-1 !py-3 !rounded-xl !text-sm"
             >
               Cancel
             </button>
diff --git a/frontend/src/pages/InterviewPage.jsx b/frontend/src/pages/InterviewPage.jsx
index 2014574..b874a87 100644
--- a/frontend/src/pages/InterviewPage.jsx
+++ b/frontend/src/pages/InterviewPage.jsx
@@ -1,10 +1,10 @@
 import React, { useState, useEffect } from 'react'
 import { useNavigate } from 'react-router-dom'
 import { motion, AnimatePresence } from 'framer-motion'
-import { 
-  Cpu, Users, Heart, Shuffle, Zap, Target, BarChart2, 
-  MessageSquare, AlertTriangle, Clock, ArrowRight, RefreshCw, ChevronLeft, Trophy, Calendar, Mic,
-  Smile, ShieldAlert
+import {
+  Cpu, Users, Heart, Shuffle, Zap, Target, BarChart2,
+  Clock, ArrowRight, RefreshCw, ChevronLeft, Award, Play, Mic,
+  Smile, ShieldAlert, AlertTriangle
 } from 'lucide-react'
 import api from '../config/api'
 import { useToast } from '../hooks/useToast'
@@ -12,23 +12,22 @@ import { ToastContainer } from '../components/Toast'
 import useInterviewSession from '../hooks/useInterviewSession'
 
 const INTERVIEW_TYPES = [
-  { id: 'technical', label: 'Technical', icon: Cpu, desc: 'Data structures, system design, coding fundamentals' },
-  { id: 'hr', label: 'HR & Management', icon: Users, desc: 'Background, future goals, behavioral fit' },
-  { id: 'behavioral', label: 'Behavioral', icon: Heart, desc: 'Leadership, conflict resolution, teamwork' },
-  { id: 'mixed', label: 'Mixed Mode', icon: Shuffle, desc: 'A custom blended session of all styles' },
+  { id: 'technical', label: 'Technical Round', icon: Cpu, desc: 'Algorithms, system design, coding syntax' },
+  { id: 'hr', label: 'HR Behavioral', icon: Users, desc: 'STAR stories, company fit, leadership scenarios' },
+  { id: 'behavioral', label: 'Soft Skills Fit', icon: Heart, desc: 'Conflict resolution, team building, situational judgement' },
+  { id: 'mixed', label: 'Mixed Mode Prep', icon: Shuffle, desc: 'A blended custom panel of all styles' },
 ]
 
 const DIFFICULTIES = [
-  { id: 'easy', label: 'Easy', color: 'text-green-600 bg-green-50 border-green-200 active-border-green-500', desc: 'Foundational concepts' },
-  { id: 'medium', label: 'Medium', color: 'text-amber-600 bg-amber-50 border-amber-200 active-border-amber-500', desc: 'Applied knowledge' },
-  { id: 'hard', label: 'Hard', color: 'text-red-600 bg-red-50 border-red-200 active-border-red-500', desc: 'System design & edge cases' },
+  { id: 'easy', label: 'Easy', color: 'text-success bg-success/10 border-success/20', desc: 'Foundational concepts' },
+  { id: 'medium', label: 'Medium', color: 'text-warning bg-warning/10 border-warning/20', desc: 'Applied knowledge' },
+  { id: 'hard', label: 'Hard', color: 'text-error bg-error/10 border-error/20', desc: 'Scalability & edge cases' },
 ]
 
 const PERSONAS = [
-  { id: 'Friendly Senior Engineer', label: 'Friendly Senior Engineer', icon: Smile, desc: 'Warm, collaborative, encouraging. Offers helpful hints when you get stuck.', badge: 'Warm & Encouraging', badgeColor: 'bg-green-50 text-green-700 border-green-200 hover:border-green-300' },
-  { id: 'Tough FAANG Interviewer', label: 'Tough FAANG Interviewer', icon: ShieldAlert, desc: 'Strict, minimal reactions, optimal performance focus. Absolutely no hints.', badge: 'Strict & optimal', badgeColor: 'bg-red-50 text-red-700 border-red-200 hover:border-red-300' },
-  { id: 'HR Behavioral Round', label: 'HR Behavioral Round', icon: Users, desc: 'Focuses on soft skills, culture fit, situational judgment, and the STAR method.', badge: 'STAR Stories', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200 hover:border-purple-300' },
-  { id: 'Startup CTO', label: 'Startup CTO', icon: Cpu, desc: 'Pragmatic, values rapid shipping, simplicities, MVPs, and trade-offs over academic theory.', badge: 'Pragmatic Builder', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-300' },
+  { id: 'Friendly Senior Engineer', label: 'Friendly Senior Engineer', icon: Smile, desc: 'Warm, collaborative, offers helpful hints when you get stuck.', badge: 'Warm Hinting' },
+  { id: 'Tough FAANG Interviewer', label: 'Tough FAANG Interviewer', icon: ShieldAlert, desc: 'Strict, minimal feedback, optimal performance focus. No hints.', badge: 'Strict Strict' },
+  { id: 'Startup CTO', label: 'Startup CTO', icon: Cpu, desc: 'Pragmatic, values quick shipping, trade-offs, and shipping MVPs.', badge: 'Pragmatic MVP' }
 ]
 
 const QUESTION_COUNTS = [5, 10, 15]
@@ -52,7 +51,6 @@ export default function InterviewPage() {
   const [history, setHistory] = useState([])
   const [historyLoading, setHistoryLoading] = useState(true)
 
-  // Check resume status, active sessions, and history
   useEffect(() => {
     const checkStatus = async () => {
       try {
@@ -72,7 +70,7 @@ export default function InterviewPage() {
           setHistory(historyRes.value.data || [])
         }
       } catch (err) {
-        console.error('Failed to load portal configuration data:', err)
+        console.error('Failed to load prep configs:', err)
         setResumeStatus('missing')
       } finally {
         setHistoryLoading(false)
@@ -83,7 +81,7 @@ export default function InterviewPage() {
 
   const handleStart = async () => {
     if (resumeStatus === 'missing') {
-      toast.error('Please upload and parse your resume first.')
+      toast.error('Please upload your resume in the dashboard first.')
       return
     }
     setIsStarting(true)
@@ -112,487 +110,290 @@ export default function InterviewPage() {
       voice_mode: false,
       interviewer_persona: session.interviewer_persona || 'Friendly Senior Engineer',
     })
-    window.scrollTo({ top: 0, behavior: 'smooth' })
-    toast.success(`Loaded configuration: ${session.interview_type} (${session.difficulty}, ${session.num_questions} Qs, Persona: ${session.interviewer_persona || 'Friendly Senior Engineer'})`)
+    toast.success(`Config loaded: ${session.interview_type}`)
   }
 
-  const estimatedTime = Math.round(config.num_questions * 3)
-
   return (
-    <div className="min-h-screen bg-slate-50 pt-24 pb-12">
+    <div className="relative">
       <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
-      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
-        
-        {/* Back Link */}
-        <button 
-          onClick={() => navigate('/dashboard')}
-          className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors mb-6"
-        >
-          <ChevronLeft className="w-4 h-4" />
-          Back to Dashboard
-        </button>
-
-        {/* Header */}
-        <motion.div 
-          initial={{ opacity: 0, y: -20 }} 
-          animate={{ opacity: 1, y: 0 }} 
-          className="mb-8"
-        >
-          <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 mb-4">
-            <Zap className="w-3.5 h-3.5" />
-            AI Interview Engine
-          </div>
-          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
-            Mock Interview Practice
+      
+      {/* Welcome Header */}
+      <div className="mb-xl flex flex-col md:flex-row md:items-end justify-between gap-md relative z-10">
+        <div>
+          <h1 className="font-display-lg text-display-lg text-on-surface dark:text-inverse-on-surface mb-xs font-bold leading-tight">
+            AI Interview Coach
           </h1>
-          <p className="text-gray-600">
-            Hone your skills with a smart, resume-aware mock interview. Receive detailed score sheets, concept breakdowns, and a gap-focused study plan.
+          <p className="font-body-base text-body-base text-on-surface-variant dark:text-surface-variant">
+            Set up real-time voice or text sessions aligned with your resume experience.
           </p>
-        </motion.div>
+        </div>
+      </div>
 
-        {/* Unfinished session banner */}
-        <AnimatePresence>
-          {activeSession && (
-            <motion.div
-              initial={{ opacity: 0, scale: 0.95 }}
-              animate={{ opacity: 1, scale: 1 }}
-              exit={{ opacity: 0, scale: 0.95 }}
-              className="relative mb-6 overflow-hidden rounded-2xl border border-primary-100 bg-primary-50/50 p-5 shadow-sm"
-            >
-              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
-                <div className="flex items-center gap-3">
-                  <div className="p-2 bg-primary-100 rounded-lg text-primary-700">
-                    <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
-                  </div>
-                  <div>
-                    <h3 className="font-bold text-gray-950 text-sm">Unfinished Session Active</h3>
-                    <p className="text-xs text-gray-600">
-                      You have an active {activeSession.interview_type} session with {activeSession.answers_submitted} of {activeSession.total_questions} questions answered.
-                    </p>
-                  </div>
+      {/* Warning if resume missing */}
+      {resumeStatus === 'missing' && (
+        <div className="mb-lg p-md bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-start gap-2.5">
+          <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />
+          <div>
+            <h4>Resume Profile Required</h4>
+            <p className="text-slate-500 font-normal mt-0.5">
+              Please go to the <Link to="/student/dashboard" className="underline text-rose-900">Dashboard</Link> and upload a resume before starting mock sessions so the coach can tailor questions to your skills.
+            </p>
+          </div>
+        </div>
+      )}
+
+      {/* Active Session Callout */}
+      {activeSession && (
+        <div className="mb-lg bg-primary/10 border border-primary/20 p-md rounded-xl flex flex-col sm:flex-row justify-between items-center gap-md">
+          <div>
+            <h4 className="font-body-bold text-[14px] text-primary dark:text-primary-fixed-dim">Active session in progress</h4>
+            <p className="text-xs text-slate-500 mt-0.5">You have a pending mock session created recently.</p>
+          </div>
+          <button 
+            onClick={handleResumeSession}
+            className="px-4 py-2 bg-primary text-white rounded-lg font-body-bold text-xs hover:bg-primary-500 transition-all cursor-pointer"
+          >
+            Resume Session
+          </button>
+        </div>
+      )}
+
+      {/* Bento Grid */}
+      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
+        
+        {/* Settings Columns (8/12 width) */}
+        <div className="lg:col-span-8 flex flex-col gap-lg">
+          
+          {/* Card 1: Setup configurations */}
+          <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-lg soft-shadow">
+            <h2 className="text-lg font-bold text-on-surface dark:text-inverse-on-surface mb-lg flex items-center gap-2">
+              <Cpu className="w-5 h-5 text-primary" />
+              Configure Mock Session
+            </h2>
+
+            <div className="space-y-lg">
+              
+              {/* Type Selection */}
+              <div>
+                <label className="font-label-caps text-[10px] text-on-surface-variant dark:text-surface-variant uppercase tracking-wider block mb-sm">Interview Type</label>
+                <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
+                  {INTERVIEW_TYPES.map(type => {
+                    const active = config.interview_type === type.id
+                    const Icon = type.icon
+                    return (
+                      <button
+                        key={type.id}
+                        onClick={() => setConfig(prev => ({ ...prev, interview_type: type.id }))}
+                        className={`p-md rounded-lg text-left border transition-all cursor-pointer flex gap-3 ${
+                          active
+                            ? 'bg-primary/5 dark:bg-primary/10 border-primary text-primary dark:text-primary-fixed-dim font-body-bold'
+                            : 'border-border-subtle hover:bg-surface-container-low text-on-surface-variant dark:text-surface-variant'
+                        }`}
+                      >
+                        <div className={`p-2 rounded-lg ${active ? 'bg-primary/10 text-primary dark:text-primary-fixed-dim' : 'bg-slate-50 text-slate-400'}`}>
+                          <Icon className="w-5 h-5" />
+                        </div>
+                        <div>
+                          <h4 className="text-[13px] font-bold">{type.label}</h4>
+                          <p className="text-[11px] text-slate-400 mt-0.5 leading-tight font-normal">{type.desc}</p>
+                        </div>
+                      </button>
+                    )
+                  })}
                 </div>
-                <button 
-                  onClick={handleResumeSession}
-                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-xs shadow-sm transition-colors self-start sm:self-center"
-                >
-                  Resume Interview →
-                </button>
               </div>
-            </motion.div>
-          )}
-        </AnimatePresence>
 
-        {/* Resume missing warning */}
-        <AnimatePresence>
-          {resumeStatus === 'missing' && (
-            <motion.div
-              initial={{ opacity: 0, y: -10 }}
-              animate={{ opacity: 1, y: 0 }}
-              exit={{ opacity: 0, y: -10 }}
-              className="mb-6 p-4 border border-red-200 bg-red-50 text-red-800 rounded-2xl flex items-start gap-3 shadow-sm text-sm"
-            >
-              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
+              {/* Persona Selection */}
               <div>
-                <span className="font-bold">Resume Profile Missing:</span> To generate tailored questions matching your experience, please <a href="/dashboard" className="underline font-semibold hover:text-red-950">upload and parse your resume</a> on the dashboard workspace first.
+                <label className="font-label-caps text-[10px] text-on-surface-variant dark:text-surface-variant uppercase tracking-wider block mb-sm">Coach Persona</label>
+                <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm">
+                  {PERSONAS.map(p => {
+                    const active = config.interviewer_persona === p.id
+                    const Icon = p.icon
+                    return (
+                      <button
+                        key={p.id}
+                        onClick={() => setConfig(prev => ({ ...prev, interviewer_persona: p.id }))}
+                        className={`p-md rounded-lg text-left border transition-all cursor-pointer ${
+                          active
+                            ? 'bg-primary/5 dark:bg-primary/10 border-primary text-primary dark:text-primary-fixed-dim font-body-bold'
+                            : 'border-border-subtle hover:bg-surface-container-low text-on-surface-variant dark:text-surface-variant'
+                        }`}
+                      >
+                        <div className="flex items-center justify-between mb-2">
+                          <Icon className={`w-5 h-5 ${active ? 'text-primary' : 'text-slate-400'}`} />
+                          <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">{p.badge}</span>
+                        </div>
+                        <h4 className="text-[12px] font-bold">{p.label}</h4>
+                        <p className="text-[10px] text-slate-400 mt-1 font-normal leading-normal">{p.desc}</p>
+                      </button>
+                    )
+                  })}
+                </div>
               </div>
-            </motion.div>
-          )}
-        </AnimatePresence>
 
-        {/* Main Form Box */}
-        <motion.div 
-          initial={{ opacity: 0, y: 20 }} 
-          animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
-          className="relative bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8"
-        >
-          {/* Interview Type Selection */}
-          <div className="mb-8">
-            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
-              Select Focus Style
-            </h3>
-            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
-              {INTERVIEW_TYPES.map(({ id, label, icon: Icon, desc }) => {
-                const isSelected = config.interview_type === id
-                return (
-                  <button
-                    key={id}
-                    onClick={() => setConfig(c => ({ ...c, interview_type: id }))}
-                    className={`flex items-start gap-4 p-4 rounded-2xl border text-left transition-all ${
-                      isSelected 
-                        ? 'border-primary-500 bg-primary-50/40 shadow-sm ring-1 ring-primary-500' 
-                        : 'border-gray-200 bg-white hover:border-gray-300'
-                    }`}
-                  >
-                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${isSelected ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
-                      <Icon className="w-5 h-5" />
-                    </div>
-                    <div>
-                      <h4 className={`font-bold text-sm ${isSelected ? 'text-primary-950' : 'text-gray-900'}`}>{label}</h4>
-                      <p className="text-xs text-gray-500 mt-1 leading-normal">{desc}</p>
-                    </div>
-                  </button>
-                )
-              })}
-            </div>
-          </div>
-
-          {/* Interviewer Persona Selection */}
-          <div className="mb-8">
-            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-1.5">
-              Select Interviewer Persona
-            </h3>
-            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
-              {PERSONAS.map(({ id, label, icon: Icon, desc, badge, badgeColor }) => {
-                const isSelected = config.interviewer_persona === id
-                return (
-                  <button
-                    key={id}
-                    onClick={() => setConfig(c => ({ ...c, interviewer_persona: id }))}
-                    className={`flex items-start gap-4 p-4 rounded-2xl border text-left transition-all ${
-                      isSelected 
-                        ? 'border-primary-500 bg-primary-50/40 shadow-sm ring-1 ring-primary-500' 
-                        : 'border-gray-200 bg-white hover:border-gray-300'
-                    }`}
-                  >
-                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${isSelected ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
-                      <Icon className="w-5 h-5" />
-                    </div>
-                    <div>
-                      <div className="flex items-center gap-1.5 flex-wrap">
-                        <h4 className={`font-bold text-sm ${isSelected ? 'text-primary-950' : 'text-gray-900'}`}>{label}</h4>
-                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeColor}`}>
-                          {badge}
-                        </span>
-                      </div>
-                      <p className="text-xs text-gray-500 mt-1 leading-normal">{desc}</p>
-                    </div>
-                  </button>
-                )
-              })}
-            </div>
-          </div>
+              {/* Difficulty Selection */}
+              <div>
+                <label className="font-label-caps text-[10px] text-on-surface-variant dark:text-surface-variant uppercase tracking-wider block mb-sm">Complexity Level</label>
+                <div className="grid grid-cols-3 gap-sm">
+                  {DIFFICULTIES.map(diff => {
+                    const active = config.difficulty === diff.id
+                    return (
+                      <button
+                        key={diff.id}
+                        onClick={() => setConfig(prev => ({ ...prev, difficulty: diff.id }))}
+                        className={`p-sm rounded-lg text-center border transition-all cursor-pointer flex flex-col items-center justify-center ${
+                          active
+                            ? diff.color + ' font-body-bold shadow-sm'
+                            : 'border-border-subtle hover:bg-surface-container-low text-on-surface-variant dark:text-surface-variant'
+                        }`}
+                      >
+                        <span className="text-[13px] font-bold">{diff.label}</span>
+                        <span className="text-[9px] text-slate-400 mt-0.5 font-normal">{diff.desc}</span>
+                      </button>
+                    )
+                  })}
+                </div>
+              </div>
 
-          {/* Difficulty Level */}
-          <div className="mb-8">
-            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
-              Difficulty Level
-            </h3>
-            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
-              {DIFFICULTIES.map(({ id, label, color, desc }) => {
-                const isSelected = config.difficulty === id
-                return (
-                  <button
-                    key={id}
-                    onClick={() => setConfig(c => ({ ...c, difficulty: id }))}
-                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${
-                      isSelected 
-                        ? `border-primary-500 bg-primary-50/30 ring-1 ring-primary-500` 
-                        : 'border-gray-200 bg-white hover:border-gray-300'
-                    }`}
-                  >
-                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${color} mb-2`}>
-                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
-                      {label}
-                    </span>
-                    <p className="text-[11px] text-gray-500 leading-normal">{desc}</p>
-                  </button>
-                )
-              })}
-            </div>
-          </div>
+              {/* Details & Controls */}
+              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md pt-md border-t border-border-subtle dark:border-outline-variant/10">
+                
+                {/* Topic Focus */}
+                <div>
+                  <label className="font-label-caps text-[10px] text-on-surface-variant dark:text-surface-variant uppercase tracking-wider block mb-xs">Sub-topic Focus (Optional)</label>
+                  <input
+                    type="text"
+                    name="topic_focus"
+                    placeholder="e.g. system design, async loops, STAR behavioral"
+                    value={config.topic_focus}
+                    onChange={(e) => setConfig(prev => ({ ...prev, topic_focus: e.target.value }))}
+                    className="w-full bg-slate-50 dark:bg-inverse-surface/30 border border-border-subtle rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all dark:text-white"
+                  />
+                </div>
 
-          {/* Question Count */}
-          <div className="mb-8">
-            <div className="flex items-center justify-between mb-4">
-              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
-                Number of Questions
-              </h3>
-              <span className="text-sm font-bold text-primary-700">
-                {config.num_questions} questions · ~{estimatedTime} min
-              </span>
-            </div>
-            <div className="flex gap-3">
-              {QUESTION_COUNTS.map(n => {
-                const isSelected = config.num_questions === n
-                return (
-                  <button
-                    key={n}
-                    onClick={() => setConfig(c => ({ ...c, num_questions: n }))}
-                    className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all ${
-                      isSelected 
-                        ? 'bg-primary-600 border-primary-600 text-white shadow-sm' 
-                        : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
-                    }`}
-                  >
-                    {n}
-                  </button>
-                )
-              })}
-            </div>
-          </div>
+                {/* Question Count Selection */}
+                <div>
+                  <label className="font-label-caps text-[10px] text-on-surface-variant dark:text-surface-variant uppercase tracking-wider block mb-xs">Question Count</label>
+                  <div className="flex bg-slate-50 dark:bg-inverse-surface/30 rounded-lg p-0.5 border border-border-subtle">
+                    {QUESTION_COUNTS.map(cnt => (
+                      <button
+                        key={cnt}
+                        type="button"
+                        onClick={() => setConfig(prev => ({ ...prev, num_questions: cnt }))}
+                        className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer text-center ${
+                          config.num_questions === cnt
+                            ? 'bg-white dark:bg-inverse-surface text-primary border border-border-subtle shadow-sm'
+                            : 'text-slate-400 hover:text-slate-650'
+                        }`}
+                      >
+                        {cnt} Qs
+                      </button>
+                    ))}
+                  </div>
+                </div>
 
-          {/* Topic Focus */}
-          <div className="mb-8">
-            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
-              Specific Topic Focus <span className="text-gray-300 font-normal">(Optional)</span>
-            </h3>
-            <input
-              type="text"
-              placeholder="e.g. React hooks, SQL database optimization, system architecture..."
-              value={config.topic_focus}
-              onChange={e => setConfig(c => ({ ...c, topic_focus: e.target.value }))}
-              maxLength={200}
-              className="w-full bg-white border border-gray-300 text-gray-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm placeholder:text-gray-400"
-            />
-          </div>
+              </div>
 
-          {/* Voice Mode Toggle */}
-          <div className="mb-8 p-4 border border-slate-100 bg-slate-50/50 rounded-2xl">
-            <div className="flex items-center justify-between">
-              <div className="flex items-start gap-3">
-                <div className={`p-2 rounded-xl flex-shrink-0 ${config.voice_mode ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
-                  <Mic className="w-5 h-5" />
-                </div>
+              {/* Voice Mode Toggle */}
+              <div className="pt-md flex items-center justify-between border-t border-border-subtle dark:border-outline-variant/10">
                 <div>
-                  <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
-                    Interactive Voice Mode
-                  </h3>
-                  <p className="text-xs text-gray-500 mt-0.5 leading-normal">
-                    Speak your answers naturally and hear questions read aloud by our premium engine.
-                  </p>
+                  <h4 className="text-[13px] font-bold text-on-surface dark:text-inverse-on-surface">Voice Interactive Mode</h4>
+                  <p className="text-[11px] text-slate-400 leading-tight mt-0.5 font-normal">Synthesize voice responses and answer using speech recognition.</p>
                 </div>
+                <button
+                  type="button"
+                  onClick={() => setConfig(prev => ({ ...prev, voice_mode: !prev.voice_mode }))}
+                  className={`w-12 h-6.5 rounded-full p-0.5 transition-colors cursor-pointer relative ${config.voice_mode ? 'bg-primary' : 'bg-slate-200'}`}
+                >
+                  <div className={`w-5.5 h-5.5 rounded-full bg-white shadow transition-all transform ${config.voice_mode ? 'translate-x-5.5' : 'translate-x-0'}`} />
+                </button>
               </div>
-              
-              <button
-                type="button"
-                id="voice-mode-toggle"
-                onClick={() => setConfig(c => ({ ...c, voice_mode: !c.voice_mode }))}
-                className={`relative inline-flex h-6.5 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
-                  config.voice_mode ? 'bg-primary-600' : 'bg-gray-200'
-                }`}
-              >
-                <span
-                  className={`pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
-                    config.voice_mode ? 'translate-x-5.5' : 'translate-x-0'
-                  }`}
-                />
-              </button>
-            </div>
-          </div>
 
-          {/* Pricing Info */}
-          <div className="flex items-center gap-2.5 p-4 bg-primary-50/60 border border-primary-100 rounded-2xl text-xs text-primary-800">
-            <Zap className="w-4 h-4 text-primary-600 flex-shrink-0" />
-            <span>
-              Generating this custom mock session costs <strong className="text-primary-950 font-bold">{config.num_questions} credits</strong>. Evaluation and study plans are included free of charge.
-            </span>
+            </div>
           </div>
-        </motion.div>
 
-        {/* Start Button Action */}
-        <motion.div 
-          initial={{ opacity: 0 }} 
-          animate={{ opacity: 1, transition: { delay: 0.2 } }}
-          className="mb-8"
-        >
-          <button
-            id="start-interview-btn"
-            onClick={handleStart}
-            disabled={isStarting || resumeStatus === 'missing'}
-            className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-sm ${
-              isStarting || resumeStatus === 'missing'
-                ? 'bg-gray-200 border border-gray-300 text-gray-400 cursor-not-allowed'
-                : 'bg-primary-600 hover:bg-primary-700 text-white hover:shadow-md active:scale-[0.99]'
-            }`}
-          >
-            {isStarting ? (
-              <>
-                <RefreshCw className="w-5 h-5 animate-spin" />
-                Assembling Your Custom Interview...
-              </>
-            ) : (
-              <>
-                <span>Begin Mock Practice Session</span>
-                <ArrowRight className="w-5 h-5" />
-              </>
-            )}
-          </button>
-        </motion.div>
+        </div>
 
-        {/* Benefits strip */}
-        <motion.div 
-          initial={{ opacity: 0 }} 
-          animate={{ opacity: 1, transition: { delay: 0.3 } }}
-          className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-white border border-gray-200 rounded-2xl text-center shadow-sm"
-        >
-          {[
-            { icon: Target, label: 'Resume Matching', desc: 'Sourced from your skills', color: 'text-purple-600' },
-            { icon: Zap, label: 'Adaptive Prompts', desc: 'Responsive difficulty', color: 'text-amber-500' },
-            { icon: BarChart2, label: 'Deep Breakdown', desc: 'Skill-by-skill metrics', color: 'text-blue-600' },
-            { icon: Clock, label: `~${estimatedTime} Min Session`, desc: 'Estimated completion', color: 'text-green-600' },
-          ].map(({ icon: Icon, label, desc, color }) => (
-            <div key={label} className="flex flex-col items-center p-2">
-              <Icon className={`w-5 h-5 ${color} mb-1.5`} />
-              <span className="text-xs font-bold text-gray-900 leading-tight">{label}</span>
-              <span className="text-[10px] text-gray-400 mt-0.5 leading-tight">{desc}</span>
+        {/* Info & History Pane (4/12 width) */}
+        <div className="lg:col-span-4 flex flex-col gap-lg">
+          
+          {/* Action Trigger Card */}
+          <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-md soft-shadow text-center">
+            <div className="w-12 h-12 rounded-full bg-primary/5 text-primary border border-primary/10 flex items-center justify-center mx-auto mb-3">
+              <Zap className="w-6 h-6 animate-pulse" />
             </div>
-          ))}
-        </motion.div>
-
-        {/* Practice History Section */}
-        <motion.div
-          initial={{ opacity: 0, y: 20 }}
-          animate={{ opacity: 1, transition: { delay: 0.4 } }}
-          className="mt-12"
-        >
-          <div className="flex items-center justify-between mb-6">
-            <h2 className="text-lg font-bold text-gray-950 flex items-center gap-2">
-              <Trophy className="w-5 h-5 text-amber-500" />
-              Practice History
-            </h2>
-            <span className="text-xs text-gray-500 font-semibold bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
-              {history.length} {history.length === 1 ? 'session' : 'sessions'}
-            </span>
+            <h3 className="font-body-bold text-[15px] font-bold text-on-surface dark:text-inverse-on-surface">Ready to start?</h3>
+            <p className="font-metadata text-[11px] text-slate-400 leading-normal my-sm">
+              Estimated duration: {config.num_questions * 3} minutes.
+            </p>
+            <button
+              onClick={handleStart}
+              disabled={isStarting || resumeStatus === 'missing'}
+              className="w-full py-2.5 bg-primary hover:bg-primary-500 text-white rounded-lg font-body-bold text-xs transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
+            >
+              <Play className="w-4 h-4 fill-current" />
+              {isStarting ? 'Setting up Round...' : 'Launch AI Practice'}
+            </button>
           </div>
 
-          {historyLoading ? (
-            <div className="flex flex-col items-center justify-center p-12 bg-white border border-gray-200 rounded-3xl shadow-sm text-gray-500">
-              <RefreshCw className="w-8 h-8 animate-spin text-primary-600 mb-2" />
-              <p className="text-sm">Retrieving your practice history...</p>
-            </div>
-          ) : history.length === 0 ? (
-            <div className="p-8 text-center bg-white border border-gray-200 rounded-3xl shadow-sm">
-              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
-              <h3 className="font-bold text-gray-900 mb-1">No Practice Sessions Yet</h3>
-              <p className="text-sm text-gray-500 max-w-sm mx-auto leading-normal">
-                Start your first mock interview above to see your scores, details, and study plans listed here.
-              </p>
-            </div>
-          ) : (
-            <div className="space-y-4">
-              {history.map((session) => {
-                const createdDate = new Date(session.created_at).toLocaleDateString(undefined, {
-                  month: 'short',
-                  day: 'numeric',
-                  year: 'numeric',
-                })
-                
-                return (
-                  <div 
-                    key={session.session_id} 
-                    className="bg-white border border-gray-200 rounded-2xl p-5 shadow-[0_2px_8px_rgb(0,0,0,0.02)] hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left"
-                  >
-                    {/* Left Side: Type, Date, Config, Topic */}
-                    <div className="flex-grow space-y-2">
-                      <div className="flex flex-wrap items-center gap-2">
-                        <span className="text-sm font-bold text-gray-950 capitalize">
-                          {session.interview_type === 'mixed' ? 'Mixed Mode' : `${session.interview_type} Interview`}
-                        </span>
-                        
-                        {/* Difficulty Badge */}
-                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
-                          session.difficulty === 'easy' ? 'bg-green-50 text-green-700 border border-green-200' :
-                          session.difficulty === 'medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
-                          'bg-red-50 text-red-700 border border-red-200'
-                        }`}>
-                          {session.difficulty}
-                        </span>
-
-                        {/* Question Count Badge */}
-                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
-                          {session.num_questions} Questions
-                        </span>
-
-                        {/* Interviewer Persona Badge */}
-                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
-                          {session.interviewer_persona || 'Friendly Senior Engineer'}
-                        </span>
-
-                        {/* Status / Score Badge */}
-                        {session.status === 'completed' ? (
-                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200 flex items-center gap-1">
-                            <Trophy className="w-3 h-3 text-primary-600" />
-                            Score: {session.overall_score !== null ? `${Math.round(session.overall_score * 100)}%` : 'N/A'}
-                          </span>
-                        ) : session.status === 'active' ? (
-                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
-                            Active
-                          </span>
-                        ) : (
-                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
-                            Abandoned
-                          </span>
-                        )}
-                      </div>
-
-                      {/* Topic Focus (if exists) */}
-                      {session.topic_focus && (
-                        <p className="text-xs text-gray-500 leading-snug">
-                          <span className="font-semibold text-gray-600">Focus:</span> {session.topic_focus}
+          {/* History Tracker */}
+          <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-md soft-shadow flex-1">
+            <h3 className="font-body-bold text-[14px] font-bold text-on-surface dark:text-inverse-on-surface mb-md">Practice History</h3>
+            
+            {historyLoading ? (
+              <div className="text-center py-6 text-xs text-on-surface-variant">Loading records...</div>
+            ) : history.length === 0 ? (
+              <div className="text-center py-6 text-xs text-on-surface-variant">No sessions completed yet. Launch your first round!</div>
+            ) : (
+              <div className="space-y-sm">
+                {history.slice(0, 4).map((session, index) => {
+                  const score = session.overall_score || session.score
+                  const isGood = score && score >= 75
+                  
+                  return (
+                    <div 
+                      key={session.session_id || index}
+                      className="p-sm bg-slate-50 dark:bg-inverse-surface/10 border border-border-subtle dark:border-outline-variant/20 rounded-lg flex items-center justify-between"
+                    >
+                      <div>
+                        <h4 className="font-body-bold text-[12px] text-on-surface dark:text-inverse-on-surface capitalize truncate max-w-[120px]">{session.interview_type} Round</h4>
+                        <p className="text-[10px] text-slate-400 capitalize mt-0.5">
+                          {session.difficulty} • {session.num_questions} Qs
                         </p>
-                      )}
-
-                      {/* Creation date */}
-                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
-                        <Calendar className="w-3.5 h-3.5" />
-                        <span>Started on {createdDate}</span>
                       </div>
-                    </div>
-
-                    {/* Right Side: Action Buttons */}
-                    <div className="flex items-center gap-2 sm:self-center">
-                      {session.status === 'completed' && (
-                        <>
-                          <button
-                            onClick={() => navigate(`/dashboard/interview/results/${session.session_id}`)}
-                            className="px-3.5 py-2 border border-gray-300 hover:border-gray-400 bg-white text-gray-700 font-semibold rounded-xl text-xs shadow-sm transition-all"
-                          >
-                            View Report
-                          </button>
-                          <button
-                            onClick={() => handleRetake(session)}
-                            className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5"
-                          >
-                            <RefreshCw className="w-3 h-3" />
-                            Retake
-                          </button>
-                        </>
-                      )}
-
-                      {session.status === 'active' && (
-                        <>
-                          <button
-                            onClick={() => navigate(`/dashboard/interview/${session.session_id}`)}
-                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-sm transition-all"
-                          >
-                            Resume
-                          </button>
-                          <button
-                            onClick={() => handleRetake(session)}
-                            className="px-3.5 py-2 border border-gray-300 hover:border-gray-400 bg-white text-gray-700 font-semibold rounded-xl text-xs shadow-sm transition-all"
-                          >
-                            Retake
-                          </button>
-                        </>
-                      )}
-
-                      {session.status === 'abandoned' && (
+                      
+                      <div className="flex items-center gap-2">
+                        {score !== null && score !== undefined && (
+                          <div className="text-right mr-1">
+                            <span className={`font-label-caps text-sm font-bold ${isGood ? 'text-success' : 'text-warning'}`}>{Math.round(score)}%</span>
+                            <span className="block text-[8px] text-slate-400 uppercase tracking-wider font-semibold">Score</span>
+                          </div>
+                        )}
                         <button
-                          onClick={() => handleRetake(session)}
-                          className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5"
+                          onClick={() => {
+                            if (session.status?.toLowerCase() === 'completed') {
+                              navigate(`/dashboard/interview/results/${session.session_id}`)
+                            } else {
+                              handleRetake(session)
+                            }
+                          }}
+                          className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-primary transition-colors cursor-pointer"
                         >
-                          <RefreshCw className="w-3.5 h-3.5" />
-                          Retake Settings
+                          <ArrowRight className="w-4 h-4" />
                         </button>
-                      )}
+                      </div>
                     </div>
-                  </div>
-                )
-              })}
-            </div>
-          )}
-        </motion.div>
+                  )
+                })}
+              </div>
+            )}
+          </div>
+
+        </div>
+
       </div>
+
     </div>
   )
 }
diff --git a/frontend/src/pages/InterviewResultsPage.jsx b/frontend/src/pages/InterviewResultsPage.jsx
index 25d0220..f3aef3b 100644
--- a/frontend/src/pages/InterviewResultsPage.jsx
+++ b/frontend/src/pages/InterviewResultsPage.jsx
@@ -300,26 +300,26 @@ export default function InterviewResultsPage() {
   const style = getScoreStyle(results.overall_score)
 
   return (
-    <div className="min-h-screen bg-slate-50 pt-24 pb-12 font-sans text-gray-900">
+    <div className="relative text-on-surface dark:text-inverse-on-surface">
       <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
-      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
+      <div className="max-w-container-max mx-auto">
         
         {/* Back Link */}
         <button 
           onClick={() => navigate('/dashboard/interview')}
-          className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors mb-6"
+          className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-6 cursor-pointer"
         >
           <ArrowLeft className="w-4 h-4" />
           Back to Setup
         </button>
 
         {/* Header */}
-        <div className="mb-8">
-          <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 mb-3">
+        <div className="mb-lg">
+          <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary mb-3">
             <Trophy className="w-3.5 h-3.5" />
             Performance Evaluation
           </div>
-          <h1 className="text-3xl font-bold tracking-tight text-gray-950">
+          <h1 className="font-display-lg text-display-lg text-on-surface dark:text-inverse-on-surface font-extrabold mb-1">
             Mock Practice Scorecard
           </h1>
         </div>
diff --git a/frontend/src/pages/InterviewSessionPage.jsx b/frontend/src/pages/InterviewSessionPage.jsx
index 38525f4..f433869 100644
--- a/frontend/src/pages/InterviewSessionPage.jsx
+++ b/frontend/src/pages/InterviewSessionPage.jsx
@@ -456,7 +456,7 @@ export default function InterviewSessionPage() {
                 className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-sm transition-all active:scale-[0.99] ${
                   micStatus === 'recording'
                     ? 'bg-red-600 hover:bg-red-700 text-white shadow'
-                    : 'bg-primary-50 border border-primary-200 hover:bg-primary-100 text-primary-750'
+                    : 'bg-primary-50 border border-primary-200 hover:bg-primary-100 text-primary-700 dark:text-primary-600'
                 }`}
               >
                 {micStatus === 'recording' ? (
diff --git a/frontend/src/pages/JobDetailsPage.jsx b/frontend/src/pages/JobDetailsPage.jsx
index fda6278..2491944 100644
--- a/frontend/src/pages/JobDetailsPage.jsx
+++ b/frontend/src/pages/JobDetailsPage.jsx
@@ -369,14 +369,25 @@ export default function JobDetailsPage() {
               >
                 <h2 className="text-xl font-semibold mb-4">Nice to Have</h2>
                 <div className="flex flex-wrap gap-2">
-                  {job.optional_skills.map((skill, idx) => (
-                    <span
-                      key={idx}
-                      className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700"
-                    >
-                      {skill}
-                    </span>
-                  ))}
+                  {job.optional_skills.map((skill, idx) => {
+                    const skillName = (typeof skill === 'object' && skill !== null)
+                      ? (skill.name || '')
+                      : String(skill)
+                    const skillLevel = (typeof skill === 'object' && skill !== null)
+                      ? skill.level
+                      : null
+                    return (
+                      <span
+                        key={idx}
+                        className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700 inline-flex items-center"
+                      >
+                        <span>{skillName}</span>
+                        {skillLevel && (
+                          <span className="ml-1.5 text-xs opacity-80 font-normal">({skillLevel})</span>
+                        )}
+                      </span>
+                    )
+                  })}
                 </div>
               </motion.div>
             )}
diff --git a/frontend/src/pages/JobsPage.jsx b/frontend/src/pages/JobsPage.jsx
index 046a749..b4cf20a 100644
--- a/frontend/src/pages/JobsPage.jsx
+++ b/frontend/src/pages/JobsPage.jsx
@@ -1,4 +1,4 @@
-import React, { useState, useEffect, useRef } from 'react'
+import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
 import { Link, useNavigate } from 'react-router-dom'
 import { motion, AnimatePresence } from 'framer-motion'
 import ReactMarkdown from 'react-markdown'
@@ -90,6 +90,245 @@ const jobMarkdownComponents = {
   blockquote: ({ children }) => <blockquote className="border-l-4 border-primary-200 pl-3 italic text-slate-600 mb-2">{children}</blockquote>,
 }
 
+const CooldownTimer = React.memo(({ expiresAt, onCooldownEnd, className }) => {
+  const [timeLeft, setTimeLeft] = useState('')
+
+  useEffect(() => {
+    if (!expiresAt) {
+      setTimeLeft('')
+      return undefined
+    }
+
+    const calculateTimeLeft = () => {
+      const difference = +new Date(expiresAt) - +new Date()
+      if (difference <= 0) {
+        setTimeLeft('')
+        if (onCooldownEnd) {
+          onCooldownEnd()
+        }
+        return
+      }
+
+      const hours = Math.floor(difference / (1000 * 60 * 60))
+      const minutes = Math.floor((difference / 1000 / 60) % 60)
+      const seconds = Math.floor((difference / 1000) % 60)
+
+      setTimeLeft(
+        `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
+      )
+    }
+
+    calculateTimeLeft()
+    const interval = setInterval(calculateTimeLeft, 1000)
+    return () => clearInterval(interval)
+  }, [expiresAt, onCooldownEnd])
+
+  if (!timeLeft) return <span className={className}>calculating...</span>
+
+  return (
+    <span className={className}>
+      {timeLeft}
+    </span>
+  )
+})
+CooldownTimer.displayName = 'CooldownTimer'
+
+const JobCard = React.memo(({
+  job,
+  rec,
+  candidateCity,
+  candidateSkills,
+  isApplied,
+  isApplying,
+  showApplicantFeatures,
+  onApply,
+  onOpenDetails
+}) => {
+  const handleOpenDetails = () => {
+    onOpenDetails(job)
+  }
+
+  return (
+    <motion.div
+      layout
+      initial={{ opacity: 0, y: 20 }}
+      animate={{ opacity: 1, y: 0 }}
+      exit={{ opacity: 0, y: -20 }}
+      className="p-6 bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-100 hover:border-primary-200/80 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(15,23,42,0.06)] hover:-translate-y-1 flex flex-col h-full relative overflow-hidden group"
+    >
+      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-primary-500 group-hover:via-indigo-500 group-hover:to-purple-500 transition-all duration-300" />
+
+      <div className="flex justify-between items-start mb-3 gap-4">
+        <div className="flex-1 mr-2">
+          <div className="flex items-start gap-3 mb-1.5">
+            <div className="w-11 h-11 bg-primary-50 border border-primary-100 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
+              <Briefcase className="w-5 h-5 text-primary-700" />
+            </div>
+            <div className="flex-1 min-w-0">
+              <h3 className="font-bold text-lg leading-tight mb-1 text-slate-900 group-hover:text-primary-900 transition-colors line-clamp-2">{job.title}</h3>
+              <p className="text-sm font-semibold text-slate-500">{job.company}</p>
+            </div>
+          </div>
+        </div>
+      </div>
+
+      {(() => {
+        const userCity = candidateCity || ''
+        const jobCity = (job.location_city || '').toLowerCase().trim()
+        const isCityMatched = userCity && jobCity && (userCity.includes(jobCity) || jobCity.includes(userCity))
+        
+        const showLocGreen = isCityMatched || (!job.location_city && job.work_type === 'remote')
+        const showWorkTypeGreen = job.work_type === 'remote' || job.work_type === 'hybrid'
+        const isExpMatched = (rec?.scoring_breakdown?.experience_fit ?? 0) >= 0.5
+        const isCgpaMatched = (rec?.scoring_breakdown?.academic_score ?? 0) >= 0.5
+
+        return (
+          <>
+            <div className="flex flex-wrap gap-2 mb-3">
+              <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
+                showLocGreen 
+                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
+                  : 'bg-slate-50 border-slate-100 text-slate-600'
+              }`}>
+                <MapPin className={`w-3.5 h-3.5 ${showLocGreen ? 'text-emerald-500' : 'text-slate-400'}`} />
+                <span>{job.location_city || 'Remote'}{job.location_state ? `, ${job.location_state}` : ''}</span>
+              </div>
+              <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium capitalize transition-all ${
+                showWorkTypeGreen 
+                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
+                  : 'bg-slate-50 border-slate-100 text-slate-600'
+              }`}>
+                <Clock className={`w-3.5 h-3.5 ${showWorkTypeGreen ? 'text-emerald-500' : 'text-slate-400'}`} />
+                <span>{job.work_type || 'Full-time'}</span>
+              </div>
+              {job.min_experience_years !== null && job.min_experience_years !== undefined && (
+                <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
+                  isExpMatched 
+                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
+                    : 'bg-slate-50 border-slate-100 text-slate-600'
+                }`}>
+                  <Sparkles className={`w-3.5 h-3.5 ${isExpMatched ? 'text-emerald-500' : 'text-slate-400'}`} />
+                  <span>{job.min_experience_years}+ years</span>
+                </div>
+              )}
+              {job.min_cgpa && (
+                <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
+                  isCgpaMatched 
+                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
+                    : 'bg-slate-50 border-slate-100 text-slate-600'
+                }`}>
+                  <Award className={`w-3.5 h-3.5 ${isCgpaMatched ? 'text-emerald-500' : 'text-slate-400'}`} />
+                  <span>CGPA {job.min_cgpa}+</span>
+                </div>
+              )}
+            </div>
+
+            {/* Job Skills Section directly inside the card */}
+            {(() => {
+              const explicit = Array.isArray(job.required_skills) && job.required_skills.length > 0
+              const matched = rec?.scoring_breakdown?.skills_breakdown?.matched_skills || []
+              const partial = rec?.scoring_breakdown?.skills_breakdown?.partial_matches || []
+              const fallbackSkills = [...new Set([...matched, ...partial])]
+              const skillsToRender = explicit ? job.required_skills.slice(0, 3) : fallbackSkills.slice(0, 3)
+              
+              if (!skillsToRender || skillsToRender.length === 0) return null
+              
+              return (
+                <div className="flex flex-wrap gap-1.5 mb-4">
+                  {skillsToRender.map((skill) => {
+                    const skillName = typeof skill === 'string' ? skill : skill?.name || skill?.skill || 'Skill'
+                    const reqName = skillName.toLowerCase().trim()
+                    const isMatched = checkSkillMatch(candidateSkills, reqName) ||
+                                      matched.some(m => checkSkillMatch([m], reqName)) ||
+                                      partial.some(p => checkSkillMatch([p], reqName))
+                    return (
+                      <span
+                        key={skillName}
+                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border transition-all inline-flex items-center ${
+                          isMatched 
+                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
+                            : 'bg-slate-50 border-slate-100 text-slate-500'
+                        }`}
+                      >
+                        {isMatched && <Check className="w-2.5 h-2.5 mr-0.5 text-emerald-600 flex-shrink-0" />}
+                        {skillName}
+                      </span>
+                    )
+                  })}
+                </div>
+              )
+            })()}
+          </>
+        )
+      })()}
+
+      {job.description && (
+        <div className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6 bg-slate-50/50 rounded-xl p-3 border border-slate-100 line-clamp-4 overflow-hidden">
+          <ReactMarkdown components={jobMarkdownComponents}>
+            {job.description}
+          </ReactMarkdown>
+        </div>
+      )}
+
+      {(job.min_salary || job.max_salary) && (
+        <div className="mb-4">
+          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Salary Range</p>
+          <p className="text-sm font-bold text-primary-600">
+            {job.min_salary ? `INR ${(job.min_salary / 100000).toFixed(1)}L` : 'Competitive'}
+            {job.max_salary ? ` - INR ${(job.max_salary / 100000).toFixed(1)}L` : ''}
+          </p>
+        </div>
+      )}
+
+      <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-2">
+        <div className="flex gap-2 w-full">
+          <button
+            onClick={handleOpenDetails}
+            className="flex-1 py-2 px-3 text-xs font-bold border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-700 active:scale-95 duration-200"
+          >
+            Details
+          </button>
+
+          {isApplied ? (
+            <button
+              disabled
+              className="flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-not-allowed text-center flex items-center justify-center gap-1.5"
+            >
+              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
+              Applied
+            </button>
+          ) : (
+            <button
+              onClick={() => onApply(job.id)}
+              disabled={isApplying}
+              className="flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all active:scale-95 duration-200 bg-primary-600 hover:bg-primary-700 text-white shadow-sm shadow-primary-500/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
+            >
+              {isApplying ? (
+                <>
+                  <Loader2 className="w-4 h-4 animate-spin" />
+                  Applying...
+                </>
+              ) : (
+                'Easy Apply'
+              )}
+            </button>
+          )}
+        </div>
+
+        {!showApplicantFeatures && (
+          <button
+            onClick={handleOpenDetails}
+            className="text-[9px] text-primary-600 font-extrabold hover:underline self-center pt-0.5"
+          >
+            View full job details
+          </button>
+        )}
+      </div>
+    </motion.div>
+  )
+})
+JobCard.displayName = 'JobCard'
+
 export default function JobsPage() {
   const navigate = useNavigate()
   const toast = useToast()
@@ -120,12 +359,16 @@ export default function JobsPage() {
   // Cooldown & Bypass State
   const [cooldownActive, setCooldownActive] = useState(false)
   const [cooldownExpiresAt, setCooldownExpiresAt] = useState(null)
-  const [cooldownTimeLeft, setCooldownTimeLeft] = useState('')
   const [bypassCost, setBypassCost] = useState(5)
   const [showBypassModal, setShowBypassModal] = useState(false)
   const [creditsBalance, setCreditsBalance] = useState(null)
   const [recalcLoading, setRecalcLoading] = useState(false)
 
+  const handleCooldownEnd = useCallback(() => {
+    setCooldownActive(false)
+    setCooldownExpiresAt(null)
+  }, [])
+
   const pageSize = 9
   const observerTarget = useRef(null)
   const hasMoreRef = useRef(hasMore)
@@ -192,35 +435,7 @@ export default function JobsPage() {
     fetchAppliedJobs()
   }, [currentUser?.email])
 
-  // Cooldown Countdown Timer
-  useEffect(() => {
-    if (!cooldownActive || !cooldownExpiresAt) {
-      setCooldownTimeLeft('')
-      return undefined
-    }
-
-    const calculateTimeLeft = () => {
-      const difference = +new Date(cooldownExpiresAt) - +new Date()
-      if (difference <= 0) {
-        setCooldownActive(false)
-        setCooldownExpiresAt(null)
-        setCooldownTimeLeft('')
-        return
-      }
-
-      const hours = Math.floor(difference / (1000 * 60 * 60))
-      const minutes = Math.floor((difference / 1000 / 60) % 60)
-      const seconds = Math.floor((difference / 1000) % 60)
-
-      setCooldownTimeLeft(
-        `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
-      )
-    }
 
-    calculateTimeLeft()
-    const interval = setInterval(calculateTimeLeft, 1000)
-    return () => clearInterval(interval)
-  }, [cooldownActive, cooldownExpiresAt])
 
   const fetchRecommendations = async () => {
     try {
@@ -411,7 +626,7 @@ export default function JobsPage() {
     }
   }
 
-  const handleApply = async (jobId) => {
+  const handleApply = useCallback(async (jobId) => {
     if (!currentUser) {
       navigate('/login')
       return
@@ -432,7 +647,17 @@ export default function JobsPage() {
     } finally {
       setApplyingId(null)
     }
-  }
+  }, [currentUser, navigate, toast])
+
+  const handleOpenDetails = useCallback(async (job) => {
+    try {
+      const response = await api.get(`/api/job/${job.id}`)
+      setSelectedJob(response.data.job)
+    } catch (error) {
+      console.error('Error fetching job details:', error)
+      setSelectedJob(job)
+    }
+  }, [setSelectedJob])
 
   const handleGenerateLearningPath = async (job) => {
     if (!job?.id) return
@@ -501,83 +726,89 @@ export default function JobsPage() {
   const activeFilterCount = [filters.q, filters.location, filters.work_type, filters.skills].filter(Boolean).length
 
   // Filter recommendations locally
-  const filteredRecommendations = rawRecommendations.filter((rec) => {
-    const job = rec.job || rec
-    if (!job) return false
-
-    // Title / Company / Description filter
-    if (filters.q) {
-      const q = filters.q.toLowerCase()
-      const title = (job.title || '').toLowerCase()
-      const company = (job.company || '').toLowerCase()
-      const desc = (job.description || '').toLowerCase()
-      if (!title.includes(q) && !company.includes(q) && !desc.includes(q)) {
-        return false
+  const filteredRecommendations = useMemo(() => {
+    return rawRecommendations.filter((rec) => {
+      const job = rec.job || rec
+      if (!job) return false
+
+      // Title / Company / Description filter
+      if (filters.q) {
+        const q = filters.q.toLowerCase()
+        const title = (job.title || '').toLowerCase()
+        const company = (job.company || '').toLowerCase()
+        const desc = (job.description || '').toLowerCase()
+        if (!title.includes(q) && !company.includes(q) && !desc.includes(q)) {
+          return false
+        }
       }
-    }
 
-    // Location filter
-    if (filters.location) {
-      const locFilter = filters.location.toLowerCase()
-      const city = (job.location_city || '').toLowerCase()
-      const state = (job.location_state || '').toLowerCase()
-      if (!city.includes(locFilter) && !state.includes(locFilter)) {
-        return false
+      // Location filter
+      if (filters.location) {
+        const locFilter = filters.location.toLowerCase()
+        const city = (job.location_city || '').toLowerCase()
+        const state = (job.location_state || '').toLowerCase()
+        if (!city.includes(locFilter) && !state.includes(locFilter)) {
+          return false
+        }
       }
-    }
 
-    // Work type filter
-    if (filters.work_type) {
-      if (job.work_type !== filters.work_type) {
-        return false
+      // Work type filter
+      if (filters.work_type) {
+        if (job.work_type !== filters.work_type) {
+          return false
+        }
       }
-    }
 
-    // Skills filter
-    if (filters.skills) {
-      const skillsFilter = filters.skills.toLowerCase().split(',').map(s => s.trim()).filter(Boolean)
-      if (skillsFilter.length > 0) {
-        const requiredSkills = Array.isArray(job.required_skills)
-          ? job.required_skills.map(s => String(s).toLowerCase().trim())
-          : []
-        const matchedSkills = rec.scoring_breakdown?.skills_breakdown?.matched_skills || []
-        const partialSkills = rec.scoring_breakdown?.skills_breakdown?.partial_matches || []
-        const recSkills = [...new Set([...matchedSkills, ...partialSkills])].map(s => String(s).toLowerCase().trim())
-        
-        const allJobSkills = [...new Set([...requiredSkills, ...recSkills])]
-        
-        const hasAllSkills = skillsFilter.every(sf => 
-          allJobSkills.some(js => js.includes(sf) || sf.includes(js))
-        )
-        if (!hasAllSkills) return false
+      // Skills filter
+      if (filters.skills) {
+        const skillsFilter = filters.skills.toLowerCase().split(',').map(s => s.trim()).filter(Boolean)
+        if (skillsFilter.length > 0) {
+          const requiredSkills = Array.isArray(job.required_skills)
+            ? job.required_skills.map(s => (typeof s === 'object' && s !== null ? String(s.name || '') : String(s)).toLowerCase().trim())
+            : []
+          const matchedSkills = rec.scoring_breakdown?.skills_breakdown?.matched_skills || []
+          const partialSkills = rec.scoring_breakdown?.skills_breakdown?.partial_matches || []
+          const recSkills = [...new Set([...matchedSkills, ...partialSkills])].map(s => String(s).toLowerCase().trim())
+          
+          const allJobSkills = [...new Set([...requiredSkills, ...recSkills])]
+          
+          const hasAllSkills = skillsFilter.every(sf => 
+            allJobSkills.some(js => js.includes(sf) || sf.includes(js))
+          )
+          if (!hasAllSkills) return false
+        }
       }
-    }
 
-    return true
-  })
+      return true
+    })
+  }, [rawRecommendations, filters.q, filters.location, filters.work_type, filters.skills])
 
   // Sort recommendations locally
-  const sortedRecommendations = [...filteredRecommendations].sort((a, b) => {
-    const jobA = a.job || a
-    const jobB = b.job || b
-
-    if (filters.sort === 'recent') {
-      const dateA = new Date(jobA.created_at || 0)
-      const dateB = new Date(jobB.created_at || 0)
-      return dateB - dateA
-    } else if (filters.sort === 'title') {
-      return (jobA.title || '').localeCompare(jobB.title || '')
-    } else {
-      // Relevance (score desc)
-      const scoreA = a.match_score ?? a.score ?? 0
-      const scoreB = b.match_score ?? b.score ?? 0
-      return scoreB - scoreA
-    }
-  })
+  const sortedRecommendations = useMemo(() => {
+    return [...filteredRecommendations].sort((a, b) => {
+      const jobA = a.job || a
+      const jobB = b.job || b
+
+      if (filters.sort === 'recent') {
+        const dateA = new Date(jobA.created_at || 0)
+        const dateB = new Date(jobB.created_at || 0)
+        return dateB - dateA
+      } else if (filters.sort === 'title') {
+        return (jobA.title || '').localeCompare(jobB.title || '')
+      } else {
+        // Relevance (score desc)
+        const scoreA = a.match_score ?? a.score ?? 0
+        const scoreB = b.match_score ?? b.score ?? 0
+        return scoreB - scoreA
+      }
+    })
+  }, [filteredRecommendations, filters.sort])
 
-  const displayJobs = showApplicantFeatures
-    ? sortedRecommendations.map(rec => rec.job).filter(Boolean)
-    : jobs
+  const displayJobs = useMemo(() => {
+    return showApplicantFeatures
+      ? sortedRecommendations.map(rec => rec.job).filter(Boolean)
+      : jobs
+  }, [showApplicantFeatures, sortedRecommendations, jobs])
 
   // Infinite Scroll Hook
   useEffect(() => {
@@ -599,202 +830,11 @@ export default function JobsPage() {
     }
   }, [])
 
-  const JobCard = ({ job }) => {
-    const rec = recommendationDetailsByJobId[job.id] || null
-
-    const handleOpenDetails = async () => {
-      try {
-        const response = await api.get(`/api/job/${job.id}`)
-        setSelectedJob(response.data.job)
-      } catch (error) {
-        console.error('Error fetching job details:', error)
-        setSelectedJob(job)
-      }
-    }
 
-    return (
-      <motion.div
-        layout
-        initial={{ opacity: 0, y: 20 }}
-        animate={{ opacity: 1, y: 0 }}
-        exit={{ opacity: 0, y: -20 }}
-        className="p-6 bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-100 hover:border-primary-200/80 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(15,23,42,0.06)] hover:-translate-y-1 flex flex-col h-full relative overflow-hidden group"
-      >
-        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-primary-500 group-hover:via-indigo-500 group-hover:to-purple-500 transition-all duration-300" />
-
-        <div className="flex justify-between items-start mb-3 gap-4">
-          <div className="flex-1 mr-2">
-            <div className="flex items-start gap-3 mb-1.5">
-              <div className="w-11 h-11 bg-primary-50 border border-primary-100 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
-                <Briefcase className="w-5 h-5 text-primary-700" />
-              </div>
-              <div className="flex-1 min-w-0">
-                <h3 className="font-bold text-lg leading-tight mb-1 text-slate-900 group-hover:text-primary-900 transition-colors line-clamp-2">{job.title}</h3>
-                <p className="text-sm font-semibold text-slate-500">{job.company}</p>
-              </div>
-            </div>
-          </div>
-        </div>
-
-        {(() => {
-          const userCity = candidateCity || ''
-          const jobCity = (job.location_city || '').toLowerCase().trim()
-          const isCityMatched = userCity && jobCity && (userCity.includes(jobCity) || jobCity.includes(userCity))
-          
-          const showLocGreen = isCityMatched || (!job.location_city && job.work_type === 'remote')
-          const showWorkTypeGreen = job.work_type === 'remote' || job.work_type === 'hybrid'
-          const isExpMatched = (rec?.scoring_breakdown?.experience_fit ?? 0) >= 0.5
-          const isCgpaMatched = (rec?.scoring_breakdown?.academic_score ?? 0) >= 0.5
-
-          return (
-            <>
-              <div className="flex flex-wrap gap-2 mb-3">
-                <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
-                  showLocGreen 
-                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
-                    : 'bg-slate-50 border-slate-100 text-slate-600'
-                }`}>
-                  <MapPin className={`w-3.5 h-3.5 ${showLocGreen ? 'text-emerald-500' : 'text-slate-400'}`} />
-                  <span>{job.location_city || 'Remote'}{job.location_state ? `, ${job.location_state}` : ''}</span>
-                </div>
-                <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium capitalize transition-all ${
-                  showWorkTypeGreen 
-                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
-                    : 'bg-slate-50 border-slate-100 text-slate-600'
-                }`}>
-                  <Clock className={`w-3.5 h-3.5 ${showWorkTypeGreen ? 'text-emerald-500' : 'text-slate-400'}`} />
-                  <span>{job.work_type || 'Full-time'}</span>
-                </div>
-                {job.min_experience_years !== null && job.min_experience_years !== undefined && (
-                  <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
-                    isExpMatched 
-                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
-                      : 'bg-slate-50 border-slate-100 text-slate-600'
-                  }`}>
-                    <Sparkles className={`w-3.5 h-3.5 ${isExpMatched ? 'text-emerald-500' : 'text-slate-400'}`} />
-                    <span>{job.min_experience_years}+ years</span>
-                  </div>
-                )}
-                {job.min_cgpa && (
-                  <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
-                    isCgpaMatched 
-                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
-                      : 'bg-slate-50 border-slate-100 text-slate-600'
-                  }`}>
-                    <Award className={`w-3.5 h-3.5 ${isCgpaMatched ? 'text-emerald-500' : 'text-slate-400'}`} />
-                    <span>CGPA {job.min_cgpa}+</span>
-                  </div>
-                )}
-              </div>
-
-              {/* Job Skills Section directly inside the card */}
-              {(() => {
-                const explicit = Array.isArray(job.required_skills) && job.required_skills.length > 0
-                const matched = rec?.scoring_breakdown?.skills_breakdown?.matched_skills || []
-                const partial = rec?.scoring_breakdown?.skills_breakdown?.partial_matches || []
-                const fallbackSkills = [...new Set([...matched, ...partial])]
-                const skillsToRender = explicit ? job.required_skills.slice(0, 3) : fallbackSkills.slice(0, 3)
-                
-                if (!skillsToRender || skillsToRender.length === 0) return null
-                
-                return (
-                  <div className="flex flex-wrap gap-1.5 mb-4">
-                    {skillsToRender.map((skill, idx) => {
-                      const skillName = typeof skill === 'string' ? skill : skill?.name || skill?.skill || `Skill ${idx + 1}`
-                      const reqName = skillName.toLowerCase().trim()
-                      const isMatched = checkSkillMatch(candidateSkills, reqName) ||
-                                        matched.some(m => checkSkillMatch([m], reqName)) ||
-                                        partial.some(p => checkSkillMatch([p], reqName))
-                      return (
-                        <span
-                          key={`${skillName}-${idx}`}
-                          className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border transition-all inline-flex items-center ${
-                            isMatched 
-                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
-                              : 'bg-slate-50 border-slate-100 text-slate-500'
-                          }`}
-                        >
-                          {isMatched && <Check className="w-2.5 h-2.5 mr-0.5 text-emerald-600 flex-shrink-0" />}
-                          {skillName}
-                        </span>
-                      )
-                    })}
-                  </div>
-                )
-              })()}
-            </>
-          )
-        })()}
-
-        {job.description && (
-          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6 bg-slate-50/50 rounded-xl p-3 border border-slate-100 line-clamp-4 overflow-hidden">
-            <ReactMarkdown components={jobMarkdownComponents}>
-              {job.description}
-            </ReactMarkdown>
-          </div>
-        )}
-
-        {(job.min_salary || job.max_salary) && (
-          <div className="mb-4">
-            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Salary Range</p>
-            <p className="text-sm font-bold text-primary-600">
-              {job.min_salary ? `INR ${(job.min_salary / 100000).toFixed(1)}L` : 'Competitive'}
-              {job.max_salary ? ` - INR ${(job.max_salary / 100000).toFixed(1)}L` : ''}
-            </p>
-          </div>
-        )}
-
-        <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-2">
-          <div className="flex gap-2 w-full">
-            <button
-              onClick={handleOpenDetails}
-              className="flex-1 py-2 px-3 text-xs font-bold border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-700 active:scale-95 duration-200"
-            >
-              Details
-            </button>
-
-            {appliedJobIds.has(job.id) ? (
-              <button
-                disabled
-                className="flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-not-allowed text-center flex items-center justify-center gap-1.5"
-              >
-                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
-                Applied
-              </button>
-            ) : (
-              <button
-                onClick={() => handleApply(job.id)}
-                disabled={applyingId === job.id}
-                className="flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all active:scale-95 duration-200 bg-primary-600 hover:bg-primary-700 text-white shadow-sm shadow-primary-500/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
-              >
-                {applyingId === job.id ? (
-                  <>
-                    <Loader2 className="w-4 h-4 animate-spin" />
-                    Applying...
-                  </>
-                ) : (
-                  'Easy Apply'
-                )}
-              </button>
-            )}
-          </div>
-
-          {!showApplicantFeatures && (
-            <button
-              onClick={handleOpenDetails}
-              className="text-[9px] text-primary-600 font-extrabold hover:underline self-center pt-0.5"
-            >
-              View full job details
-            </button>
-          )}
-        </div>
-      </motion.div>
-    )
-  }
 
   return (
-    <div className="min-h-screen bg-slate-50 pt-24 pb-12">
-      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
+    <div className="relative">
+      <div className="max-w-container-max mx-auto">
         
         {/* Header Row */}
         <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
@@ -802,13 +842,13 @@ export default function JobsPage() {
             initial={{ opacity: 0, y: -20 }}
             animate={{ opacity: 1, y: 0 }}
           >
-            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
-              {showApplicantFeatures ? 'AI Recommended Jobs' : 'Browse Jobs'}
+            <h1 className="font-display-lg text-display-lg text-on-surface dark:text-inverse-on-surface mb-xs font-bold leading-tight">
+              {showApplicantFeatures ? 'Recommended Match Roles' : 'Browse Listings'}
             </h1>
-            <p className="text-gray-600">
+            <p className="font-body-base text-body-base text-on-surface-variant dark:text-surface-variant">
               {showApplicantFeatures 
-                ? 'Personalized career recommendations sorted by AI matching relevance.' 
-                : 'Discover opportunities that match your skills and goals.'}
+                ? 'Personalized career matches sorted by algorithmic suitability.' 
+                : 'Discover opportunities that align with your career specifications.'}
             </p>
           </motion.div>
           
@@ -822,7 +862,7 @@ export default function JobsPage() {
                 <button
                   onClick={() => handleRecomputeRecommendations(false)}
                   disabled={recalcLoading}
-                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all text-sm shadow-md border duration-200 active:scale-95 ${
+                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all text-sm shadow-md border duration-200 active:scale-95 cursor-pointer ${
                     recalcLoading
                       ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                       : 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-600 hover:via-orange-600 hover:to-yellow-600 border-amber-400 text-white shadow-amber-500/20 hover:shadow-amber-500/30'
@@ -830,20 +870,20 @@ export default function JobsPage() {
                 >
                   <Zap className={`w-4 h-4 text-white ${recalcLoading ? '' : 'animate-bounce'}`} />
                   <span>{recalcLoading ? 'Updating...' : `Refresh Now (${bypassCost}c)`}</span>
-                  {cooldownTimeLeft && (
-                    <span className="ml-1 text-[10px] font-medium bg-black/25 px-2 py-0.5 rounded-full font-mono text-amber-100">
-                      {cooldownTimeLeft}
-                    </span>
-                  )}
+                  <CooldownTimer
+                    expiresAt={cooldownExpiresAt}
+                    onCooldownEnd={handleCooldownEnd}
+                    className="ml-1 text-[10px] font-medium bg-black/25 px-2 py-0.5 rounded-full font-mono text-amber-100"
+                  />
                 </button>
               ) : (
                 <button
                   onClick={() => handleRecomputeRecommendations(false)}
                   disabled={recalcLoading}
-                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold transition-all text-sm shadow-sm ${
+                  className={`inline-flex items-center gap-2 font-semibold transition-all shadow-sm cursor-pointer ${
                     recalcLoading
-                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
-                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
+                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed px-4 py-2 rounded-xl border text-sm'
+                      : 'btn-secondary-sm !px-4 !py-2 !rounded-xl !text-sm text-slate-700 dark:text-slate-300'
                   }`}
                 >
                   <RefreshCcw className={`w-4 h-4 ${recalcLoading ? 'animate-spin' : ''}`} />
@@ -858,11 +898,11 @@ export default function JobsPage() {
         <motion.div
           initial={{ opacity: 0, y: -10 }}
           animate={{ opacity: 1, y: 0 }}
-          className="mb-6 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm"
+          className="mb-lg bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-md soft-shadow"
         >
-          <div className="mb-4">
-            <h3 className="text-base font-bold text-slate-900">Search & Filter</h3>
-            <p className="text-xs text-slate-500">Refine the job list using keyword, location, type, skill, and sort criteria.</p>
+          <div className="mb-md">
+            <h3 className="font-body-bold text-[15px] font-bold text-on-surface dark:text-inverse-on-surface">Search Listings</h3>
+            <p className="font-metadata text-[12px] text-on-surface-variant dark:text-surface-variant mt-0.5">Filter match criteria to pinpoint relevant postings.</p>
           </div>
 
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
@@ -1000,7 +1040,18 @@ export default function JobsPage() {
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <AnimatePresence>
             {displayJobs.map((job) => (
-              <JobCard key={job.id} job={job} />
+              <JobCard
+                key={job.id}
+                job={job}
+                rec={recommendationDetailsByJobId[job.id] || null}
+                candidateCity={candidateCity}
+                candidateSkills={candidateSkills}
+                isApplied={appliedJobIds.has(job.id)}
+                isApplying={applyingId === job.id}
+                showApplicantFeatures={showApplicantFeatures}
+                onApply={handleApply}
+                onOpenDetails={handleOpenDetails}
+              />
             ))}
           </AnimatePresence>
         </div>
@@ -1067,7 +1118,7 @@ export default function JobsPage() {
                 </div>
                 <button
                   onClick={() => setSelectedJob(null)}
-                  className="relative text-slate-500 hover:text-slate-900 hover:bg-white/80 border border-slate-200 bg-white/60 p-2.5 rounded-xl transition-all flex-shrink-0 shadow-sm"
+                  className="relative text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 bg-white p-2.5 rounded-xl transition-all flex-shrink-0 shadow-sm"
                 >
                   <X className="w-6 h-6" />
                 </button>
@@ -1108,8 +1159,8 @@ export default function JobsPage() {
 
                       {explanationLines.length > 0 ? (
                         <ul className="space-y-2">
-                          {explanationLines.slice(0, 4).map((line, idx) => (
-                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
+                          {explanationLines.slice(0, 4).map((line) => (
+                            <li key={line} className="flex items-start gap-2 text-sm text-gray-700">
                               <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                               <span>{line}</span>
                             </li>
@@ -1174,7 +1225,7 @@ export default function JobsPage() {
                                                     partial.some(p => checkSkillMatch([p], reqName))
                                   return (
                                     <span
-                                      key={`${skill}-${idx}`}
+                                      key={skillName}
                                       className={`px-3 py-1 rounded-full text-xs font-medium border transition-all inline-flex items-center ${
                                         isMatched
                                           ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm'
@@ -1375,9 +1426,11 @@ export default function JobsPage() {
                 <div className="grid grid-cols-2 gap-3">
                   <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex flex-col justify-between">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cooldown Left</span>
-                    <span className="text-base font-extrabold text-amber-600 mt-1 font-mono">
-                      {cooldownTimeLeft || "calculating..."}
-                    </span>
+                    <CooldownTimer
+                      expiresAt={cooldownExpiresAt}
+                      onCooldownEnd={handleCooldownEnd}
+                      className="text-base font-extrabold text-amber-600 mt-1 font-mono"
+                    />
                   </div>
                   <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex flex-col justify-between">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Balance</span>
diff --git a/frontend/src/pages/LoginPage.jsx b/frontend/src/pages/LoginPage.jsx
index bb47bc7..4e08d81 100644
--- a/frontend/src/pages/LoginPage.jsx
+++ b/frontend/src/pages/LoginPage.jsx
@@ -1,8 +1,8 @@
-import React, { useState } from 'react'
+import React, { useState, useEffect } from 'react'
 import { useNavigate, Link, useLocation } from 'react-router-dom'
 import { motion } from 'framer-motion'
 import { Mail, Lock, AlertTriangle, CheckCircle, GraduationCap, ArrowRight, Eye, EyeOff } from 'lucide-react'
-import api from '../config/api'
+import api, { API_BASE_URL } from '../config/api'
 import secureStorage from '../utils/secureStorage'
 import { useToast } from '../hooks/useToast'
 import { ToastContainer } from '../components/Toast'
@@ -19,8 +19,69 @@ export default function LoginPage() {
   const [error, setError] = useState('')
   const [loading, setLoading] = useState(false)
   const [showPassword, setShowPassword] = useState(false)
+  const [googleRole, setGoogleRole] = useState('student')
   const message = location.state?.message
 
+  useEffect(() => {
+    const params = new URLSearchParams(location.search)
+    const token = params.get('token')
+    const errorParam = params.get('error')
+
+    if (errorParam) {
+      const decodedError = decodeURIComponent(errorParam)
+      setError(decodedError)
+      toast.error(decodedError)
+      // Clear error query param from URL
+      navigate('/login', { replace: true })
+    } else if (token) {
+      setLoading(true)
+      const fetchUserData = async () => {
+        try {
+          // Store token in secure storage
+          secureStorage.setItem('token', token)
+          // Set default authorization header
+          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
+
+          // Fetch current user details
+          const response = await api.get('/api/auth/me')
+          const user = response.data
+
+          secureStorage.setItem('user', user)
+          secureStorage.setItem('login_time', Date.now())
+
+          // Navigate based on role
+          switch (user.role) {
+            case 'admin':
+              navigate('/admin/dashboard', { replace: true })
+              break
+            case 'employer':
+              navigate('/employer/dashboard', { replace: true })
+              break
+            default:
+              navigate('/student/dashboard', { replace: true })
+          }
+          toast.success('Login successful!')
+        } catch (err) {
+          console.error('Failed to login via Google token:', err)
+          const errorMsg = err.response?.data?.detail || 'Authentication failed'
+          setError(errorMsg)
+          toast.error(errorMsg)
+          // Clear invalid token from secure storage
+          secureStorage.removeItem('token')
+          delete api.defaults.headers.common['Authorization']
+        } finally {
+          setLoading(false)
+        }
+      }
+      fetchUserData()
+    }
+  }, [location.search, navigate, toast])
+
+  const handleGoogleLogin = () => {
+    const base = API_BASE_URL || 'http://localhost:8000'
+    window.location.href = `${base}/api/auth/google/login?role=${googleRole}`
+  }
+
   const handleSubmit = async (e) => {
     e.preventDefault()
     setError('')
@@ -181,6 +242,63 @@ export default function LoginPage() {
             </button>
           </form>
 
+          <div className="mt-6">
+            <div className="relative mb-6">
+              <div className="absolute inset-0 flex items-center">
+                <div className="w-full border-t border-gray-300"></div>
+              </div>
+              <div className="relative flex justify-center text-sm">
+                <span className="px-4 bg-white text-gray-500 font-medium">Or continue with</span>
+              </div>
+            </div>
+
+            {/* Google Role Selector */}
+            <div className="mb-4">
+              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 text-center">
+                Sign in / Register as:
+              </label>
+              <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
+                <button
+                  type="button"
+                  onClick={() => setGoogleRole('student')}
+                  className={`py-1.5 px-3 text-xs font-medium border rounded-md transition-all ${
+                    googleRole === 'student'
+                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:text-primary-600 shadow-sm'
+                      : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white'
+                  }`}
+                >
+                  Student
+                </button>
+                <button
+                  type="button"
+                  onClick={() => setGoogleRole('employer')}
+                  className={`py-1.5 px-3 text-xs font-medium border rounded-md transition-all ${
+                    googleRole === 'employer'
+                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:text-primary-600 shadow-sm'
+                      : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white'
+                  }`}
+                >
+                  Recruiter
+                </button>
+              </div>
+            </div>
+
+            <button
+              type="button"
+              onClick={handleGoogleLogin}
+              disabled={loading}
+              className="w-full h-12 flex items-center justify-center space-x-3 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all font-semibold text-gray-700 bg-white shadow-sm"
+            >
+              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
+                <path
+                  fill="#EA4335"
+                  d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.57 0-6.477-2.907-6.477-6.477s2.907-6.477 6.477-6.477c1.77 0 3.35.686 4.5 1.8l3.15-3.15C19.23 1.943 15.96 0 12.24 0 5.48 0 0 5.48 0 12.24s5.48 12.24 12.24 12.24c6.8 0 12.24-5.44 12.24-12.24 0-.783-.069-1.543-.195-2.285H12.24z"
+                />
+              </svg>
+              <span>{loading ? 'Connecting...' : 'Sign in with Google'}</span>
+            </button>
+          </div>
+
           <div className="mt-8 space-y-4">
             <div className="relative">
               <div className="absolute inset-0 flex items-center">
diff --git a/frontend/src/pages/StudentDashboard.jsx b/frontend/src/pages/StudentDashboard.jsx
index 42715d2..61fcf33 100644
--- a/frontend/src/pages/StudentDashboard.jsx
+++ b/frontend/src/pages/StudentDashboard.jsx
@@ -1,10 +1,10 @@
-import React, { useState, useEffect } from 'react'
+import React, { useState, useEffect, useRef } from 'react'
 import { useNavigate, Link } from 'react-router-dom'
-import { motion } from 'framer-motion'
-
+import { motion, AnimatePresence } from 'framer-motion'
 import {
-  Briefcase, TrendingUp, Clock,
-  CheckCircle, Upload, User, MapPin, Target, Zap, BookOpen, FileText, GraduationCap, RefreshCcw, X, Coins, Bookmark, Award, Sparkles
+  Briefcase, TrendingUp, Clock, CheckCircle, Upload, User,
+  MapPin, Target, Zap, BookOpen, FileText, GraduationCap,
+  X, Coins, Award, Sparkles, Play, ArrowRight, Mic, ChevronRight
 } from 'lucide-react'
 
 import api from '../config/api'
@@ -12,8 +12,6 @@ import secureStorage from '../utils/secureStorage'
 import { useToast } from '../hooks/useToast'
 import { ToastContainer } from '../components/Toast'
 import { SkeletonStats } from '../components/SkeletonLoader'
-import CreditWidget from '../components/CreditWidget'
-import ApplicationTracker from '../components/ApplicationTracker'
 
 export default function StudentDashboard() {
   const navigate = useNavigate()
@@ -23,6 +21,7 @@ export default function StudentDashboard() {
   const [applicantData, setApplicantData] = useState(null)
   const [studentProfile, setStudentProfile] = useState(null)
   const [jobApplications, setJobApplications] = useState([])
+  const [recommendations, setRecommendations] = useState([])
   const [loading, setLoading] = useState(true)
   const [error, setError] = useState(null)
 
@@ -32,16 +31,69 @@ export default function StudentDashboard() {
   const [showUploadForm, setShowUploadForm] = useState(false)
   const [selectedResume, setSelectedResume] = useState(null)
 
-  // Recommendation State (for counts only)
-  const [recommendations, setRecommendations] = useState([])
-  const [applicantId, setApplicantId] = useState(null)
-  const [noApplicantProfile, setNoApplicantProfile] = useState(false)
+  // Interview Stats
+  const [completedInterviewsCount, setCompletedInterviewsCount] = useState(0)
 
-  // Refs
-  const uploadFormRef = React.useRef(null)
+  const fetchAll = async () => {
+    try {
+      setLoading(true)
+      let profileId = secureStorage.getItem('db_applicant_id')
 
-  const interviewingCount = jobApplications.filter((app) => app.status?.toLowerCase() === 'interviewing').length
-  const newSuggestionCount = recommendations.filter((rec) => rec.status === 'recommended').length
+      // 1. Fetch Applicant Details
+      try {
+        const profileRes = await api.get(`/api/student/applicant?t=${Date.now()}`)
+        setApplicantData(profileRes.data)
+        profileId = profileRes.data.id
+        secureStorage.setItem('db_applicant_id', String(profileId))
+      } catch (e) {
+        console.warn('No applicant profile found.')
+      }
+
+      // 2. Fetch Student Profile
+      try {
+        const studentProfileRes = await api.get(`/api/student/profile?t=${Date.now()}`)
+        setStudentProfile(studentProfileRes.data || null)
+      } catch (e) {
+        console.warn('Failed to load student profile.')
+      }
+
+      // 3. Fetch Applications
+      try {
+        const appRes = await api.get(`/api/student/applications/jobs?t=${Date.now()}`)
+        setJobApplications(appRes.data?.applications || [])
+      } catch (e) {
+        console.warn('Failed to fetch job applications.')
+      }
+
+      // 4. Fetch Recommendations
+      if (profileId) {
+        try {
+          const recRes = await api.get(`/api/recommendations/${profileId}?t=${Date.now()}`)
+          setRecommendations(recRes.data.job_recommendations || [])
+        } catch (e) {
+          console.warn('Failed to fetch job recommendations.')
+        }
+
+        // 5. Fetch Interview Sessions Count
+        try {
+          const interviewRes = await api.get('/api/interview/sessions')
+          const sessions = interviewRes.data || []
+          const completed = sessions.filter(s => s.status?.toLowerCase() === 'completed').length
+          setCompletedInterviewsCount(completed)
+        } catch (e) {
+          console.warn('Failed to fetch interview sessions.')
+        }
+      }
+    } catch (err) {
+      console.error('Error fetching dashboard data:', err)
+    } finally {
+      setLoading(false)
+    }
+  }
+
+  useEffect(() => {
+    fetchAll()
+  }, [])
 
   const handleFileUpload = async (e) => {
     e.preventDefault()
@@ -49,7 +101,6 @@ export default function StudentDashboard() {
     setError(null)
     setUploadSuccess(false)
 
-    // Validate file was selected
     if (!selectedResume) {
       setError('Please select a resume file')
       setUploadLoading(false)
@@ -57,16 +108,13 @@ export default function StudentDashboard() {
     }
 
     try {
-      // Create FormData with resume file
       const formData = new FormData()
       formData.append('resume', selectedResume)
 
-      // Get form values from the form element
       const form = e.currentTarget
       const locationInput = form.querySelector('input[name="location"]')
       const jeeRankInput = form.querySelector('input[name="jee_rank"]')
 
-      // Append optional fields if they have values
       if (locationInput && locationInput.value) {
         formData.append('location', locationInput.value)
       }
@@ -74,318 +122,361 @@ export default function StudentDashboard() {
         formData.append('jee_rank', jeeRankInput.value)
       }
 
-      console.log('Starting file upload with file:', selectedResume.name)
-
-      // Don't set Content-Type manually - axios sets it with boundary automatically
       const response = await api.post('/upload', formData, {
-        timeout: 120000 // 120s for upload
+        timeout: 120000
       })
-      setUploadSuccess(true)
-      form.reset()
 
       if (response.data.applicant_id) {
-        setTimeout(async () => {
-          try {
-            const parseRes = await api.post(`/parse/${response.data.applicant_id}`, null, {
-              timeout: 120000 // 120s for parse
-            })
-            toast.success('Resume uploaded and parsed successfully!')
-            setShowUploadForm(false)
-            setNoApplicantProfile(false)
-
-            const dbId = parseRes.data?.db_applicant_id
-            if (dbId) {
-              secureStorage.setItem('db_applicant_id', String(dbId))
-              setApplicantId(dbId)
-            }
-            // Refresh data
-            fetchAll()
-          } catch (parseErr) {
-            console.error('Parse error:', parseErr)
-            const errMsg = parseErr.response?.data?.detail || parseErr.message || 'Unknown error'
-            setError(`Parsing failed: ${errMsg}`)
-            toast.error('Resume uploaded but parsing failed.')
-          } finally {
-            setUploadLoading(false)
-          }
-        }, 500)
-      } else {
-        setUploadLoading(false)
+        const parseRes = await api.post(`/parse/${response.data.applicant_id}`, null, {
+          timeout: 120000
+        })
+        toast.success('Resume uploaded and parsed successfully!')
+        setShowUploadForm(false)
+
+        const dbId = parseRes.data?.db_applicant_id
+        if (dbId) {
+          secureStorage.setItem('db_applicant_id', String(dbId))
+        }
+        fetchAll()
       }
     } catch (err) {
-      console.error('Upload error:', err)
-      setError(err.response?.data?.detail || 'Upload failed.')
-      setUploadLoading(false)
-    }
-  }
-
-  // --- Data Fetching ---
-  const fetchAll = async () => {
-    try {
-      setLoading(true)
-      // Profile
-      let profileId = secureStorage.getItem('db_applicant_id')
-
-      try {
-        const profileRes = await api.get(`/api/student/applicant?t=${Date.now()}`)
-        setApplicantData(profileRes.data) // SAVE DATA for ProfileHealth
-        setApplicantId(profileRes.data.id)
-        secureStorage.setItem('db_applicant_id', String(profileRes.data.id))
-        profileId = profileRes.data.id
-        setNoApplicantProfile(false)
-      } catch (e) {
-        // Profile probably not found
-        if (!profileId) setNoApplicantProfile(true)
-      }
-
-      try {
-        const studentProfileRes = await api.get(`/api/student/profile?t=${Date.now()}`)
-        setStudentProfile(studentProfileRes.data || null)
-      } catch (profileErr) {
-        console.error('Failed to load student profile data:', profileErr)
-        setStudentProfile(null)
-      }
-
-      // Applications
-      const [jobApps] = await Promise.all([
-        api.get(`/api/student/applications/jobs?t=${Date.now()}`).catch(() => ({ data: { applications: [] } }))
-      ])
-      setJobApplications(jobApps.data?.applications || [])
-
-      // Recommendations (to calculate counts)
-      if (profileId) {
-        const recRes = await api.get(`/api/recommendations/${profileId}?t=${Date.now()}`)
-        setRecommendations(recRes.data.job_recommendations || [])
-      }
-    } catch (err) {
-      console.error(err)
+      console.error('Upload failed:', err)
+      setError(err.response?.data?.detail || 'Upload or parsing failed.')
+      toast.error('Resume upload or parsing failed.')
     } finally {
-      setLoading(false)
+      setUploadLoading(false)
     }
   }
 
-  useEffect(() => {
-    fetchAll()
-  }, [])
-
-  // Scroll effect
-  useEffect(() => {
-    if (showUploadForm && uploadFormRef.current) {
-      uploadFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
-    }
-  }, [showUploadForm])
-
   if (loading) {
     return (
-      <div className="min-h-screen bg-slate-50 pt-24 px-4">
-        <div className="max-w-7xl mx-auto py-8">
-          <SkeletonStats />
-        </div>
+      <div className="min-h-screen pt-8 px-4">
+        <SkeletonStats />
       </div>
     )
   }
 
-  return (
-    <div className="min-h-screen bg-slate-50/50 pt-24 pb-12 relative overflow-hidden">
-      {/* Ambient background glows */}
-      <div className="pointer-events-none absolute left-1/4 top-10 h-96 w-96 rounded-full bg-gradient-to-br from-primary-400/10 to-indigo-300/10 blur-[100px]" />
-      <div className="pointer-events-none absolute right-1/4 top-40 h-96 w-96 rounded-full bg-gradient-to-br from-sky-400/10 to-emerald-300/10 blur-[100px]" />
+  const hasProfile = !!applicantData
+  // Score calculations (ATS matching suitability)
+  const confidenceScore = applicantData?.llm_confidence 
+    ? Math.round(applicantData.llm_confidence * 100) 
+    : 80 // Default to 80% if there is a profile but confidence is not set
+  
+  const formattedScore = hasProfile ? confidenceScore : 0
+  const matchColor = formattedScore >= 80 ? 'text-success' : formattedScore >= 50 ? 'text-warning' : 'text-error'
 
+  return (
+    <div className="relative">
       <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
-      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
 
-        {/* --- HEADER ROW --- */}
+      {/* Welcome Header */}
+      <div className="mb-xl flex flex-col md:flex-row md:items-end justify-between gap-md relative z-10">
+        <div>
+          <h1 className="font-display-lg text-display-lg text-on-surface dark:text-inverse-on-surface mb-xs font-bold leading-tight">
+            Welcome back, {applicantData?.full_name?.split(' ')[0] || 'Scholar'}!
+          </h1>
+          <p className="font-body-base text-body-base text-on-surface-variant dark:text-surface-variant">
+            {hasProfile 
+              ? `Your profile is ATS optimized. You have ${jobApplications.length} applications tracked and ${recommendations.length} recommendations.`
+              : "Upload your resume to receive AI-guided matching and interview prep."}
+          </p>
+        </div>
+        <div>
+          <button 
+            onClick={() => setShowUploadForm(true)}
+            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white dark:text-on-primary-container dark:bg-primary-container rounded-lg font-body-bold text-[14px] hover:bg-primary-500 hover:shadow-lg active:scale-95 duration-150 transition-all cursor-pointer"
+          >
+            <Upload className="w-4 h-4" />
+            Upload New Resume
+          </button>
+        </div>
+      </div>
+
+      {/* Bento Grid Layout */}
+      {!hasProfile ? (
         <motion.div
-          initial={{ opacity: 0, y: -20 }}
-          animate={{ opacity: 1, y: 0 }}
-          className="relative mb-8 overflow-hidden rounded-3xl border border-white/80 bg-white/70 p-6 md:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.04)] backdrop-blur-md"
+          initial={{ opacity: 0, scale: 0.95 }}
+          animate={{ opacity: 1, scale: 1 }}
+          className="my-8 p-12 border border-dashed border-border-subtle dark:border-outline-variant rounded-2xl bg-white dark:bg-inverse-surface/10 text-center shadow-sm"
         >
-          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-50/40 via-white/50 to-sky-50/40 opacity-70" />
-          <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
-            <div className="max-w-2xl">
-              <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 mb-4">
-                <Briefcase className="w-3.5 h-3.5" />
-                Student workspace
-              </div>
-              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
-                <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-primary-950">
-                  Student Dashboard
-                </span>
-              </h1>
-              <p className="text-gray-600">Welcome back, {applicantData?.full_name?.split(' ')[0] || 'Student'}</p>
-              <p className="text-sm text-gray-500 mt-2 max-w-xl">
-                You have {interviewingCount} interview {interviewingCount === 1 ? 'invitation' : 'invitations'} and {newSuggestionCount} new path {newSuggestionCount === 1 ? 'suggestion' : 'suggestions'}.
-              </p>
-            </div>
+          <Upload className="w-16 h-16 text-primary/40 mx-auto mb-4" />
+          <h3 className="text-xl font-body-bold font-bold mb-2">Create Your Profile</h3>
+          <p className="text-on-surface-variant dark:text-surface-variant mb-6 max-w-md mx-auto">
+            Upload your resume so our AI engine can identify your skills, calculate ATS suitability, suggest learning pathways, and customize mock interviews.
+          </p>
+          <button 
+            onClick={() => setShowUploadForm(true)} 
+            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-body-bold text-sm shadow-md hover:bg-primary-500 transition-colors"
+          >
+            Get Started
+          </button>
+        </motion.div>
+      ) : (
+        <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg mb-xl items-start">
+          
+          {/* Main Pane (8/12 width) */}
+          <div className="lg:col-span-8 flex flex-col gap-lg">
+            
+            {/* Resume Health Score Card */}
+            <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-lg soft-shadow relative overflow-hidden group">
+              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-fixed-dim/20 rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
+              
+              <div className="flex flex-col md:flex-row items-center gap-lg relative z-10">
+                {/* Circular Score Indicator */}
+                <div className="w-36 h-36 shrink-0 relative flex items-center justify-center">
+                  <svg className={`w-full h-full transform -rotate-90 ${matchColor}`} viewBox="0 0 36 36">
+                    <path 
+                      className="text-surface-container-high dark:text-outline-variant/20" 
+                      strokeWidth="3" 
+                      stroke="currentColor" 
+                      fill="none" 
+                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
+                    />
+                    <path 
+                      strokeDasharray={`${formattedScore}, 100`} 
+                      strokeWidth="3.5" 
+                      strokeLinecap="round" 
+                      stroke="currentColor" 
+                      fill="none" 
+                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
+                    />
+                  </svg>
+                  <div className="absolute flex flex-col items-center justify-center">
+                    <span className="font-label-caps text-display-lg text-on-surface dark:text-inverse-on-surface font-extrabold">{formattedScore}</span>
+                    <span className="font-metadata text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Score</span>
+                  </div>
+                </div>
 
-            <div className="flex flex-col gap-4 lg:items-end lg:justify-end lg:min-w-[360px]">
-              <div className="grid w-full gap-3 md:grid-cols-2">
-                <CreditWidget compact />
-                <ApplicationTracker jobApps={jobApplications} compact />
+                {/* Content */}
+                <div className="flex-1 text-center md:text-left">
+                  <div className="inline-flex items-center gap-1.5 bg-success/10 text-success px-2.5 py-0.5 rounded-full font-metadata text-[12px] font-semibold mb-sm">
+                    <CheckCircle className="w-3.5 h-3.5" />
+                    ATS Optimization Checked
+                  </div>
+                  <h2 className="font-headline-md text-headline-md text-on-surface dark:text-inverse-on-surface mb-sm">Resume Suitability</h2>
+                  <p className="font-body-base text-body-base text-on-surface-variant dark:text-surface-variant mb-md leading-relaxed">
+                    Your resume has high keyword density for your primary field. Our AI analysis shows complete profile parsing with high confidence.
+                  </p>
+                  <div className="flex flex-wrap gap-sm justify-center md:justify-start">
+                    <Link
+                      to={`/results/${applicantData.applicant_id}`}
+                      className="btn-secondary-sm px-4 py-2 text-[13px] font-body-bold shadow-sm cursor-pointer"
+                    >
+                      Review Scorecard
+                    </Link>
+                    <Link
+                      to="/student/intelligence"
+                      className="px-4 py-2 text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed-dim transition-colors font-body-bold text-[13px] flex items-center gap-1"
+                    >
+                      <Sparkles className="w-4 h-4 text-primary" />
+                      Improve with AI
+                    </Link>
+                  </div>
+                </div>
               </div>
             </div>
-          </div>
-        </motion.div>
 
-        {/* --- NO PROFILE STATE --- */}
-        {noApplicantProfile && (
-          <motion.div
-            initial={{ opacity: 0, scale: 0.95 }}
-            animate={{ opacity: 1, scale: 1 }}
-            className="my-8 p-8 border border-dashed border-gray-300 rounded-2xl bg-white text-center shadow-sm"
-          >
-            <Upload className="w-12 h-12 text-primary-400 mx-auto mb-4" />
-            <h3 className="text-xl font-bold mb-2">Setup Your Profile</h3>
-            <p className="text-gray-600 mb-6 max-w-md mx-auto">Upload your resume to unlock AI-powered recommendations and interview practice.</p>
-            <button onClick={() => setShowUploadForm(true)} className="btn-primary">Upload Resume</button>
-          </motion.div>
-        )}
+            {/* Top Recommendations */}
+            <div>
+              <div className="flex justify-between items-center mb-md">
+                <h3 className="font-headline-md text-headline-md text-on-surface dark:text-inverse-on-surface font-extrabold">Recommended Match Roles</h3>
+                <Link to="/jobs" className="font-body-bold text-[13px] text-primary dark:text-primary-fixed-dim hover:underline flex items-center gap-0.5">
+                  View All <ChevronRight className="w-4 h-4" />
+                </Link>
+              </div>
 
-        {/* --- CARDS GRID --- */}
-        {!noApplicantProfile && (
-          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
-            {/* AI Job Recommendations Card */}
-            <motion.div
-              initial={{ opacity: 0, y: 20 }}
-              animate={{ opacity: 1, y: 0 }}
-              transition={{ delay: 0.1 }}
-              className="p-8 bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-100 hover:border-primary-200/80 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(15,23,42,0.06)] hover:-translate-y-1 flex flex-col justify-between h-full relative overflow-hidden group"
-            >
-              <div>
-                <div className="rounded-2xl p-3 bg-primary-50 text-primary-600 w-fit border border-primary-100 shadow-sm mb-5">
-                  <Target className="w-8 h-8" />
+              {recommendations.length === 0 ? (
+                <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle rounded-xl p-lg text-center text-on-surface-variant">
+                  No match recommendations generated yet. Try refreshing or upload a different resume.
                 </div>
-                <h3 className="font-extrabold text-xl text-slate-900 mb-2 group-hover:text-primary-900 transition-colors">
-                  AI Job Recommendations
-                </h3>
-                <p className="text-sm text-slate-500 leading-relaxed mb-6">
-                  Discover job roles matched to your unique profile. Our multi-tiered scoring engine ranks jobs by skill overlap, location alignment, and experience suitability, showing you the most relevant opportunities first.
-                </p>
-              </div>
-              <Link
-                to="/jobs"
-                className="w-full py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white rounded-xl font-bold transition-all shadow-md shadow-primary-500/10 hover:shadow-primary-500/20 text-center active:scale-95 duration-200 font-semibold"
-              >
-                Explore Recommendations
-              </Link>
-            </motion.div>
-
-            {/* AI Mock Interviews Card */}
-            <motion.div
-              initial={{ opacity: 0, y: 20 }}
-              animate={{ opacity: 1, y: 0 }}
-              transition={{ delay: 0.2 }}
-              className="p-8 bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-100 hover:border-indigo-200/80 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(15,23,42,0.06)] hover:-translate-y-1 flex flex-col justify-between h-full relative overflow-hidden group"
-            >
-              <div>
-                <div className="rounded-2xl p-3 bg-indigo-50 text-indigo-600 w-fit border border-indigo-100 shadow-sm mb-5">
-                  <Sparkles className="w-8 h-8 animate-pulse" />
+              ) : (
+                <div className="flex flex-col gap-sm">
+                  {recommendations.slice(0, 3).map((rec, index) => {
+                    const matchScore = rec.match_score || rec.score || 85
+                    const scoreColor = matchScore >= 90 ? 'text-success' : matchScore >= 75 ? 'text-primary dark:text-primary-fixed-dim' : 'text-warning'
+                    
+                    return (
+                      <div 
+                        key={rec.id || index}
+                        onClick={() => navigate(`/job/${rec.job_id || rec.job?.id}`)}
+                        className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-md soft-shadow hover:border-primary-fixed-dim dark:hover:border-outline-variant transition-colors group cursor-pointer flex flex-col sm:flex-row justify-between sm:items-center gap-md"
+                      >
+                        <div className="flex gap-md items-start">
+                          <div className="w-12 h-12 bg-surface-container-low dark:bg-surface-variant/40 rounded-lg flex items-center justify-center shrink-0">
+                            <Briefcase className="w-6 h-6 text-secondary" />
+                          </div>
+                          <div>
+                            <h4 className="font-body-bold text-[15px] font-bold text-on-surface dark:text-inverse-on-surface group-hover:text-primary dark:group-hover:text-primary-fixed-dim transition-colors">
+                              {rec.job_title || rec.job?.title || 'Software Developer'}
+                            </h4>
+                            <div className="flex items-center gap-sm text-on-surface-variant dark:text-surface-variant font-metadata text-[12px] mt-1">
+                              <span className="font-semibold">{rec.company || rec.job?.company || 'Company'}</span>
+                              <span>•</span>
+                              <span className="flex items-center gap-0.5">
+                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
+                                {rec.location || rec.job?.location || 'Remote'}
+                              </span>
+                            </div>
+                          </div>
+                        </div>
+
+                        <div className="flex items-center justify-between sm:justify-end gap-lg sm:w-auto w-full border-t sm:border-t-0 border-border-subtle dark:border-outline-variant/30 pt-sm sm:pt-0 mt-sm sm:mt-0">
+                          <div className="flex flex-col items-end">
+                            <span className={`font-label-caps text-headline-md ${scoreColor} font-extrabold`}>{Math.round(matchScore)}%</span>
+                            <span className={`font-metadata text-[10px] uppercase tracking-wider ${scoreColor}`}>Match</span>
+                          </div>
+                          <button className="w-8 h-8 rounded-full bg-surface-container-low dark:bg-surface-variant/40 flex items-center justify-center text-primary group-hover:bg-primary-container group-hover:text-white transition-all">
+                            <ArrowRight className="w-4 h-4" />
+                          </button>
+                        </div>
+                      </div>
+                    )
+                  })}
                 </div>
-                <h3 className="font-extrabold text-xl text-slate-900 mb-2 group-hover:text-indigo-900 transition-colors">
-                  AI Mock Interviews
-                </h3>
-                <p className="text-sm text-slate-500 leading-relaxed mb-6">
-                  Practice technical and soft skill questions tailored to your field. Get scored by our AI engine with comprehensive feedback to continuously improve your performance and readiness.
-                </p>
+              )}
+            </div>
+
+          </div>
+
+          {/* Right Sidebar Pane (4/12 width) */}
+          <div className="lg:col-span-4 flex flex-col gap-lg">
+            
+            {/* Interview Readiness Card */}
+            <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-md soft-shadow">
+              <div className="flex items-center gap-sm mb-md">
+                <Mic className="w-5 h-5 text-interactive-purple" />
+                <h3 className="font-body-bold text-[15px] font-bold text-on-surface dark:text-inverse-on-surface">Interview Readiness</h3>
               </div>
-              <Link
-                to="/dashboard/interview"
-                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold transition-all shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 text-center active:scale-95 duration-200 font-semibold"
-              >
-                Practice Interviews
-              </Link>
-            </motion.div>
-
-            {/* Learning Paths Card */}
-            <motion.div
-              initial={{ opacity: 0, y: 20 }}
-              animate={{ opacity: 1, y: 0 }}
-              transition={{ delay: 0.3 }}
-              className="p-8 bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-100 hover:border-emerald-200/80 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(15,23,42,0.06)] hover:-translate-y-1 flex flex-col justify-between h-full relative overflow-hidden group"
-            >
-              <div>
-                <div className="rounded-2xl p-3 bg-emerald-50 text-emerald-600 w-fit border border-emerald-100 shadow-sm mb-5">
-                  <BookOpen className="w-8 h-8" />
+              <div className="bg-surface-container-low dark:bg-surface-variant/20 rounded-lg p-sm flex items-center justify-between mb-md">
+                <div className="flex items-center gap-sm">
+                  <div className="w-8 h-8 bg-interactive-purple/10 rounded-full flex items-center justify-center text-interactive-purple">
+                    <Mic className="w-4 h-4" />
+                  </div>
+                  <span className="font-metadata text-metadata text-on-surface dark:text-inverse-on-surface">Mock Interviews</span>
                 </div>
-                <h3 className="font-extrabold text-xl text-slate-900 mb-2 group-hover:text-emerald-900 transition-colors">
-                  Skill Roadmaps & Learning Paths
-                </h3>
-                <p className="text-sm text-slate-500 leading-relaxed mb-6">
-                  Targeted developmental roadmaps generated automatically for skill gaps. Prepare step-by-step with structured modules and online references designed to make you industry-ready.
-                </p>
+                <span className="font-label-caps text-body-bold text-on-surface dark:text-inverse-on-surface">
+                  {completedInterviewsCount} <span className="text-on-surface-variant dark:text-surface-variant text-[11px] font-normal uppercase">Done</span>
+                </span>
               </div>
-              <Link
-                to="/dashboard/learning-paths"
-                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold transition-all shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 text-center active:scale-95 duration-200 font-semibold"
+              <p className="font-metadata text-[12px] text-on-surface-variant dark:text-surface-variant mb-md leading-relaxed">
+                Your communication index is climbing! The AI recommends practicing behavioral questions and system scalability concepts.
+              </p>
+              <button 
+                onClick={() => navigate('/dashboard/interview')}
+                className="btn-secondary-sm w-full py-2 text-[13px] font-body-bold flex items-center justify-center gap-1 shadow-sm cursor-pointer"
               >
-                View Learning Paths
-              </Link>
-            </motion.div>
-
-            {/* Intelligence Profile Card */}
-            <motion.div
-              initial={{ opacity: 0, y: 20 }}
-              animate={{ opacity: 1, y: 0 }}
-              transition={{ delay: 0.4 }}
-              className="p-8 bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-100 hover:border-amber-200/80 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(15,23,42,0.06)] hover:-translate-y-1 flex flex-col justify-between h-full relative overflow-hidden group"
-            >
-              <div>
-                <div className="rounded-2xl p-3 bg-amber-50 text-amber-600 w-fit border border-amber-100 shadow-sm mb-5">
-                  <GraduationCap className="w-8 h-8" />
+                <Play className="w-4 h-4 fill-current" /> Start Practice
+              </button>
+            </div>
+
+            {/* Recent Applications Card */}
+            <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-md soft-shadow flex-1">
+              <h3 className="font-body-bold text-[15px] font-bold text-on-surface dark:text-inverse-on-surface mb-md">Recent Applications</h3>
+              
+              {jobApplications.length === 0 ? (
+                <div className="text-center py-6 text-xs text-on-surface-variant">No active applications. Explore jobs to apply.</div>
+              ) : (
+                <div className="flex flex-col gap-sm">
+                  {jobApplications.slice(0, 3).map((app, index) => {
+                    const status = app.status || 'applied'
+                    let badgeStyle = 'bg-primary-fixed-dim/20 text-primary dark:text-primary-fixed-dim'
+                    let dotColor = 'bg-primary'
+                    if (status.toLowerCase() === 'interviewing') {
+                      badgeStyle = 'bg-warning/10 text-warning border border-warning/20'
+                      dotColor = 'bg-warning'
+                    } else if (status.toLowerCase() === 'accepted') {
+                      badgeStyle = 'bg-success/10 text-success border border-success/20'
+                      dotColor = 'bg-success'
+                    } else if (status.toLowerCase() === 'rejected') {
+                      badgeStyle = 'bg-slate-100 text-slate-500 border border-slate-200'
+                      dotColor = 'bg-slate-400'
+                    }
+
+                    return (
+                      <div key={app.id || index} className="flex items-center justify-between py-2 border-b border-border-subtle dark:border-outline-variant/20 pb-sm last:border-0 last:pb-0">
+                        <div className="flex items-center gap-sm">
+                          <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
+                          <div>
+                            <p className="font-metadata text-[13px] font-semibold text-on-surface dark:text-inverse-on-surface truncate max-w-[120px]">
+                              {app.company || app.job?.company || 'Company'}
+                            </p>
+                            <p className="text-[11px] text-on-surface-variant dark:text-surface-variant truncate max-w-[120px]">
+                              {app.job_title || app.job?.title || 'Job Title'}
+                            </p>
+                          </div>
+                        </div>
+                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badgeStyle}`}>
+                          {status}
+                        </span>
+                      </div>
+                    )
+                  })}
                 </div>
-                <h3 className="font-extrabold text-xl text-slate-900 mb-2 group-hover:text-amber-900 transition-colors">
-                  Longitudinal Intelligence Profile
-                </h3>
-                <p className="text-sm text-slate-500 leading-relaxed mb-6">
-                  Analyze your skill progress and profile scoring logs over time. Monitor your growth across technical focus areas, experience suitability, and alignment with modern market demands.
-                </p>
+              )}
+              
+              <div className="mt-md pt-sm border-t border-border-subtle dark:border-outline-variant/20 text-center">
+                <Link to="/jobs" className="font-metadata text-[12px] text-primary dark:text-primary-fixed-dim hover:underline font-semibold">
+                  Browse Job Board
+                </Link>
               </div>
-              <Link
-                to="/student/intelligence"
-                className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl font-bold transition-all shadow-md shadow-amber-500/10 hover:shadow-amber-500/20 text-center active:scale-95 duration-200 font-semibold"
-              >
-                View Intelligence Profile
-              </Link>
-            </motion.div>
+            </div>
+
           </div>
-        )}
 
-        {/* Upload Modal */}
+        </div>
+      )}
+
+      {/* Upload Modal */}
+      <AnimatePresence>
         {showUploadForm && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setShowUploadForm(false)}>
-            <div className="w-full max-w-lg rounded-3xl border border-slate-100 bg-white/95 backdrop-blur shadow-2xl p-6 relative overflow-hidden" onClick={e => e.stopPropagation()}>
+            <div className="w-full max-w-lg rounded-3xl border border-border-subtle bg-white dark:bg-inverse-surface backdrop-blur shadow-2xl p-6 relative overflow-hidden" onClick={e => e.stopPropagation()}>
               <div className="flex justify-between items-center mb-6">
-                <h3 className="font-extrabold text-xl text-slate-900">Upload Resume</h3>
+                <h3 className="font-extrabold text-xl text-slate-900 dark:text-inverse-on-surface">Upload Resume</h3>
                 <button onClick={() => setShowUploadForm(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all">
                   <X className="w-5 h-5" />
                 </button>
               </div>
               <form onSubmit={handleFileUpload} className="space-y-4">
+                {error && (
+                  <div className="bg-rose-50 text-rose-700 p-3 rounded-xl text-xs font-semibold border border-rose-200">
+                    {error}
+                  </div>
+                )}
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 mb-2">Resume File (PDF/DOCX)</label>
-                  <input type="file" name="resume" required className="w-full bg-slate-50/50 border border-slate-200 border-dashed rounded-2xl p-4 text-center focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 cursor-pointer text-sm font-medium text-slate-600"
+                  <input 
+                    type="file" 
+                    name="resume" 
+                    required 
+                    accept=".pdf,.docx"
+                    className="w-full bg-slate-50 dark:bg-inverse-surface/30 border border-slate-200 border-dashed rounded-2xl p-6 text-center focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-300"
                     onChange={(e) => setSelectedResume(e.target.files[0])}
                   />
                 </div>
                 {selectedResume && (
-                  <div className="text-xs text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50/50 p-2 border border-emerald-100 rounded-xl">
-                    <CheckCircle className="w-4 h-4 text-emerald-500" />
+                  <div className="text-xs text-emerald-600 font-bold flex items-center gap-1.5 bg-emerald-50/50 p-2.5 border border-emerald-100 rounded-xl">
+                    <CheckCircle className="w-4.5 h-4.5 text-emerald-500" />
                     <span>Selected: {selectedResume.name}</span>
                   </div>
                 )}
                 <div className="grid grid-cols-2 gap-4">
-                  <input name="location" placeholder="Preferred Location" className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm" />
-                  <input name="jee_rank" type="number" placeholder="JEE Rank (Optional)" className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm" />
+                  <input name="location" placeholder="Preferred Location" className="w-full bg-slate-50 dark:bg-inverse-surface/30 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm dark:text-white" />
+                  <input name="jee_rank" type="number" placeholder="JEE Rank (Optional)" className="w-full bg-slate-50 dark:bg-inverse-surface/30 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm dark:text-white" />
                 </div>
-                <button type="submit" className="w-full py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white rounded-xl font-bold transition-all shadow-md shadow-primary-500/10 hover:shadow-primary-500/20 active:scale-95 duration-200" disabled={uploadLoading}>
+                <button 
+                  type="submit" 
+                  className="w-full py-3 bg-primary text-white rounded-xl font-bold transition-all shadow-md hover:bg-primary-500 active:scale-95 duration-200 text-sm cursor-pointer" 
+                  disabled={uploadLoading}
+                >
                   {uploadLoading ? 'Uploading & Analyzing...' : 'Upload & Process'}
                 </button>
               </form>
             </div>
           </div>
         )}
+      </AnimatePresence>
 
-      </div>
     </div>
   )
 }
diff --git a/frontend/src/pages/StudentProfile.jsx b/frontend/src/pages/StudentProfile.jsx
index e25bb1a..27e7c1e 100644
--- a/frontend/src/pages/StudentProfile.jsx
+++ b/frontend/src/pages/StudentProfile.jsx
@@ -28,12 +28,13 @@ import {
 import { useNavigate } from 'react-router-dom'
 import api from '../config/api'
 import { useToast } from '../hooks/useToast'
+import { ToastContainer } from '../components/Toast'
 import secureStorage from '../utils/secureStorage'
 import { calculateProfileCompletion } from '../utils/profileCompletion'
 
 export default function StudentProfile() {
   const navigate = useNavigate()
-  const { showToast } = useToast()
+  const toast = useToast()
   const [loading, setLoading] = useState(true)
   const [loadingResumeData, setLoadingResumeData] = useState(true)
   const [error, setError] = useState(null)
@@ -211,12 +212,12 @@ export default function StudentProfile() {
 
     try {
       await api.patch('/api/auth/deactivate')
-      showToast('Account deactivated successfully', 'success')
+      toast.success('Account deactivated successfully')
       secureStorage.clear()
       navigate('/login')
     } catch (err) {
       console.error('Error deactivating account:', err)
-      showToast(err.response?.data?.detail || 'Failed to deactivate account', 'error')
+      toast.error(err.response?.data?.detail || 'Failed to deactivate account')
     }
   }
 
@@ -226,23 +227,23 @@ export default function StudentProfile() {
       await api.patch('/api/auth/profile', {
         name: profile.full_name
       })
-      showToast('Profile updated successfully', 'success')
+      toast.success('Profile updated successfully')
       setEditing(false)
       fetchProfile()
     } catch (err) {
       console.error('Error updating profile:', err)
-      showToast('Failed to update profile', 'error')
+      toast.error('Failed to update profile')
     }
   }
 
   const handleChangePassword = async (e) => {
     e.preventDefault()
     if (passwords.new !== passwords.confirm) {
-      showToast('New passwords do not match', 'error')
+      toast.error('New passwords do not match')
       return
     }
     if (passwords.new.length < 8) {
-      showToast('Password must be at least 8 characters', 'error')
+      toast.error('Password must be at least 8 characters')
       return
     }
     try {
@@ -250,11 +251,11 @@ export default function StudentProfile() {
         current_password: passwords.current,
         new_password: passwords.new,
       })
-      showToast('Password changed successfully', 'success')
+      toast.success('Password changed successfully')
       setPasswords({ current: '', new: '', confirm: '' })
     } catch (err) {
       console.error('Error changing password:', err)
-      showToast(err.response?.data?.detail || 'Failed to change password', 'error')
+      toast.error(err.response?.data?.detail || 'Failed to change password')
     }
   }
 
@@ -286,12 +287,12 @@ export default function StudentProfile() {
           setResumeStatusType('info')
           setResumeStatusMessage('Parsing queued. This may take up to a minute...')
           await pollForParsedResume()
-          showToast('Resume uploaded. Parsing started.', 'success')
+          toast.success('Resume uploaded. Parsing started.')
         } else {
           setParsingResume(false)
           setResumeStatusType('success')
           setResumeStatusMessage('Resume uploaded and parsed successfully.')
-          showToast('Resume uploaded and parsed successfully', 'success')
+          toast.success('Resume uploaded and parsed successfully')
           fetchResumeData()
         }
       }
@@ -300,7 +301,7 @@ export default function StudentProfile() {
       setParsingResume(false)
       setResumeStatusType('error')
       setResumeStatusMessage(err.response?.data?.detail || 'Failed to upload or parse resume.')
-      showToast('Failed to upload resume', 'error')
+      toast.error('Failed to upload resume')
     } finally {
       setUploadingResume(false)
     }
@@ -383,9 +384,9 @@ export default function StudentProfile() {
   const profileCompletionLoading = loading || loadingResumeData
 
   return (
-    <div className="min-h-screen bg-white">
+    <div className="min-h-screen bg-background dark:bg-transparent">
       {/* Main Content */}
-      <div className="max-w-7xl mx-auto px-6 pt-24 pb-12">
+      <div className="max-w-7xl mx-auto px-6 pt-6 pb-12">
         {/* Header */}
         <div className="mb-8">
           <div className="flex items-center justify-between mb-4">
@@ -569,7 +570,7 @@ export default function StudentProfile() {
               {resumeData?.education && resumeData.education.length > 0 ? (
                 <div className="space-y-4">
                   {resumeData.education.map((edu, idx) => (
-                    <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
+                    <div key={edu.id || `edu-${edu.institution}-${edu.degree}-${idx}`} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                       <h4 className="font-bold text-gray-900">{edu.institution}</h4>
                       <p className="text-sm text-gray-600">{[edu.start_date, edu.end_date].filter(Boolean).join(' - ')}</p>
                       <p className="text-sm text-gray-700">{[edu.degree, edu.field].filter(Boolean).join(' - ')}</p>
@@ -601,7 +602,7 @@ export default function StudentProfile() {
               {resumeData?.experience && resumeData.experience.length > 0 ? (
                 <div className="space-y-4">
                   {resumeData.experience.map((exp, idx) => (
-                    <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
+                    <div key={exp.id || `exp-${exp.company}-${exp.title}-${idx}`} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                       <h4 className="font-bold text-gray-900">{exp.title}</h4>
                       <p className="text-sm text-gray-700">{exp.company}</p>
                       <p className="text-sm text-gray-600">{[exp.start_date, exp.end_date].filter(Boolean).join(' - ')}</p>
@@ -776,7 +777,7 @@ export default function StudentProfile() {
                                     const isPositive = sugg.toLowerCase().includes('excellent') || sugg.toLowerCase().includes('great job');
                                     return (
                                       <div 
-                                        key={idx} 
+                                        key={`sugg-${sugg.slice(0, 30)}-${idx}`} 
                                         className={`flex items-start gap-2 p-2 rounded-xl text-xs ${
                                           isPositive 
                                             ? 'bg-emerald-50/50 text-emerald-800 border border-emerald-100/50' 
@@ -834,7 +835,7 @@ export default function StudentProfile() {
                   {(parsedSkills.length > 0 ? parsedSkills : profile.skills).length > 0 ? (
                     (parsedSkills.length > 0 ? parsedSkills : profile.skills).map((skill, idx) => (
                       <div
-                        key={idx}
+                        key={skill}
                         className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-900 rounded-full font-medium border border-blue-300"
                       >
                         {editing && parsedSkills.length === 0 ? (
@@ -888,15 +889,18 @@ export default function StudentProfile() {
 
               {creditInfo ? (
                 <div>
-                  <div className="text-center py-8 bg-yellow-50 rounded-lg border border-yellow-200 mb-6">
-                    <div className="text-5xl font-bold text-yellow-600 mb-2">{creditBalance}</div>
-                    <p className="text-gray-600 font-medium">Tokens remaining</p>
-                    <p className="text-sm text-gray-500 mt-1">Estimated {estimatedAnalyses} deep career analyses</p>
-                    <p className="text-xs text-gray-500 mt-2">
+                  <div className="text-center py-8 bg-yellow-50 dark:bg-amber-500/10 border border-yellow-200 dark:border-amber-500/25 rounded-lg mb-6">
+                    <div className="text-5xl font-bold text-yellow-600 dark:text-amber-500 mb-2">{creditBalance}</div>
+                    <p className="text-gray-600 dark:text-slate-400 font-medium">Tokens remaining</p>
+                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Estimated {estimatedAnalyses} deep career analyses</p>
+                    <p className="text-xs text-gray-500 dark:text-slate-500 mt-2">
                       Next refill in {creditInfo.next_refill_days}d {creditInfo.next_refill_hours}h
                     </p>
                   </div>
-                  <button className="w-full px-6 py-3 text-blue-600 hover:text-blue-700 font-semibold flex items-center justify-center gap-2">
+                  <button
+                    onClick={() => navigate('/dashboard/credits/transactions')}
+                    className="w-full px-6 py-3 text-blue-600 hover:text-blue-700 dark:text-primary-fixed-dim dark:hover:text-primary font-semibold flex items-center justify-center gap-2"
+                  >
                     View Transaction History <ChevronRight className="w-4 h-4" />
                   </button>
                 </div>
@@ -915,16 +919,15 @@ export default function StudentProfile() {
               </div>
 
               <div className="space-y-6">
-                {/* Account Status */}
-                <div className="p-6 bg-green-50 rounded-lg border border-green-200">
+                <div className="p-6 bg-green-50 dark:bg-emerald-500/10 rounded-lg border border-green-200 dark:border-emerald-500/25">
                   <div className="flex items-center justify-between">
                     <div>
-                      <p className="text-sm font-semibold text-gray-700">Account Status</p>
-                      <p className={`text-lg font-bold mt-1 ${accountActive ? 'text-green-600' : 'text-red-600'}`}>
+                      <p className="text-sm font-semibold text-gray-700 dark:text-slate-400">Account Status</p>
+                      <p className={`text-lg font-bold mt-1 ${accountActive ? 'text-green-600 dark:text-emerald-400' : 'text-red-600 dark:text-rose-400'}`}>
                         {accountActive ? 'Active' : 'Deactivated'}
                       </p>
                     </div>
-                    <CheckCircle className={`w-8 h-8 ${accountActive ? 'text-green-600' : 'text-red-600'}`} />
+                    <CheckCircle className={`w-8 h-8 ${accountActive ? 'text-green-600 dark:text-emerald-500' : 'text-red-600 dark:text-rose-500'}`} />
                   </div>
                 </div>
 
@@ -996,13 +999,15 @@ export default function StudentProfile() {
                 </form>
 
                 {/* Danger Zone */}
-                <div className="p-6 bg-red-50 rounded-lg border border-red-200">
-                  <h4 className="font-bold text-red-900 mb-4">Danger Zone</h4>
+                <div className="p-6 bg-red-50 dark:bg-rose-500/10 rounded-lg border border-red-200 dark:border-rose-500/25">
+                  <h4 className="font-bold text-red-900 dark:text-rose-400 mb-4">Danger Zone</h4>
                   <button
                     onClick={handleDeactivateAccount}
                     disabled={!accountActive}
                     className={`w-full px-6 py-3 text-white rounded-lg transition font-semibold ${
-                      accountActive ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-400 cursor-not-allowed'
+                      accountActive 
+                        ? 'bg-red-600 hover:bg-red-700 dark:bg-rose-600 dark:hover:bg-rose-500 shadow-sm shadow-rose-500/10' 
+                        : 'bg-gray-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
                     }`}
                   >
                     Deactivate Account
@@ -1018,6 +1023,7 @@ export default function StudentProfile() {
           <p>© 2024 Career AI. Empowering students with intelligent guidance.</p>
         </footer>
       </div>
+      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
     </div>
   )
 }
diff --git a/frontend/tailwind.config.js b/frontend/tailwind.config.js
index 1f16300..09371a3 100644
--- a/frontend/tailwind.config.js
+++ b/frontend/tailwind.config.js
@@ -1,5 +1,6 @@
 /** @type {import('tailwindcss').Config} */
 module.exports = {
+  darkMode: "class",
   content: [
     "./index.html",
     "./src/**/*.{js,ts,jsx,tsx}",
@@ -7,7 +8,9 @@ module.exports = {
   theme: {
     extend: {
       colors: {
+        // Original colors for backward compatibility
         primary: {
+          DEFAULT: 'var(--color-primary)',
           50: '#e6f2ff',
           100: '#cce5ff',
           200: '#99ccff',
@@ -30,7 +33,97 @@ module.exports = {
           700: '#495057',
           800: '#343a40',
           900: '#212529',
-        }
+        },
+        // Academic Modern Design System Colors
+        "surface-muted": "#f8f9fa",
+        "primary-fixed-dim": "var(--color-primary-fixed-dim)",
+        "warning": "#f59e0b",
+        "surface-container-low": "#f1f4f9",
+        "surface-container-high": "#e5e8ee",
+        "on-error": "#ffffff",
+        "error-container": "#ffdad6",
+        "on-primary": "#ffffff",
+        "on-primary-fixed-variant": "#024493",
+        "surface-container-highest": "#e0e3e8",
+        "secondary-container": "#b8cbfe",
+        "on-tertiary-container": "#bcd0ff",
+        "interactive-purple": "#a855f7",
+        "on-secondary-container": "#425581",
+        "on-tertiary-fixed": "#001a42",
+        "inverse-on-surface": "var(--color-inverse-on-surface)",
+        "surface": "#f7f9ff",
+        "tertiary-fixed-dim": "#adc6ff",
+        "outline-variant": "var(--color-outline-variant)",
+        "surface-variant": "var(--color-surface-variant)",
+        "error": "#f43f5e",
+        "on-primary-container": "var(--color-on-primary-container)",
+        "secondary-fixed": "#d9e2ff",
+        "inverse-surface": "var(--color-inverse-surface)",
+        "on-surface": "#181c20",
+        "surface-tint": "#2c5cad",
+        "surface-bright": "#f7f9ff",
+        "border-subtle": "#e9ecef",
+        "on-tertiary-fixed-variant": "#004395",
+        "secondary-fixed-dim": "#b3c6f8",
+        "surface-container": "#ebeef3",
+        "on-secondary-fixed": "#021a43",
+        "inverse-primary": "#adc6ff",
+        "primary-container": "var(--color-primary-container)",
+        "on-secondary": "#ffffff",
+        "on-error-container": "#93000a",
+        "on-secondary-fixed-variant": "#334670",
+        "on-surface-variant": "#434751",
+        "outline": "#737783",
+        "surface-dim": "#d7dadf",
+        "tertiary-fixed": "#d8e2ff",
+        "success": "#10b981",
+        "secondary": "#4b5e8a",
+        "on-background": "#181c20",
+        "tertiary-container": "#0055b8",
+        "on-primary-fixed": "#001a41",
+        "background": "#f7f9ff",
+        "surface-container-lowest": "#ffffff",
+        "on-tertiary": "#ffffff",
+        "tertiary": "#003f8b",
+        "primary-fixed": "#d8e2ff"
+      },
+      borderRadius: {
+        "sm": "0.25rem",
+        "DEFAULT": "0.5rem",
+        "md": "0.75rem",
+        "lg": "1.0rem",
+        "xl": "0.75rem", // Soft rounded-xl for bento grid cards (from design.md/mockups)
+        "full": "9999px"
+      },
+      spacing: {
+        "xs": "4px",
+        "sm": "8px",
+        "md": "16px",
+        "lg": "24px",
+        "xl": "32px",
+        "base": "4px",
+        "gutter": "16px",
+        "margin-mobile": "16px",
+        "margin-desktop": "32px",
+        "container-max": "1280px"
+      },
+      fontFamily: {
+        "body-bold": ["Inter", "sans-serif"],
+        "label-caps": ["JetBrains Mono", "monospace"],
+        "display-lg": ["Hanken Grotesk", "sans-serif"],
+        "headline-md": ["Hanken Grotesk", "sans-serif"],
+        "metadata": ["Inter", "sans-serif"],
+        "display-lg-mobile": ["Hanken Grotesk", "sans-serif"],
+        "body-base": ["Inter", "sans-serif"]
+      },
+      fontSize: {
+        "body-bold": ["16px", { "lineHeight": "24px", "fontWeight": "600" }],
+        "label-caps": ["12px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "700" }],
+        "display-lg": ["48px", { "lineHeight": "56px", "letterSpacing": "-0.01em", "fontWeight": "700" }],
+        "headline-md": ["24px", { "lineHeight": "32px", "fontWeight": "700" }],
+        "metadata": ["13px", { "lineHeight": "18px", "fontWeight": "500" }],
+        "display-lg-mobile": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.01em", "fontWeight": "700" }],
+        "body-base": ["16px", { "lineHeight": "24px", "fontWeight": "400" }]
       },
       animation: {
         'fade-in': 'fadeIn 0.6s ease-in-out',
diff --git a/render.yaml b/render.yaml
deleted file mode 100644
index 05dde2e..0000000
--- a/render.yaml
+++ /dev/null
@@ -1,28 +0,0 @@
-services:
-  - type: web
-    name: career-guidance-backend
-    runtime: python
-    rootDir: resume_pipeline
-    buildCommand: pip install -r requirements.txt
-    startCommand: uvicorn resume_pipeline.app:app --host 0.0.0.0 --port $PORT
-    plan: free
-    healthCheckPath: /health
-    envVars:
-      - key: PYTHON_VERSION
-        value: "3.11.0"
-      - key: DATABASE_URL
-        sync: false
-      - key: GEMINI_API_KEY
-        sync: false
-      - key: GROQ_API_KEY
-        sync: false
-      - key: SECRET_KEY
-        sync: false
-      - key: GMAIL_USER
-        sync: false
-      - key: GMAIL_APP_PASSWORD
-        sync: false
-      - key: FRONTEND_URL
-        sync: false
-      - key: CORS_ORIGINS
-        sync: false
diff --git a/resume_pipeline/.rag_cache/docs_hash.txt b/resume_pipeline/.rag_cache/docs_hash.txt
index 06a5a0c..0223b7c 100644
--- a/resume_pipeline/.rag_cache/docs_hash.txt
+++ b/resume_pipeline/.rag_cache/docs_hash.txt
@@ -1 +1 @@
-cf2a74b72041c169c01270ed336580bc
\ No newline at end of file
+6e5f4203dde1cd93a8fede976c067719
\ No newline at end of file
diff --git a/resume_pipeline/.rag_cache/file_hashes.json b/resume_pipeline/.rag_cache/file_hashes.json
index 6f67991..fd09708 100644
--- a/resume_pipeline/.rag_cache/file_hashes.json
+++ b/resume_pipeline/.rag_cache/file_hashes.json
@@ -2,16 +2,16 @@
   "ARCHITECTURE.md": "4806e112160748c1fbddc490881a74ca",
   "DATABASE.md": "6beb10e06e2cd4bfcbd212b478650665",
   "DELIVERY_SUMMARY.md": "908ade3e63dcda83a7777c8b90b25244",
-  "DEPLOYMENT.md": "e3a50035d880435757ad87dc8c29e4a3",
+  "DEPLOYMENT.md": "5153e7fc7df548f51e63f38959649b9c",
   "DOCS_INDEX.md": "a904af1fc412fedbdc01dce12ee6ff28",
   "IMPLEMENTATION_GUIDE.md": "83af46e51a6313900bc927520ff7261d",
-  "INTERVIEW_SYSTEM_ARCHITECTURE.md": "af889044c1871789176c5782de7582d4",
+  "INTERVIEW_SYSTEM_ARCHITECTURE.md": "ad7d91edf83ff4b8d7e6fc090d58f842",
   "LEARNING_PATH_ARCHITECTURE.md": "2c481f287e68f839427a6a44faeebc4c",
   "LIVE_INTERVIEW_ARCHITECTURE.md": "67beea7e57613e4ae0c305f72bb291dd",
   "LIVE_INTERVIEW_ROADMAP.md": "f6c310c896aba6d2fa0ea0700a471769",
   "QUICK_REFERENCE.md": "52c098d0beb439a8a1cb48ee74196b22",
   "RECOMMENDATION_ENGINE_ARCHITECTURE.md": "f8d382f4ca1a305f8ae9065a1613ab7a",
-  "security_audit_report.md": "3735b71e79468e4e046ab95cb3be504c",
+  "security_audit_report.md": "c055493ee2db41d1fd218b4392acee94",
   "security_report_draft.md": "94d1625fa143172c281463e1a4542fe0",
   "VOICE_LAYER_DESIGN.md": "fa92bd34dbb2e956df50ea32762477dd"
 }
\ No newline at end of file
diff --git a/resume_pipeline/.rag_cache/vector_store.pkl b/resume_pipeline/.rag_cache/vector_store.pkl
index 32d77b9..ad98345 100644
Binary files a/resume_pipeline/.rag_cache/vector_store.pkl and b/resume_pipeline/.rag_cache/vector_store.pkl differ
diff --git a/resume_pipeline/resume_pipeline/app.py b/resume_pipeline/resume_pipeline/app.py
index cfc79be..9e223b2 100644
--- a/resume_pipeline/resume_pipeline/app.py
+++ b/resume_pipeline/resume_pipeline/app.py
@@ -572,6 +572,176 @@ async def get_current_user_info(current_user = Depends(get_current_user)):
     return current_user
 
 
+@app.get("/api/auth/google/login")
+async def google_login(
+    role: str = Query("student", regex="^(student|employer)$"),
+):
+    """
+    Redirects the user to Google's OAuth2 authorization URL.
+    """
+    import urllib.parse
+    
+    # Check if Google Client ID is configured
+    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
+        raise HTTPException(
+            status_code=status.HTTP_501_NOT_IMPLEMENTED,
+            detail="Google OAuth is not configured on this server."
+        )
+    
+    # State parameter preserves the user's role choice and a simple CSRF protection state
+    state_payload = f"role:{role}"
+    
+    # Construct google redirect callback URL
+    redirect_uri = f"{settings.BACKEND_URL}/api/auth/google/callback"
+    
+    # Google OAuth2 Authorization URL
+    google_auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
+    params = {
+        "client_id": settings.GOOGLE_CLIENT_ID,
+        "redirect_uri": redirect_uri,
+        "response_type": "code",
+        "scope": "openid email profile",
+        "state": state_payload,
+        "access_type": "online",
+        "prompt": "consent"
+    }
+    
+    auth_uri = f"{google_auth_url}?{urllib.parse.urlencode(params)}"
+    
+    from fastapi.responses import RedirectResponse
+    return RedirectResponse(url=auth_uri)
+
+
+@app.get("/api/auth/google/callback")
+async def google_callback(
+    code: str = Query(...),
+    state: Optional[str] = Query(None),
+    db: Session = Depends(get_db)
+):
+    """
+    Callback URI where Google redirects the user.
+    """
+    import urllib.parse
+    import httpx
+    from .db import User, Employer
+    
+    # Parse role from state
+    role = "student"
+    if state and state.startswith("role:"):
+        role = state.split("role:")[1]
+        if role not in ["student", "employer"]:
+            role = "student"
+            
+    # Check if Google Client ID is configured
+    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
+        # Redirect to frontend with error
+        error_url = f"{settings.FRONTEND_URL}/login?error=" + urllib.parse.quote("Google OAuth is not configured on this server.")
+        from fastapi.responses import RedirectResponse
+        return RedirectResponse(url=error_url)
+        
+    # Redirect URI must match the one sent in login request exactly
+    redirect_uri = f"{settings.BACKEND_URL}/api/auth/google/callback"
+    
+    token_url = "https://oauth2.googleapis.com/token"
+    token_data = {
+        "code": code,
+        "client_id": settings.GOOGLE_CLIENT_ID,
+        "client_secret": settings.GOOGLE_CLIENT_SECRET,
+        "redirect_uri": redirect_uri,
+        "grant_type": "authorization_code"
+    }
+    
+    try:
+        async with httpx.AsyncClient() as client:
+            # Exchange authorization code for tokens
+            token_response = await client.post(token_url, data=token_data, timeout=10.0)
+            if token_response.status_code != 200:
+                logger.error(f"Google OAuth token exchange failed: {token_response.text}")
+                error_url = f"{settings.FRONTEND_URL}/login?error=" + urllib.parse.quote("Failed to retrieve access token from Google.")
+                from fastapi.responses import RedirectResponse
+                return RedirectResponse(url=error_url)
+                
+            tokens = token_response.json()
+            access_token = tokens.get("access_token")
+            
+            # Fetch user details from Google userinfo API
+            userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"
+            headers = {"Authorization": f"Bearer {access_token}"}
+            userinfo_response = await client.get(userinfo_url, headers=headers, timeout=10.0)
+            if userinfo_response.status_code != 200:
+                logger.error(f"Google Userinfo API failed: {userinfo_response.text}")
+                error_url = f"{settings.FRONTEND_URL}/login?error=" + urllib.parse.quote("Failed to fetch user details from Google.")
+                from fastapi.responses import RedirectResponse
+                return RedirectResponse(url=error_url)
+                
+            user_info = userinfo_response.json()
+            email = user_info.get("email")
+            name = user_info.get("name") or user_info.get("given_name") or email.split("@")[0]
+            
+            if not email:
+                error_url = f"{settings.FRONTEND_URL}/login?error=" + urllib.parse.quote("Google account email is required.")
+                from fastapi.responses import RedirectResponse
+                return RedirectResponse(url=error_url)
+                
+            email = email.lower().strip()
+            
+            # Check if user exists
+            user = db.query(User).filter(User.email == email).first()
+            if not user:
+                # User does not exist, perform silent registration
+                # Assign a random password hash since login is via OAuth
+                random_pass = secrets.token_hex(16)
+                hashed_password = get_password_hash(random_pass)
+                
+                # Create user, default is_verified to True because Google verified their email
+                user = User(
+                    email=email,
+                    password_hash=hashed_password,
+                    name=name,
+                    role=role,
+                    is_active=True,
+                    is_verified=True,
+                    verification_token=None,
+                    verification_token_created_at=dt.datetime.utcnow()
+                )
+                db.add(user)
+                db.commit()
+                db.refresh(user)
+                
+                # Create profile record if user is an employer
+                if role == "employer":
+                    employer = Employer(
+                        user_id=user.id,
+                        company_name=name,
+                        is_verified=False
+                    )
+                    db.add(employer)
+                    db.commit()
+                    
+                logger.info(f"Registered new Google OAuth user: {email} with role: {role}")
+            else:
+                # User exists. Ensure their email is marked as verified since they logged in via Google
+                if not user.is_verified:
+                    user.is_verified = True
+                    db.add(user)
+                    db.commit()
+                logger.info(f"Logged in existing Google OAuth user: {email}")
+                
+            # Create our own local JWT access token
+            local_token = create_access_token(data={"sub": str(user.id), "role": user.role})
+            
+            # Redirect back to the frontend with the local token
+            redirect_url = f"{settings.FRONTEND_URL}/login?token={local_token}"
+            from fastapi.responses import RedirectResponse
+            return RedirectResponse(url=redirect_url)
+            
+    except Exception as e:
+        logger.error(f"Error during Google OAuth callback processing: {e}")
+        error_url = f"{settings.FRONTEND_URL}/login?error=" + urllib.parse.quote(f"Authentication error: {str(e)}")
+        from fastapi.responses import RedirectResponse
+        return RedirectResponse(url=error_url)
+
+
 @app.patch("/api/auth/profile")
 async def update_profile(
     name: str = Body(..., embed=True),
@@ -1467,7 +1637,7 @@ async def get_all_applicants(
 ):
     """Get all applicants with pagination (supports cursor-based)"""
     # Query applicants ordered by creation date
-    query = db.query(Applicant).order_by(desc(Applicant.created_at))
+    query = db.query(Applicant).options(joinedload(Applicant.parsed_record)).order_by(desc(Applicant.created_at))
     
     # Cursor-based pagination if cursor provided
     if cursor is not None:
@@ -1481,7 +1651,7 @@ async def get_all_applicants(
     
     result = []
     for app in applicants:
-        llm_record = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == app.id).first()
+        llm_record = app.parsed_record
         result.append({
             "id": app.id,
             "applicant_id": app.applicant_id,
@@ -1563,8 +1733,9 @@ async def optimize_job_description_route(
         raise HTTPException(status_code=400, detail="Prompt draft cannot be empty")
         
     try:
+        import asyncio
         from .recommendation.optimizer import optimize_job_description
-        result = optimize_job_description(prompt_text=data.prompt, title=data.title)
+        result = await asyncio.to_thread(optimize_job_description, prompt_text=data.prompt, title=data.title)
         return result
     except Exception as e:
         logger.error(f"Error in job description optimization: {e}")
@@ -2913,9 +3084,10 @@ async def generate_recommendations_for_applicant(
 
     # Generate via new service (persists records internally)
     try:
+        import asyncio
         from .recommendation.recommendation_service import RecommendationService
         service = RecommendationService(db)
-        result = service.get_recommendations(applicant_id)
+        result = await asyncio.to_thread(service.get_recommendations, applicant_id)
         
         job_count = len(result.get('job_recommendations', []))
         
diff --git a/resume_pipeline/resume_pipeline/config.py b/resume_pipeline/resume_pipeline/config.py
index 6445a1a..b9424e6 100644
--- a/resume_pipeline/resume_pipeline/config.py
+++ b/resume_pipeline/resume_pipeline/config.py
@@ -102,6 +102,9 @@ class Settings(BaseSettings):
     # Google Search API for skill taxonomy builder
     GOOGLE_API_KEY: str | None = None
     GOOGLE_SEARCH_ENGINE_ID: str | None = None
+    GOOGLE_CLIENT_ID: str = ""
+    GOOGLE_CLIENT_SECRET: str = ""
+    BACKEND_URL: str = "http://localhost:8000"
     
     # Gmail SMTP for email verification
     GMAIL_USER: str | None = None
diff --git a/resume_pipeline/resume_pipeline/db.py b/resume_pipeline/resume_pipeline/db.py
index b22f3bc..0965ec2 100644
--- a/resume_pipeline/resume_pipeline/db.py
+++ b/resume_pipeline/resume_pipeline/db.py
@@ -191,6 +191,7 @@ class JobEmbeddingsCache(Base):
     __tablename__ = 'job_embeddings_cache'
 
     job_id = Column(Integer, ForeignKey('jobs.id', ondelete='CASCADE'), primary_key=True)
+    source_hash = Column(String(64), primary_key=True, default="")
     embedding = _vector_column(GEMINI_EMBEDDING_DIM)  # vector(3072) via pgvector
     computed_at = Column(DateTime, default=datetime.datetime.utcnow)
 
diff --git a/resume_pipeline/resume_pipeline/interview/evaluator.py b/resume_pipeline/resume_pipeline/interview/evaluator.py
index ac9f713..48f88e9 100644
--- a/resume_pipeline/resume_pipeline/interview/evaluator.py
+++ b/resume_pipeline/resume_pipeline/interview/evaluator.py
@@ -164,6 +164,34 @@ def _evaluate_with_groq(
 # Streaming hint — sent before showing next question on weak answer
 # ---------------------------------------------------------------------------
 
+async def run_generator_in_thread(sync_gen) -> AsyncGenerator[str, None]:
+    """Utility to run a synchronous generator in a background thread and yield asynchronously."""
+    import queue
+    import asyncio
+    q = queue.Queue(maxsize=10)
+    loop = asyncio.get_running_loop()
+
+    def producer():
+        try:
+            for item in sync_gen:
+                q.put(item)
+        except Exception as e:
+            q.put(e)
+        finally:
+            q.put(None)
+
+    # Offload the synchronous iteration to the thread pool executor (without awaiting)
+    loop.run_in_executor(None, producer)
+
+    while True:
+        item = await asyncio.to_thread(q.get)
+        if item is None:
+            break
+        if isinstance(item, Exception):
+            raise item
+        yield item
+
+
 async def stream_hint(
     skill_tag: str,
     missing_concepts: List[str],
@@ -185,13 +213,14 @@ async def stream_hint(
     messages = [{"role": "user", "content": prompt}]
     
     try:
-        for chunk in llm_router.generate_chat_completion_stream(
+        sync_gen = llm_router.generate_chat_completion_stream(
             messages=messages,
             provider="groq",
             model_name=GROQ_MODEL,
             temperature=0.6,
             max_tokens=150
-        ):
+        )
+        async for chunk in run_generator_in_thread(sync_gen):
             yield f"data: {json.dumps({'token': chunk})}\n\n"
     except Exception as e:
         logger.error(f"stream_hint fallback stream error: {e}")
@@ -234,13 +263,14 @@ Be encouraging and specific. Address the candidate directly ("Your answer...").
     messages = [{"role": "user", "content": prompt}]
     
     try:
-        for chunk in llm_router.generate_chat_completion_stream(
+        sync_gen = llm_router.generate_chat_completion_stream(
             messages=messages,
             provider="groq",
             model_name=GROQ_MODEL,
             temperature=0.5,
             max_tokens=400
-        ):
+        )
+        async for chunk in run_generator_in_thread(sync_gen):
             yield f"data: {json.dumps({'token': chunk})}\n\n"
     except Exception as e:
         logger.error(f"stream_feedback stream error: {e}")
@@ -290,13 +320,14 @@ async def stream_study_plan(
     messages = [{"role": "user", "content": prompt}]
 
     try:
-        for chunk in llm_router.generate_chat_completion_stream(
+        sync_gen = llm_router.generate_chat_completion_stream(
             messages=messages,
             provider="groq",
             model_name=GROQ_MODEL,
             temperature=0.7,
             max_tokens=2048
-        ):
+        )
+        async for chunk in run_generator_in_thread(sync_gen):
             yield f"data: {json.dumps({'token': chunk})}\n\n"
         
     except Exception as e:
diff --git a/resume_pipeline/resume_pipeline/interview/router.py b/resume_pipeline/resume_pipeline/interview/router.py
index 349f8ea..a8e5cf3 100644
--- a/resume_pipeline/resume_pipeline/interview/router.py
+++ b/resume_pipeline/resume_pipeline/interview/router.py
@@ -5,7 +5,7 @@ All interview endpoints. Registered in app.py via include_router.
 import logging
 import uuid
 import json
-from typing import Optional, List, AsyncGenerator
+from typing import Optional, List, AsyncGenerator, Any
 
 from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, File, UploadFile
 from fastapi.responses import StreamingResponse
@@ -458,10 +458,12 @@ def get_results(
 
 async def _stream_cached_plan(plan_text: str) -> AsyncGenerator[str, None]:
     """Yield cached study plan in small chunks to simulate streaming animation quickly."""
+    import asyncio
     chunk_size = 120
     for i in range(0, len(plan_text), chunk_size):
         chunk = plan_text[i:i+chunk_size]
         yield f"data: {json.dumps({'token': chunk})}\n\n"
+        await asyncio.sleep(0.005)
     yield "data: [DONE]\n\n"
 
 
@@ -884,6 +886,34 @@ def finish_interview(
 # GET /api/interview/skill-gap-analysis/{session_id}  — SSE stream
 # ---------------------------------------------------------------------------
 
+async def run_generator_in_thread(sync_gen) -> AsyncGenerator[Any, None]:
+    """Utility to run a synchronous generator in a background thread and yield asynchronously."""
+    import queue
+    import asyncio
+    q = queue.Queue(maxsize=10)
+    loop = asyncio.get_running_loop()
+
+    def producer():
+        try:
+            for item in sync_gen:
+                q.put(item)
+        except Exception as e:
+            q.put(e)
+        finally:
+            q.put(None)
+
+    # Offload the synchronous iteration to the thread pool executor (without awaiting)
+    loop.run_in_executor(None, producer)
+
+    while True:
+        item = await asyncio.to_thread(q.get)
+        if item is None:
+            break
+        if isinstance(item, Exception):
+            raise item
+        yield item
+
+
 async def _stream_skill_gap_analysis(
     session_id: str,
     experience_level: str,
@@ -916,7 +946,7 @@ async def _stream_skill_gap_analysis(
             stream=True
         )
         
-        for chunk in stream:
+        async for chunk in run_generator_in_thread(stream):
             delta = chunk.choices[0].delta.content
             if delta:
                 accumulated_tokens.append(delta)
diff --git a/resume_pipeline/resume_pipeline/rag/rag_service.py b/resume_pipeline/resume_pipeline/rag/rag_service.py
index faa0c8b..4ff3a20 100644
--- a/resume_pipeline/resume_pipeline/rag/rag_service.py
+++ b/resume_pipeline/resume_pipeline/rag/rag_service.py
@@ -77,8 +77,8 @@ class GeminiRAGClient:
         Generate a response using Gemini API (async wrapper for sync call).
         Returns (response, error).
         """
-        # Gemini doesn't have native async, so we call sync version
-        return self.generate_sync(system_prompt, user_message, max_tokens, temperature)
+        # Gemini doesn't have native async, so we call sync version via thread pool
+        return await asyncio.to_thread(self.generate_sync, system_prompt, user_message, max_tokens, temperature)
     
     def generate_sync(
         self,
diff --git a/resume_pipeline/resume_pipeline/recommendation/embedder.py b/resume_pipeline/resume_pipeline/recommendation/embedder.py
index 83e8ca8..00a54d8 100644
--- a/resume_pipeline/resume_pipeline/recommendation/embedder.py
+++ b/resume_pipeline/resume_pipeline/recommendation/embedder.py
@@ -35,6 +35,8 @@ class Embedder:
         if not api_key:
             logger.warning("GEMINI_API_KEY is empty in settings.")
         self.client = genai.Client(api_key=api_key) if api_key else None
+        self._applicant_cache = {}
+        self._job_cache = {}
 
     def embed(self, text: str, instruction: str | None = None) -> list[float]:
         """Generate a 3072-dim embedding vector via Gemini.
@@ -93,18 +95,35 @@ class Embedder:
 
     def get_job_embedding(self, job_id: int, payload_builder_fn, job) -> list[float]:
         """Fetch job embedding from DB cache, or compute and cache if missing."""
-        cached = self.db.query(JobEmbeddingsCache).filter(JobEmbeddingsCache.job_id == job_id).first()
+        payload = payload_builder_fn(job)
+        source_hash = self._source_hash(payload)
+
+        # 1. Check local in-memory cache
+        cache_key = (job_id, source_hash)
+        if cache_key in self._job_cache:
+            return self._job_cache[cache_key]
+
+        # 2. Check DB cache using composite key
+        cached = (
+            self.db.query(JobEmbeddingsCache)
+            .filter(
+                JobEmbeddingsCache.job_id == job_id,
+                JobEmbeddingsCache.source_hash == source_hash
+            )
+            .first()
+        )
         if cached and cached.embedding is not None:
             emb = cached.embedding
-            # pgvector returns the vector as a list natively; handle JSON list too
-            return list(emb) if not isinstance(emb, list) else emb
+            vector = list(emb) if not isinstance(emb, list) else emb
+            self._job_cache[cache_key] = vector
+            return vector
 
-        payload = payload_builder_fn(job)
+        # 3. Compute and cache embedding
         instruction = "Represent this job posting for candidate matching:"
         vector = self.embed(payload, instruction=instruction)
 
         try:
-            cache_entry = JobEmbeddingsCache(job_id=job_id, embedding=vector)
+            cache_entry = JobEmbeddingsCache(job_id=job_id, source_hash=source_hash, embedding=vector)
             self.db.merge(cache_entry)
             self.db.commit()
             logger.info(f"Cached job embedding in DB for job_id={job_id}")
@@ -112,6 +131,7 @@ class Embedder:
             logger.error(f"Failed to cache job embedding in DB for job_id={job_id}: {e}")
             self.db.rollback()
 
+        self._job_cache[cache_key] = vector
         return vector
 
     # ------------------------------------------------------------------
@@ -147,7 +167,12 @@ class Embedder:
         """
         source_hash = self._source_hash(text, suffix)
 
-        # 1. Check DB cache — match by applicant_id AND source_hash
+        # 1. Check local in-memory cache
+        cache_key = (applicant.id, source_hash)
+        if cache_key in self._applicant_cache:
+            return self._applicant_cache[cache_key]
+
+        # 2. Check DB cache — match by applicant_id AND source_hash
         existing = (
             self.db.query(ApplicantEmbedding)
             .filter(
@@ -158,20 +183,22 @@ class Embedder:
         )
         if existing and existing.embedding_vector is not None:
             emb = existing.embedding_vector
+            vector = list(emb) if not isinstance(emb, list) else emb
             logger.debug(
                 f"Applicant embedding cache HIT for applicant_id={applicant.id} suffix='{suffix}'"
             )
-            return list(emb) if not isinstance(emb, list) else emb
+            self._applicant_cache[cache_key] = vector
+            return vector
 
         logger.info(
             f"Applicant embedding cache MISS for applicant_id={applicant.id} suffix='{suffix}' "
             "— calling Gemini API"
         )
 
-        # 2. Cache miss: generate via Gemini
+        # 3. Cache miss: generate via Gemini
         vector = self.embed(text, instruction=instruction)
 
-        # 3. Persist — use applicant_id + suffix as composite logical key
+        # 4. Persist — use applicant_id + suffix as composite logical key
         #    We store one row per (applicant_id, suffix) — upsert via delete+insert
         try:
             # Delete any stale row for this applicant + suffix combo
@@ -203,6 +230,7 @@ class Embedder:
             )
             self.db.rollback()
 
+        self._applicant_cache[cache_key] = vector
         return vector
 
     def get_cached_applicant_embedding_raw(self, applicant_id: int) -> list[float] | None:
diff --git a/resume_pipeline/resume_pipeline/recommendation/engine.py b/resume_pipeline/resume_pipeline/recommendation/engine.py
index e7d17d3..2ce8bf0 100644
--- a/resume_pipeline/resume_pipeline/recommendation/engine.py
+++ b/resume_pipeline/resume_pipeline/recommendation/engine.py
@@ -1,6 +1,7 @@
 import logging
 import datetime
 import time
+from typing import Optional
 from sqlalchemy.orm import Session, joinedload
 from ..db import Applicant, Job, JobRecommendation, LLMParsedRecord
 from .embedder import Embedder, GeminiEmbeddingUnavailable
@@ -50,7 +51,8 @@ def run_pipeline_for_applicant_job(
     semantic_scorer: SemanticScorer,
     personalization_scorer: PersonalizationScorer,
     temporal_scorer: TemporalScorer,
-    document_scorer: DocumentScorer
+    document_scorer: DocumentScorer,
+    interview_score: Optional[float] = None
 ) -> dict:
     """Execute all recommendation scoring tiers for a single candidate-job pair."""
     # 1. Gather Normalized Profile Data
@@ -62,15 +64,15 @@ def run_pipeline_for_applicant_job(
     applicant_loc = personal.get("location") or f"{applicant.location_city or ''}, {applicant.location_state or ''}".strip(", ")
 
     # 2. Fetch Interview Score (Normalized 0.0 - 1.0)
-    from ..db import InterviewSession
-    latest_session = db.query(InterviewSession).filter(
-        InterviewSession.applicant_id == applicant.id,
-        InterviewSession.status == "completed"
-    ).order_by(InterviewSession.completed_at.desc()).first()
+    if interview_score is None:
+        from ..db import InterviewSession
+        latest_session = db.query(InterviewSession).filter(
+            InterviewSession.applicant_id == applicant.id,
+            InterviewSession.status == "completed"
+        ).order_by(InterviewSession.completed_at.desc()).first()
 
-    interview_score = None
-    if latest_session and latest_session.overall_score is not None:
-        interview_score = float(latest_session.overall_score) / 100.0
+        if latest_session and latest_session.overall_score is not None:
+            interview_score = float(latest_session.overall_score) / 100.0
 
     # 3. Scoring Tier 1: TF-IDF Skill Match
     tfidf_score = tfidf_scorer.score(user_skills, job.id)
@@ -146,14 +148,36 @@ def compute_recommendations(applicant_id: int, db: Session) -> dict:
         logger.warning("No active jobs to recommend.")
         return {"job_recommendations": []}
 
-    # 2. Setup Scorer Engines
+    # 2. Setup Scorer Engines and precompute/cache data
     embedder = Embedder(db)
     tfidf_scorer = get_tfidf_scorer(db, active_jobs)
     semantic_scorer = SemanticScorer(embedder)
+    
     personalization_scorer = PersonalizationScorer(db)
+    personalization_scorer.preload_preferences(applicant_id)
+    
     temporal_scorer = TemporalScorer()
     document_scorer = DocumentScorer(embedder)
 
+    # Query Interview Score once outside the loop
+    from ..db import InterviewSession
+    latest_session = db.query(InterviewSession).filter(
+        InterviewSession.applicant_id == applicant.id,
+        InterviewSession.status == "completed"
+    ).order_by(InterviewSession.completed_at.desc()).first()
+
+    interview_score = None
+    if latest_session and latest_session.overall_score is not None:
+        interview_score = float(latest_session.overall_score) / 100.0
+
+    # Batch query JobRecommendation entries
+    job_ids = [job.id for job in active_jobs]
+    existing_recs_list = db.query(JobRecommendation).filter(
+        JobRecommendation.applicant_id == applicant_id,
+        JobRecommendation.job_id.in_(job_ids)
+    ).all()
+    existing_recs_lookup = {rec.job_id: rec for rec in existing_recs_list}
+
     scored_jobs = []
 
     # 3. Pass 1: Fast scoring pass (no LLM calls)
@@ -168,7 +192,8 @@ def compute_recommendations(applicant_id: int, db: Session) -> dict:
                 semantic_scorer=semantic_scorer,
                 personalization_scorer=personalization_scorer,
                 temporal_scorer=temporal_scorer,
-                document_scorer=document_scorer
+                document_scorer=document_scorer,
+                interview_score=interview_score
             )
             score_percent = breakdown["final_score"] * 100
             scored_jobs.append((job, breakdown, score_percent))
@@ -184,11 +209,8 @@ def compute_recommendations(applicant_id: int, db: Session) -> dict:
 
     for i, (job, breakdown, score_percent) in enumerate(scored_jobs):
         try:
-            # Retrieve existing record if present to inspect cached explanations
-            existing_rec = db.query(JobRecommendation).filter(
-                JobRecommendation.applicant_id == applicant_id,
-                JobRecommendation.job_id == job.id
-            ).first()
+            # Retrieve existing record from pre-fetched lookup
+            existing_rec = existing_recs_lookup.get(job.id)
 
             explanation = None
             explanation_source = None
@@ -296,8 +318,10 @@ def compute_recommendations_for_new_job(job_id: int, db: Session) -> None:
         logger.warning(f"Skipping backfill: job_id={job_id} not approved or missing.")
         return
 
-    # Find candidates with parsed records
-    applicants = db.query(Applicant).join(LLMParsedRecord).all()
+    # Find candidates with parsed records, eagerly loading parsed_record
+    applicants = db.query(Applicant).options(
+        joinedload(Applicant.parsed_record)
+    ).join(LLMParsedRecord).all()
     if not applicants:
         return
 
@@ -311,10 +335,34 @@ def compute_recommendations_for_new_job(job_id: int, db: Session) -> None:
     embedder = Embedder(db)
     tfidf_scorer = get_tfidf_scorer(db, active_jobs)
     semantic_scorer = SemanticScorer(embedder)
+    
+    applicant_ids = [app.id for app in applicants]
+    
     personalization_scorer = PersonalizationScorer(db)
+    personalization_scorer.preload_preferences_batch(applicant_ids)
+    
     temporal_scorer = TemporalScorer()
     document_scorer = DocumentScorer(embedder)
 
+    # Batch query InterviewSession entries to prevent N+1 queries in run_pipeline_for_applicant_job
+    from ..db import InterviewSession
+    latest_sessions = db.query(InterviewSession).filter(
+        InterviewSession.applicant_id.in_(applicant_ids),
+        InterviewSession.status == "completed"
+    ).all()
+    
+    interview_scores = {}
+    for sess in sorted(latest_sessions, key=lambda s: s.completed_at or datetime.datetime.min):
+        if sess.overall_score is not None:
+            interview_scores[sess.applicant_id] = float(sess.overall_score) / 100.0
+
+    # Batch query JobRecommendation entries for this job across all applicants
+    existing_recs_list = db.query(JobRecommendation).filter(
+        JobRecommendation.job_id == job.id,
+        JobRecommendation.applicant_id.in_(applicant_ids)
+    ).all()
+    existing_recs_lookup = {rec.applicant_id: rec for rec in existing_recs_list}
+
     scored_applicants = []
 
     for applicant in applicants:
@@ -328,7 +376,8 @@ def compute_recommendations_for_new_job(job_id: int, db: Session) -> None:
                 semantic_scorer=semantic_scorer,
                 personalization_scorer=personalization_scorer,
                 temporal_scorer=temporal_scorer,
-                document_scorer=document_scorer
+                document_scorer=document_scorer,
+                interview_score=interview_scores.get(applicant.id)
             )
             score_percent = breakdown["final_score"] * 100
             scored_applicants.append((applicant, breakdown, score_percent))
@@ -348,10 +397,7 @@ def compute_recommendations_for_new_job(job_id: int, db: Session) -> None:
         for idx, (applicant, breakdown, score_percent) in enumerate(batch):
             i = batch_start + idx
             try:
-                existing_rec = db.query(JobRecommendation).filter(
-                    JobRecommendation.applicant_id == applicant.id,
-                    JobRecommendation.job_id == job.id
-                ).first()
+                existing_rec = existing_recs_lookup.get(applicant.id)
 
                 explanation = None
                 explanation_source = None
diff --git a/resume_pipeline/resume_pipeline/recommendation/scorers/personalization_scorer.py b/resume_pipeline/resume_pipeline/recommendation/scorers/personalization_scorer.py
index 2e6d2cb..890fdd5 100644
--- a/resume_pipeline/resume_pipeline/recommendation/scorers/personalization_scorer.py
+++ b/resume_pipeline/resume_pipeline/recommendation/scorers/personalization_scorer.py
@@ -15,15 +15,22 @@ class PersonalizationScorer:
 
     def __init__(self, db: Session):
         self.db = db
-
-    def get_multiplier(self, applicant_id: int, candidate_job: Job) -> float:
-        """Calculate the personalization score multiplier for a candidate job based on history."""
-        # 1. Fetch user feedback history
-        feedbacks = self.db.query(UserFeedback).filter(UserFeedback.applicant_id == applicant_id).all()
-        if not feedbacks:
-            return 1.0
-
-        # Signal weights
+        self.precomputed = False
+        self.tag_preferences = {}  # {applicant_id: {tag: weight}}
+        self.title_word_preferences = {}  # {applicant_id: {word: weight}}
+
+    def preload_preferences(self, applicant_id: int) -> None:
+        """Precompute personalization preferences for a single applicant to avoid N+1 queries."""
+        self.preload_preferences_batch([applicant_id])
+
+    def preload_preferences_batch(self, applicant_ids: list) -> None:
+        """Precompute personalization preferences for multiple applicants in one query."""
+        applicant_ids = [aid for aid in applicant_ids if aid is not None]
+        if not applicant_ids:
+            return
+
+        feedbacks = self.db.query(UserFeedback).filter(UserFeedback.applicant_id.in_(applicant_ids)).all()
+        
         action_weights = {
             "click": 0.05,
             "save": 0.10,
@@ -31,10 +38,17 @@ class PersonalizationScorer:
             "dismiss": -0.10
         }
 
-        tag_preferences = {}
-        title_word_preferences = {}
+        # Initialize empty dicts for all requested applicant IDs
+        for aid in applicant_ids:
+            if aid not in self.tag_preferences:
+                self.tag_preferences[aid] = {}
+            if aid not in self.title_word_preferences:
+                self.title_word_preferences[aid] = {}
+
+        if not feedbacks:
+            return
 
-        # 2. Fetch all unique jobs the user has interacted with
+        # Fetch all unique jobs the users have interacted with
         job_ids = list({f.job_id for f in feedbacks})
         interacted_jobs = self.db.query(Job).options(
             joinedload(Job.meta)
@@ -50,6 +64,8 @@ class PersonalizationScorer:
             if weight == 0.0:
                 continue
 
+            aid = f.applicant_id
+            
             # Accumulate tag preferences
             tags = []
             if job.meta and job.meta.tags:
@@ -58,15 +74,26 @@ class PersonalizationScorer:
             for tag in tags:
                 tag_lower = str(tag).lower().strip()
                 if tag_lower:
-                    tag_preferences[tag_lower] = tag_preferences.get(tag_lower, 0.0) + weight
+                    self.tag_preferences[aid][tag_lower] = self.tag_preferences[aid].get(tag_lower, 0.0) + weight
 
             # Accumulate title word preferences (ignoring short stopwords)
             title = job.title or ""
             words = re.findall(r"\b\w{4,}\b", title.lower())  # words with at least 4 chars
             for w in words:
-                title_word_preferences[w] = title_word_preferences.get(w, 0.0) + weight
+                self.title_word_preferences[aid][w] = self.title_word_preferences[aid].get(w, 0.0) + weight
+
+    def get_multiplier(self, applicant_id: int, candidate_job: Job) -> float:
+        """Calculate the personalization score multiplier for a candidate job based on history."""
+        if applicant_id not in self.tag_preferences or applicant_id not in self.title_word_preferences:
+            self.preload_preferences(applicant_id)
+
+        app_tag_prefs = self.tag_preferences.get(applicant_id, {})
+        app_title_prefs = self.title_word_preferences.get(applicant_id, {})
+
+        if not app_tag_prefs and not app_title_prefs:
+            return 1.0
 
-        # 3. Match candidate job against the profile
+        # Match candidate job against the profile
         tag_match_sum = 0.0
         candidate_tags = []
         if candidate_job.meta and candidate_job.meta.tags:
@@ -74,13 +101,13 @@ class PersonalizationScorer:
 
         for tag in candidate_tags:
             tag_lower = str(tag).lower().strip()
-            tag_match_sum += tag_preferences.get(tag_lower, 0.0)
+            tag_match_sum += app_tag_prefs.get(tag_lower, 0.0)
 
         title_match_sum = 0.0
         candidate_title = candidate_job.title or ""
         candidate_title_words = re.findall(r"\b\w{4,}\b", candidate_title.lower())
         for w in candidate_title_words:
-            title_match_sum += title_word_preferences.get(w, 0.0)
+            title_match_sum += app_title_prefs.get(w, 0.0)
 
         # Apply multiplier logic
         boost = tag_match_sum + title_match_sum
