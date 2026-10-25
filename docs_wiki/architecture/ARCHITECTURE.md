# Architecture

## Overview

The platform is a monorepo with two active product roles:

- Student
- Recruiter (`employer` in backend code and database)

The system is PostgreSQL-only. The legacy college domain has been removed from runtime code and should be removed from existing databases with the migration utility in [resume_pipeline/scripts/drop_college_domain.py](../../resume_pipeline/scripts/drop_college_domain.py).

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
|   |   |-- interview/  (sessions.py lifecycle routes + streaming.py SSE/voice routes + common.py helpers; router.py thin aggregator; generator.py / evaluator.py / service.py unchanged)
|   |   |-- learning/  (top-level learning paths: generator.py + router.py; owns /api/learning-paths/* and the /api/interview/generate-learning-path trigger)
|   |   |-- resume/  (rule-based offline parser: ingest, preprocess_ocr, segmenter, extractors, rule_parser)
|   |   `-- routers/  (all route handlers + deps.py; app.py is a thin composition root)
|   |-- scripts/
|   `-- tests/
`-- docs/
```

## Active Product Flow

1. A student uploads a resume through the backend.
2. The parser extracts normalized profile data and stores it in PostgreSQL.
3. The recommendation service generates job recommendations.
4. Students track applications and use interview features gated by credits.

## Backend Architecture

### API Layer

The FastAPI entrypoint is [resume_pipeline/resume_pipeline/app.py](../../resume_pipeline/resume_pipeline/app.py).

Key responsibilities:

- request validation
- authentication and role guards
- upload and parse endpoints
- student recommendation and application flows
- interview and credit endpoints

### Persistence Layer

The SQLAlchemy models live in [resume_pipeline/resume_pipeline/db/](../../resume_pipeline/resume_pipeline/db/).

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

- Resume parsing in [resume_pipeline/resume_pipeline/resume](../../resume_pipeline/resume_pipeline/resume)
- Interview workflows in [resume_pipeline/resume_pipeline/interview](../../resume_pipeline/resume_pipeline/interview)
  (lifecycle routes in `sessions.py`, streaming/voice routes in `streaming.py`,
  shared helpers in `common.py`, thin aggregator in `router.py`; chat-provider
  generation/scoring via `llm_router` with the hardcoded fallback bank)
- Learning paths in [resume_pipeline/resume_pipeline/learning](../../resume_pipeline/resume_pipeline/learning)
  (`generator.py` + `router.py`; serves `/api/learning-paths/*` and the
  `/api/interview/generate-learning-path/{session_id}` trigger at unchanged paths)
- Job recommendation logic in [resume_pipeline/resume_pipeline/recommendation](../../resume_pipeline/resume_pipeline/recommendation)
- Credit accounting in [resume_pipeline/resume_pipeline/core](../../resume_pipeline/resume_pipeline/core)

### Model Selection (capability-based, provider-agnostic)

`resume_pipeline/resume_pipeline/core/llm_router.py` is a small provider-adapter
registry. One adapter per live provider (`GroqAdapter` for chat + STT,
`OpenCodeAdapter` for primary chat) exposes
`chat()` / `stream()` (+ `transcribe()` on the Groq adapter for STT). Callers
ask for a capability — `"chat"` (interview, learning paths, RAG, skill-gap
streams, taxonomy discovery) or `"explanation"` (recommendation explanations) —
and the router uses the single configured primary provider for that
capability: exactly one adapter attempt, then raise on failure (caller
fallback banks engage). STT goes through
`llm_router.transcribe_audio()` using `MODEL_STT_PROVIDER` / `MODEL_STT_NAME`.

- `MODEL_CHAT_PRIMARY_PROVIDER` / `MODEL_CHAT_PRIMARY_NAME` (default `opencode` / `deepseek-v4.1-flash`)
- `MODEL_EXPLAIN_PRIMARY_PROVIDER` / `MODEL_EXPLAIN_PRIMARY_NAME` (default `opencode` / `deepseek-v4.1-flash`; failure → offline explanation)
- `MODEL_STT_PROVIDER` / `MODEL_STT_NAME` (default `groq` / `whisper-large-v3`)
- An empty `*_NAME` means "use the provider default" (`OPENCODE_CHAT_MODEL`,
  `GROQ_CHAT_MODEL`, `GROQ_STT_MODEL`), so existing
  deployments behave identically until the slots are set.

Env-only swap procedure (no code changes): set the slots, restart, and the
router follows — pinned by `tests/test_model_agnostic_swap.py`. Explicitly
named providers on `generate_chat_completion[_stream]` try once and raise.
Removed (Oct 2026 cutover): all `GEMINI_*` keys except
`GEMINI_MOCK_MODE` (legacy name of the global mock toggle), plus `GROQ_TTS_*`,
`NVIDIA_NIM_*`, `OPENROUTER_*`, `GOOGLE_EMBEDDING_ENABLED`,
`EMBEDDING_TIMEOUT_SECONDS`.

The active repository model is job-centric:

- applicant access
- employer access
- job access
- job recommendation persistence

## Frontend Architecture

The frontend is a React + Vite application under [frontend/src](../../frontend/src).

Active UI areas:

- student dashboard
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
- LLM integration: rule-based offline resume parsing (no LLM); capability-based chat via `core/llm_router` (provider adapters in `MODEL_CHAT_*` config order, opencode/DeepSeek primary) for interview generation/evaluation, RAG answers, and learning paths; explanation order via `MODEL_EXPLAIN_*` (default opencode → offline)

## Maintenance Utilities

Useful scripts in [resume_pipeline/scripts](../../resume_pipeline/scripts):

- `seed_database.py`
- `update_content.py`
- `verify_data.py`
- `drop_college_domain.py`

## Current Constraints

- Existing PostgreSQL databases created before the domain cleanup may still contain legacy college tables or enum values.
- Run the drop script before assuming schema parity with the current ORM.
- Documentation outside this file may still require smaller wording cleanups, but this file reflects the current supported architecture.