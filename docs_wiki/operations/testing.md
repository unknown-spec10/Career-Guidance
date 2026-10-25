# Testing & Verification

Authoritative guide to running and understanding the test suites for the Career Guidance AI System — locally and in CI.

---

## Backend Test Suite (pytest)

Tests live in `resume_pipeline/tests/`. Most suites are deterministic unit/regression tests; none depend on live external LLM APIs.

### Environment Variables for Test Runs

| Variable | Purpose |
|---|---|
| `GEMINI_MOCK_MODE=true` | Stub all LLM calls. Required for deterministic runs. |
| `CI_SKIP_DB_VALIDATION=true` | Activates the in-memory SQLite stub in `resume_pipeline/db.py`: a single shared database with the full schema created from the ORM models. Lets DB-backed suites run without PostgreSQL. |
| `SECRET_KEY=...` | Any value ≥ 32 chars; required by config validation. |

### Canonical Commands (from `resume_pipeline/`, venv active)

```powershell
# Full suite minus the live-API smoke test (matches CI)
$env:GEMINI_MOCK_MODE="true"; $env:CI_SKIP_DB_VALIDATION="true"; $env:SECRET_KEY="test_secret_key_at_least_32_characters_long_for_signing_jwt"
pytest tests/ -q --ignore=tests/test_api.py

# Single suite / single test
pytest tests/test_security_perimeter.py -v
pytest tests/test_parsing.py::test_skill_mapping -v -s
```

### Model Selection & Env-Only Swap Procedure

Chat calls are capability-based: `core/llm_router.py` resolves the
`MODEL_CHAT_*` / `MODEL_EXPLAIN_*` / `MODEL_STT_*` slots (see
`operations.md`) to a single provider adapter (one attempt → raise).
To swap models without code changes:

```powershell
# Example: make groq the chat provider (env only)
$env:MODEL_CHAT_PRIMARY_PROVIDER="groq"
$env:GEMINI_MOCK_MODE="true"; $env:CI_SKIP_DB_VALIDATION="true"; $env:SECRET_KEY="test_secret_key_at_least_32_characters_long_for_signing_jwt"
pytest tests/test_model_agnostic_swap.py -q   # proves the router follows selection
pytest tests/ -q --ignore=tests/test_api.py    # full suite must stay green
```

An empty `MODEL_*_NAME` keeps the provider default, so unset slots
behave exactly as before. `tests/test_model_agnostic_swap.py` pins this:
swapping the primary provider and overriding `MODEL_CHAT_PRIMARY_NAME` /
`MODEL_STT_NAME` changes the adapter called and the model sent, with no code
changes. Chat + explanation default to `opencode` (DeepSeek) with no
fallback (failure raises); STT stays Groq Whisper.

### Database-Backed Suites

Suites such as `test_interview.py` and `test_learning_path.py` exercise real service logic through `SessionLocal`. Under `CI_SKIP_DB_VALIDATION=true` they run against the shared in-memory SQLite database described above — no developer database or credentials involved.

### Migration Verification

Two layers:

1. **Chain correctness (fast):** `tests/test_migrations.py` applies Alembic `0001 → head` to throwaway databases inside pytest.
2. **Real-engine check (CI):** the CI pipeline runs `alembic upgrade head` twice against a disposable PostgreSQL 16 service container, verifying PG-specific DDL (e.g. enum widening) and idempotency. Locally, the same command is safe to re-run against any configured database because all revisions are additive/non-destructive:

```powershell
python -m alembic upgrade head
```

### Intentionally Excluded & Manual Scripts

* **`tests/test_api.py`** — a single live-Gemini connectivity smoke test. Skipped automatically when `GEMINI_API_KEY` is unset; excluded from CI because it is non-deterministic and costs API quota.
* **`tests/test_semantic_indexing_strategy.py`** — interactive CLI probe (prompts via `input()`). Collects zero pytest tests; run manually with arguments.
* **`tests/test_smtp_password_reset.py`** — SMTP probe script (argparse-driven), not a pytest suite. Run manually only.

---

## Frontend Test Suite (Vitest + React Testing Library)

The frontend uses **Vitest 4** with **jsdom** and **React Testing Library**, configured in `frontend/vitest.config.mjs` (test-only; the app build keeps using `vite.config.mjs`). A `@` alias points at `src/` for tests only. Global setup lives in `frontend/src/test/setup.js` (jest-dom matchers, cleanup, browser-API stubs, and a passthrough mock of framer-motion — animation is never what is under test).

### Commands (from `frontend/`)

```powershell
npm test          # single run (CI uses this)
npm run test:watch
npm run lint      # zero warnings tolerance
npm run build     # production build must succeed
```

### Testing Conventions

* Mock the HTTP boundary (`vi.mock('../config/api')`), not component internals — tests verify *user action → correct endpoint/method/body → correct UI state*.
* Use accessible selectors (role, label, visible text) before test IDs; avoid CSS/animation-timing assertions.
* Every critical workflow includes failure-path coverage (401/403/404/500/network).
* Streaming endpoints (SSE/fetch streams) are tested with small in-file reader doubles; external services (Groq/Gemini/YouTube) are never contacted.

### Covered Workflows

Authentication (login success/failure, role routing, protected routes, session expiry), resume/dashboard surfaces via CreditWidget and ApplicationTracker, interview lifecycle (`useInterviewSession`: start, answer, finish, explicit quit, HMAC abandon beacon, hint streaming, crash recovery), evaluation polling/retry (`useResultsPolling`), learning-path generation contract (`SkillGapModal`: SSE gap analysis → POST generate-learning-path → roadmap fetch), semantic talent search incl. unscored-badge honesty, admin user management (real `/api/admin/stats` consumption), and job listing/application on JobsPage.

---

## CI Pipeline (`.github/workflows/ci-cd.yml`)

* **Frontend CI**: `npm ci` → `npm test` → `npm run lint` → `npm run build`.
* **Backend CI**: installs deps (ONNX Runtime embedding backend — no deep-learning framework) → runs `pytest tests/ -q --ignore=tests/test_api.py` under mock mode with the SQLite stub → verifies `alembic upgrade head` (twice, idempotency included) against a disposable PostgreSQL service.
* Docker build/push and EC2 deploy stages run only on pushes to `main` after both test jobs pass.

Previously skipped meaningful suites (`test_interview.py`, `test_learning_path.py`, `test_recommendation_fallback.py`, `test_recommendation_system.py`) were investigated, fixed where needed, and re-enabled — see `IMPLEMENTATION_STATUS.md`.
