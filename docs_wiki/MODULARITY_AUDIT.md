# Modularity and Dead-Code Audit — Career Guidance AI System

Read-only audit. No source, test, config, or env files were changed.
Line counts verified locally (`python -c`, UTF-8, per-line count). Paths relative to repo root.

## 1. Oversized backend modules (> 400 lines) — 21 files

| Lines | File | Verdict | Reasoning |
|---:|---|---|---|
| 1362 | `resume_pipeline/scripts/seed_database.py` | keep | Dev-only seed script, never shipped; splitting it adds indirection with zero reuse benefit. |
| 1027 | `resume_pipeline/resume_pipeline/routers/auth.py` | **split** | Auth + OAuth + profile + password-reset + avatar handling in one router; separate into `auth_session.py`, `auth_password.py`, `auth_oauth.py` for separation of concerns. |
| 919 | `resume_pipeline/resume_pipeline/db.py` | **split** | 31 tables in one model file; group into `models_identity.py`, `models_jobs.py`, `models_interview.py`, `models_credits.py` so domains evolve independently. |
| 826 | `resume_pipeline/resume_pipeline/rag/rag_service.py` | **split** | Gemini client, RAG orchestration, and singleton wiring in one file; extract the client so the service is testable without network. |
| 730 | `resume_pipeline/resume_pipeline/resume/extractors.py` | keep | Cohesive set of pure section-extractors with no shared state; splitting fragments a single responsibility. |
| 708 | `resume_pipeline/resume_pipeline/learning/generator.py` | **split** | YouTube search, video ranking, and path-building are three reusable stages forced into one module. |
| 685 | `resume_pipeline/tests/test_interview.py` | **split** | 14 tests spanning lifecycle, abandon, and intelligence; group into `test_interview_lifecycle.py` / `test_interview_edge.py` for targeted runs. |
| 641 | `resume_pipeline/resume_pipeline/interview/sessions.py` | **split** | Nine route groups (start/answer/state/results/abandon/history/finish/intelligence); extract abandon + history into their own routers. |
| 558 | `resume_pipeline/resume_pipeline/core/credit_service.py` | watch | Single-service cohesion is correct today; split only if premium-limit rules keep growing. |
| 519 | `resume_pipeline/resume_pipeline/routers/resume.py` | watch | Upload → parse → details flow is cohesive; approaching split threshold, revisit past ~650 lines. |
| 507 | `resume_pipeline/resume_pipeline/core/llm_router.py` | keep | Adapters plus one router singleton is the intended seam; one file keeps the swap surface obvious. |
| 494 | `resume_pipeline/resume_pipeline/schemas.py` | watch | ~35 Pydantic models still navigable; split by domain once it crosses ~600 lines. |
| 478 | `resume_pipeline/resume_pipeline/rag/query_engine.py` | keep | Single `QueryEngine` responsibility; size comes from rate-limit bookkeeping, not mixed concerns. |
| 475 | `resume_pipeline/resume_pipeline/interview/generator.py` | keep | Question-generation pipeline reads top-to-bottom as one algorithm; no reuse case for fragments. |
| 467 | `resume_pipeline/tests/test_parsing.py` | keep | Pure unit tests for one pipeline; cohesive by definition. |
| 462 | `resume_pipeline/resume_pipeline/rag/file_watcher.py` | keep | Tracker + handler + watcher form one file-watching abstraction; correct reuse boundary. |
| 433 | `resume_pipeline/resume_pipeline/recommendation/ranking.py` | keep | Staged-pipeline steps share one `RankingContext`; splitting would scatter the data flow. |
| 424 | `resume_pipeline/resume_pipeline/routers/profile.py` | watch | Six student-scoped routes, cohesive today; split if employer/college logic ever returns. |
| 415 | `resume_pipeline/resume_pipeline/interview/service.py` | watch | Session helpers orbit one session lifecycle; extract only when a second consumer appears. |
| 414 | `resume_pipeline/resume_pipeline/recommendation/explainer.py` | keep | Explanation generation (prompt + fallback + offline path) is one replaceable strategy. |
| 408 | `resume_pipeline/resume_pipeline/core/storage.py` | keep | Three backends behind one interface is textbook reuse; the file *is* the abstraction. |

Backend verdicts: **split 6, keep 10, watch 5.**

## 2. Oversized frontend files (> 300 lines) — 18 files

