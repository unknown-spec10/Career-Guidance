# Deploy Readiness — Progress Checkpoint

Started: 2026-10-25. Task: deploy-readiness pass, then logical commits + push to `origin main`.
Values are never recorded here — key names only.

## Status board

| # | Task | Status |
|---|---|---|
| 0 | Orientation / inventory of 353 dirty entries | done |
| 1 | Deletion audit (99 paths) | done (verdicts below) |
| 2 | Env completion (`.env.example`, `.env`, compose passthrough) | done |
| 3 | GCP Secret Manager entrypoint + BRINGUP §6 + user-data.sh | done |
| 4 | Build + migration checks | done (compose config, image build, alembic head/parity, vite build) |
| 5 | Backend pytest / frontend vitest+eslint | done (294 passed/1 skipped; 167 passed; lint + build clean) |
| 6 | Logical commits + push | in progress |

## 1. Deletion verdicts (99 paths, all intentional — no restore needed)

| Group | Paths | Verdict / evidence |
|---|---|---|
| Design mockups | `frontend/mock_designs/**` (51) | Intentional. Static html/png references; repo-wide grep finds zero importers/links. No build/CI/compose reference. |
| Dead deploy paths | `deploy/aws/*` (3), `deploy/docker/docker-compose.prod.yml`, `docker-help.bat/.sh`, `deploy/scripts/redeploy.ps1`, `setup_dual_db.sh` | Intentional. Replaced by single root `docker-compose.yml` + `deploy/gcp/`. `ec2-deploy` CI job parked `if: false`; docs updated to say so. |
| Dockerfiles / ignores | `frontend/Dockerfile`, `frontend/.dockerignore`, `resume_pipeline/.dockerignore` | Intentional. Frontend ships on Vercel (no container build anywhere); the two ignores were merged into the root `.dockerignore`, which is a superset (`.env`, `tests/`, `logs/`, `data/`, `frontend/`, `.agents/`). Verified by successful `docker build`. |
| Frontend scope cut | employer/admin/mentor/analytics/talent/user-management/interview-scheduler/network/feedback pages + `ScrollToTop.jsx`, `StatusBadge.jsx`, `useStreamingText.js` | Intentional student-only cut. Zero remaining imports (grep); admin surfaces replaced by new `AdminDashboardPage/AdminUsersPage/AdminJobsPage` + `components/admin/*`; deleted page tests removed with them. Verified by vitest + eslint + vite build. |
| Backend dead modules | `constants.py` (merged into `config.py`), `db.py` (→ `db/` package), `core/embedding_client.py`, `resume/vector_store_stub.py`, `recommendation/optimizer.py`, `repos/*` (4), `resume/llm_gemini.py`, `resume/llm_groq.py`, `resume/preprocessor.py`, `debug.py` | Intentional. Zero import references repo-wide; replaced by routers split, `db/` package, offline rule parser, staged recommendation pipeline. Verified by full pytest. |
| Test probes | `tests/test_semantic_indexing_strategy.py`, `tests/test_smtp_password_reset.py` | Intentional. Re-created as non-pytest CLI probes (`probe_*.py`), which is why pytest sees no tests there. |
| Planning artifacts | `ORIGINAL_REQUEST.md`, `explorer_audit_1/analysis.md` | Intentional. Superseded planning notes; `.agents/` working copies are gitignored. |

## 2. Env completion

- `.env.example`: every `Settings` field now present (blank + comment), plus
  deploy-only keys (`GCP_PROJECT`, `DOCKER_HUB_USERNAME`, `VITE_*`, legacy aliases
  `GOOGLE_SEARCH_API_KEY` / `GOOGLE_CSE_ID`). Added:
  `PASSWORD_RESET_CODE_TTL_MINUTES`, `VECTOR_RETRIEVAL_TOP_K`,
  `VECTOR_RETRIEVAL_MIN_CANDIDATES`, `GCP_PROJECT`.
- Root `.env`: non-LLM local-dev values present; added the three new settings with
  code defaults. `YOUTUBE_DATA_API_KEY` cleared; `GROQ_API_KEY`,
  `OPENCODE_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_SEARCH_API_KEY`/`GOOGLE_CSE_ID`
  remain empty (user pastes later). `VITE_API_URL`/`VITE_API_BASE_URL` set to the
  local backend.
- `docker-compose.yml`: added `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
  `PASSWORD_RESET_CODE_TTL_MINUTES`, `VECTOR_RETRIEVAL_*`, `GCP_PROJECT`,
  `API_HOST`/`API_PORT`; blank-safe `${VAR:-}` everywhere. Only
  `SKILL_TAXONOMY_PATH` / `SKILL_TAXONOMY_METADATA_PATH` stay un-passed on purpose
  (host-absolute paths from `.env` would break the image-relative defaults).

## 3. Secret Manager wiring (names only)

- `resume_pipeline/docker-entrypoint.py`: `GCP_PROJECT` unset → `exec` straight
  through (local compose untouched); set → read
  `projects/$GCP_PROJECT/secrets/<NAME>/versions/latest` via ADC (VM SA),
  export, `exec`. Required: `PG_PASSWORD`, `SECRET_KEY`, `ADMIN_EMAIL`,
  `ADMIN_PASSWORD` (abort naming the exact secret path when missing/empty or
  permission denied). Optional: `OPENCODE_API_KEY`, `GROQ_API_KEY`,
  `GOOGLE_API_KEY`, `GOOGLE_SEARCH_API_KEY`, `GOOGLE_CLIENT_SECRET`,
  `YOUTUBE_DATA_API_KEY`, `GMAIL_APP_PASSWORD`.
- Dockerfile entrypoint added; `google-cloud-secret-manager` added to requirements.
- `deploy/gcp/user-data.sh`: no `.env`, no `--env-file`; non-secret config exported;
  per-secret `secretAccessor` binding attempted (idempotent, warning with exact
  command if IAM denied); `GCP_PROJECT` placeholder aborts boot.
- `deploy/gcp/BRINGUP.md` §6 rewritten Secret-Manager-only (create commands,
  least-privilege binding, no-`.env` startup + failure text), §7 documents the
  Vercel env list (`VITE_API_URL`, optional `VITE_API_BASE_URL`).

## 4-5. Verification results (2026-10-25)

| Check | Result |
|---|---|
| `docker compose --env-file .env config -q` | pass (local-dev flow) |
| `docker compose config -q` (no `.env`, VM-style blanks) | pass |
| Backend image build (`docker build -f resume_pipeline/Dockerfile .`) | pass; `google-cloud-secret-manager` present in image |
| Entrypoint in image, `GCP_PROJECT` unset | exec passthrough verified |
| Entrypoint `GCP_PROJECT` set, lib missing (host) | fails loudly with install message; exit 1 |
| Alembic heads | single head `0007_security_attempts` |
| Alembic <-> model parity (offline) | OK: 0002 enum widening, 0003 enum widening, 0004/0005/0006 columns, 0007 table + both indexes all present in metadata (32 tables) |
| Backend pytest (`CI_SKIP_DB_VALIDATION=true`, test_api ignored) | **294 passed, 1 skipped** (was 1 failed: learning-path JSON guard fixed) |
| Frontend vitest | **29 files / 167 tests passed** (first run hit worker timeouts under Docker-build CPU contention; clean rerun) |
| Frontend eslint (`--max-warnings 0`) | pass |
| Frontend vite build | pass (`dist/`, 2116 modules) |

## Notes / risks

- Docker daemon had to be started for the image build.
- CI: removed the stale `python -m spacy download en_core_web_sm` step (spacy is
  no longer a dependency); `ec2-deploy` stays parked.