| Lines | File | Verdict | Reasoning |
|---:|---|---|---|
| 1431 | `frontend/src/pages/JobsPage.jsx` | **split** | List + filtering/sorting + detail modal + apply flow; extract `JobsList`, `JobDetailModal`, `useJobsData`. |
| 1222 | `frontend/src/pages/StudentProfile.jsx` | **split** | Profile + password + avatar + resume + credits + deactivate; extract `ProfileForm`, `SecuritySection`, `ResumeSection`. |
| 719 | `frontend/src/components/SkillGapModal.jsx` | **split** | Modal chrome and path-generation logic are independently reusable; extract the hook. |
| 666 | `frontend/src/pages/InterviewSessionPage.jsx` | **split** | Recording/mute/replay/submit/exit handlers plus inline `AlertTriangle`; extract `useInterviewControls`. |
| 636 | `frontend/src/components/DashboardLayout.jsx` | watch | Sidebar + credit fetch + logout is one layout concern; split only when a second layout variant appears. |
| 552 | `frontend/src/pages/MyApplicationsPage.jsx` | **split** | Kanban grouping plus `CompanyLogo`/`SkeletonCard`/`ApplicationCard` subcomponents belong in their own files. |
| 504 | `frontend/src/components/Hero.jsx` | watch | Large but single-purpose landing section; no second consumer justifies a split yet. |
| 483 | `frontend/src/pages/StudentDashboard.jsx` | watch | One `fetchAll` + upload flow; extract only when dashboard widgets diverge. |
| 471 | `frontend/src/pages/InterviewResultsPage.jsx` | **split** | `ScoreRing`, `SkillBar`, `QuestionAccordion` are reusable visuals trapped in a page. |
| 455 | `frontend/src/pages/JobDetailsPage.jsx` | keep | Single detail-plus-apply flow; cohesive page. |
| 402 | `frontend/src/pages/CandidateIntelligencePage.jsx` | keep | One read-only intelligence view; nothing to separate. |
| 401 | `frontend/src/pages/UpgradePage.jsx` | keep | Single credit-purchase surface; cohesive. |
| 399 | `frontend/src/pages/InterviewPage.jsx` | keep | Setup/start form only; correct page size. |
| 397 | `frontend/src/pages/LoginPage.jsx` | keep | Single auth form; no split benefit. |
| 394 | `frontend/src/pages/RegisterPage.jsx` | keep | Single registration form; no split benefit. |
| 348 | `frontend/src/pages/LearningPathPage.jsx` | keep | Fetch + complete + lightbox for one resource; cohesive. |
| 322 | `frontend/src/hooks/useInterviewSession.js` | keep | One hook, one responsibility; size reflects session-state reality. |
| 309 | `frontend/src/hooks/useInterviewSession.test.js` | keep | Test for the hook above; co-located and appropriately scoped. |

Frontend verdicts: **split 6, keep 9, watch 3.**

## 3. Dead / legacy code (every item grep-verified)

| # | Finding | Evidence | Benefit × effort |
|---|---|---|---|
| D1 | Orphan `VectorStoreStub` — `resume_pipeline/resume_pipeline/resume/vector_store_stub.py:4` | Repo-wide grep `VectorStoreStub` returns only the definition; zero importers. | **High benefit / trivial effort** — delete the file. |
| D2 | Orphan debug script — `resume_pipeline/debug.py` (ad-hoc `compute_recommendations(1, db)`) | Grep `from .debug\|import debug` → zero importers. | **High / trivial** — delete. |
| D3 | `drop_all_tables()` with no callers — `resume_pipeline/resume_pipeline/db.py:904` | Repo-wide grep returns only the definition (`init_db` alongside it is live). Destructive dev-only helper. | **High / trivial** — delete the function. |
| D4 | Copy-pasted unused imports in every router import block (e.g. `routers/auth.py:3,4,6,11-16`: `BackgroundTasks`, `Form`, `JSONResponse`, `FileResponse`, `joinedload`, `HumanReview`, `Mentor`, `InterviewSchedule`, … match import lines only) | Grep per name within the file returns import lines only; same block duplicated in `resume.py`, `rag.py`, `profile.py`, `misc.py`, `jobs.py`. | **Medium / small** — one lint pass (`ruff --select F401`) across `routers/`. |
| D5 | Stale feature flags `RAG_ENABLE_FILE_WATCHER` (`config.py:216`), `USE_VECTOR_RETRIEVAL` (`config.py:219`) | Repo-wide grep returns only the definitions; zero consumers. | **Medium / small** — remove or wire up; dead flags mislead readers. |
| D6 | Dead ORM models `Mentor`, `MentorRequest`, `InterviewSchedule`, `InterviewFeedback` (`db.py:749,767,786,807`) | Hits only in `db.py` definitions/relationships and copy-pasted router import blocks; zero queries or routes. Mentor/employer flows were removed. | **Medium / medium** — needs an Alembic revision dropping the tables; keep as reserved schema if the flows may return. |
| D7 | Zero-collection probe files `tests/test_semantic_indexing_strategy.py`, `tests/test_smtp_password_reset.py` | AST-verified: zero `test_*` functions; interactive CLI probes (AGENTS.md concurs). | **Low / trivial** — rename to `probe_*` so pytest intent is explicit. |

### Intentionally kept adapters — confirmed referenced, NOT dead

- `resume/parse_service.py:31` (`ResumeParserService` facade): imported by 8 routers, `embedding_tasks.py:24`, 3 test files.
- `recommendation/embedder.py:20,30` (`GeminiEmbeddingUnavailable` / `EmbeddingUnavailable` alias): raised at `:52,58,100,109,112`, caught in `ranking.py:97`, imported by tests and golden scripts.
- `interview/learning_path_generator.py` (32-line shim): imported and patch-targeted by `tests/test_learning_path.py:17,153-155`.
- `core/llm_router.py:507` singleton + `interview/router.py:54-58` aggregator re-exports: consumed by ~10 modules and `app.py`; the live import surface.

## 4. Refactor ranking (benefit vs effort)

1. Delete D1–D3 (orphan stub, debug script, `drop_all_tables`) — minutes, zero risk. Do first.
2. Lint-pass D4 (unused router imports) + remove D5 stale flags — one small PR, big readability win.
3. Split `routers/auth.py` (1027) and `JobsPage.jsx` (1431) / `StudentProfile.jsx` (1222) — highest structural payoff; moderate effort.
4. Split `db.py` models and `interview/sessions.py` routes — larger, plan as one migration + one router PR.
5. Decide D6 (drop mentor tables via Alembic vs keep reserved) and D7 (rename probes) — owner call, low urgency.
