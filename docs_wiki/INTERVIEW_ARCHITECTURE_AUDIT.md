# Interview Architecture Audit (read-only, verified against code)

**Date:** 2026-10-24 · **Scope:** frontend interview pages + backend interview architecture · **Method:** code + docs read, no source/config/env changes.
**Baseline docs:** `architecture/INTERVIEW_SYSTEM_ARCHITECTURE.md`, `architecture/LIVE_INTERVIEW_ARCHITECTURE.md`, `architecture/LEARNING_PATH_ARCHITECTURE.md`, `IMPLEMENTATION_STATUS.md`, `PAGE_API_AUDIT.md`.

## 1. Actual architecture as built

### 1.1 Module map (all under `resume_pipeline/resume_pipeline/`)

| Module | Role (verified) |
|---|---|
| `interview/sessions.py` (`APIRouter(prefix="/api/interview")`, :56) | Lifecycle/state machine only: start, answer, state, results, finish, abandon ×2, active-session, history, candidate-intelligence (self only). Owns credit checks, limiter calls, abandon-suspension, weak-skill aggregation. |
| `interview/streaming.py` (same prefix, :38) | All streaming + voice + read-only Q listing: `hint/{answer_id}`, `feedback/{question_id}`, `skill-gap-analysis/{session_id}` (SSE), `transcribe` (Whisper), `session/{id}/questions`. Owns skill-gap prompt + `study_plan` cache write. |
| `interview/common.py` | No routes: HMAC mint/verify, `get_db`, applicant guard, `MAX_EVAL_RETRIES=3`, cached-plan streamer, sync→async bridge (`run_generator_in_thread`). |
| `interview/service.py` | Pure logic, no routes/auth: `sse_response`, `create_session`, `get_next_question` (adaptive reserve), conversation history, weak-skills/missing-concepts, `build_full_results` (also marks session completed), `mark_session_abandoned`, `get_active_session`. |
| `interview/generator.py` | Question-set construction: resume context, subtopic-taxonomy + blended priority selector, depth/context coordinate picker, one LLM call, validation/padding, fallback-bank delegation. |
| `interview/evaluator.py` | Background grading (`run_evaluation`, `_evaluate_with_groq`) + SSE token generators (`stream_hint`, `stream_feedback`); owns auto-complete + longitudinal-profile trigger. Duplicates `run_generator_in_thread`. |
| `interview/router.py` | Thin aggregator: `include_router(sessions)` + `include_router(streaming)`; re-exports learning routers for compat. |
| `interview/learning_path_generator.py` | Backward-compat shim re-exporting `learning/generator.py` (+ `llm_router` patch target). |
| `learning/generator.py` + `learning/router.py` | Promoted top-level domain: YouTube + LeetCode + LLM structuring + credit/daily-limit/idempotency. Keeps `POST /api/interview/generate-learning-path/{id}` via `interview_learning_router` for frontend compat. |
| `core/llm_router.py` | Singleton; all LLM traffic. `capability="chat"` resolves to the single configured `MODEL_CHAT_PRIMARY_PROVIDER=opencode` (one attempt, raise on failure) (`config.py`); per-provider circuit breakers; 4xx does not trip breaker. |
| `interview/limiter.py`, `constants.py:153-159` | DB-backed caps (not in-memory): 1 start/300 s + 3 starts/24 h; 1 answer/10 s + 30 answers/24 h → 429. |
| `interview/prompts.py`, `fallback_questions.py`, `schemas.py`, `candidate_intelligence.py`, `subtopic_taxonomy_builder.py` | Prompts + 4 personas; hardcoded bank (Software/Frontend/Backend/DataScience/General × easy/med/hard, reserves one rung harder); Pydantic I/O; cumulative profile synthesis; taxonomy (JSON file + `SystemConfiguration` merge + Google-search discovery). |

Route registration: `app.py:90-93` includes sessions+streaming combined router, `interview_learning_router`, and `learning_path_router`. 21 route paths/methods pinned by golden test `tests/test_interview_refactor_proof.py`.

### 1.2 Request flows

**Start — `POST /api/interview/start` (`sessions.py:62-225`).**
`_get_applicant` (403 inactive / 404 no applicant) → start-limiter → abandon-suspension (≥3 abandoned/24 h → 403, `sessions.py:84-99`) → `CreditService.check_eligibility("full_interview", custom_cost=num_questions)` → 402 (`sessions.py:102-110`; note: cost = question count, not `CREDIT_CONFIG FULL_MOCK_INTERVIEW_COST=10`) → require `LLMParsedRecord` else 400 → aggregate past completed sessions (weak skills avg <0.60 top 5; missing concepts top 10; last 20 Q texts anti-dup) → `generate_questions()` (single LLM call + reserve pool) → `service.create_session()` persists session + Qs → `spend_credits(cost=num_questions)` in try/except (failure logged only, session still returned) → `{session_id, first_question, abandon_token}`.

**Answer — `POST /api/interview/answer` (`sessions.py:232-351` + `evaluator.py:28-114`).**
Limiter → ownership + `status==active` → upsert `InterviewAnswer(status=pending_evaluation)` (unique `(session_id, question_id)`; re-answer resets score/feedback and returns `next_question=None`) → `BackgroundTasks` eval on a **fresh `SessionLocal()`** → immediately return next non-reserve Q from DB (`get_next_question`, adaptive reserve swap every `ADAPTIVE_CHECK_EVERY=3` if running avg ≥80, `service.py:121-187`) or `{status: interview_complete}`. No LLM on the hot path.

**Evaluation — BackgroundTasks primary + retry-on-poll.**
`run_evaluation`: fetch Q+A, `build_conversation_history` (all Qs + truncated answers), `_evaluate_with_groq` (temp 0.3, 1024 tokens, `json_object`), clamp 0–1, `hint_for_next` only if score <0.40, commit; when zero pending remain → overall avg, session `completed`, `generate_longitudinal_profile` (`evaluator.py:85-104`). Failure → `evaluation_failed`, never a fallback score.
`GET /api/interview/results/{id}` (`sessions.py:402-467`): re-queues pending/failed rows with `evaluation_attempts < 3` via BackgroundTasks, returns `{status:"processing", completed, total}` while any retryable remains; else `build_full_results()` (partial rows surface `status=evaluation_failed`; unconditionally marks session completed, `service.py:331-335`). `POLLING_MAX_WAIT_SECONDS=30` is a client-hint constant only.

**Hint / feedback / skill-gap streaming — SSE only (verified, §1.4).**
`stream_hint` (temp 0.6/150 tok) and `stream_feedback` (temp 0.5/400 tok) via `llm_router.generate_chat_completion_stream(capability="chat")`, bridged sync→async, `data: {"token":…}` + `data: [DONE]`; hint/feedback failures yield `[DONE]` with no fallback text. Skill-gap (`streaming.py:258`) serves cached `session.study_plan` if it starts with `{`, else streams `SKILL_GAP_ANALYSIS_PROMPT` JSON and caches the full text to `study_plan` post-stream (`streaming.py:243-255`).

**Abandon — dual path + HMAC.**
Mint `HMAC-SHA256(SECRET_KEY, "abandon:{sid}:{aid}")` (`common.py:32-47`, fail-closed 500 without key); issued in start + state responses. Explicit `POST abandon/{sid}` = Bearer quit (ignores its `abandon_token` param). Beacon `POST abandon-beacon/{sid}` = no auth, requires `?abandon_token=` HMAC + active user (`sessions.py:499-525`). Both → `mark_session_abandoned` (only `active→abandoned`). No timestamp/expiry in token (replay only re-abandons same session).

**Learning-path generation — `POST /api/interview/generate-learning-path/{id}` (`learning/generator.py:482-708`).**
Requires `status==completed` (else 400) → credit eligibility → session-scoped idempotency (`skill_gaps.session_id` match → `already_exists=True`) → daily cap (default 2/24 h via `SystemConfiguration`) → weak skills (default `["Software Engineering Core"]`) + missing concepts + role/level → if `YOUTUBE_DATA_API_KEY`: query-gen (LLM, template fallback) → `search_youtube` (`order=viewCount`, medium) → batched `fetch_video_stats` → `filter_and_rank_videos` (drop <50k views or <10 min/>60 min; `log10(views)+0.5 recency+1.5 trusted-channel`) → `build_learning_path_json` (LLM, template fallback) → overwrite `practice_problems` with live LeetCode API (difficulty-gated, padded to ≥3, capped 5) → persist `LearningPath(generated_from=interview, ...)` → `spend_credits` (config override else 10; failure logged only).

**Transcription — `POST /api/interview/transcribe` (`streaming.py:110-151`).**
Mock transcript if `GEMINI_MOCK_MODE` or no `GROQ_API_KEY`; else `llm_router.transcribe_audio` → Groq `audio.transcriptions.create(model=MODEL_STT_NAME or GROQ_STT_MODEL)`. Extension allow-listed, defaults `webm`.

### 1.3 Groq vs fallback vs mock

- Question generation: 1 LLM call (temp 0.4, 4096, `json_object`); any exception → `get_fallback_questions(...)`; short returns padded (`generator.py:464-471`).
- Evaluation: LLM only; failure re-raised → `evaluation_failed` (no fallback scoring — without keys, answers stay failed until retry budget exhausts → partial results).
- Mock mode (`GEMINI_MOCK_MODE=true`): Groq raises (no key) → Gemini `_mock_completion`; generation succeeds with mock-shaped data; evaluation mock returns score 10.0 clamped to 1.0; streaming mock word-splits. `generate_longitudinal_profile` explicitly skips when chat unavailable (no fake profile, `candidate_intelligence.py:129-131`).
- Learning-path LLM steps have template fallbacks; YouTube/LeetCode degrade independently. Subtopic discovery needs `GOOGLE_API_KEY` + engine ID else `[]` → default fundamentals list.

### 1.4 Streaming transport (verified, not guessed)

**SSE only. No WebSocket, no long-poll stream.** Evidence: `service.sse_response()` returns `StreamingResponse(…, media_type="text/event-stream", Cache-Control:no-cache, X-Accel-Buffering:no)` (`service.py:20-32`); all three endpoints use it; wire format `data: {"token"}` + terminal `data: [DONE]`. Backend grep for `WebSocket|websocket` hits only an optional schema field and the skill-taxonomy JSON — no WS route. Frontend: zero `EventSource` hits; all "SSE" is `fetch(apiUrl(…))` + `ReadableStream.getReader()` + `TextDecoder` parsing `data:` lines; only polling is `useResultsPolling.js:32` (`setTimeout(poll, 2000)` on `GET results` while `processing`).

### 1.5 State management

- **DB is the store; no durable in-memory state.** `InterviewSession` (UUID PK, `active/completed/abandoned`, `study_plan` doubles as skill-gap JSON cache), `InterviewQuestion` (+ `is_reserve`), `InterviewAnswer` (unique `(session_id,question_id)`, `pending_evaluation/evaluated/evaluation_failed`, `evaluation_attempts`), `Applicant.candidate_profile` JSON, `LearningPath` (`skill_gaps` abused as metadata: `session_id/is_deleted/deleted_at`), `SystemConfiguration` (taxonomy, daily limit, cost override). Per-request `SessionLocal()`; background tasks open their own.
- **Cooldowns present:** active-session visibility 24 h; start daily cap 24 h; answer daily cap 24 h; abandon-suspension 24 h; learning-path daily limit 24 h; soft-deleted path GC 30 d. (Recommendation-refresh 24 h cooldown lives outside interview.)
- **Frontend state:** no Redux/Context; per-component `useState`/`useRef` + `sessionStorage` answer drafts; HMAC token in `abandonTokenRef`; beacon on `beforeunload` only while active.

### 1.6 Frontend pages vs backend contracts

Exist: `InterviewPage.jsx` (setup+history, `/dashboard/interview`), `InterviewSessionPage.jsx` (`/dashboard/interview/:sessionId`), `InterviewResultsPage.jsx` (`/dashboard/interview/results/:sessionId`), plus `LearningPathPage`, `MyLearningPathsPage`, `CandidateIntelligencePage`, `SkillGapModal`, hooks `useInterviewSession` (start/answer/finish/quit/HMAC beacon/hint SSE/recovery), `useResultsPolling`, `useAudioRecorder` (MediaRecorder→transcribe + WebSpeech live transcript), `utils/speech.js` (TTS). All called paths/field names match backend decorators/schemas (verified per-endpoint). **Cut:** `InterviewFeedbackPage` (+ scheduler) — gone in student-scope cut (`PAGE_API_AUDIT.md:33`), zero `src/` hits.
Minor drifts (non-breaking): `ResultsResponse` schema omits runtime `learning_path_id` (route has no `response_model`, passes through); `streamHint` implemented but unwired in session UI (dead banner); `useStreamingText` unused (duplicated loops); `LearningPathPage` expects legacy `topics_outline` item shape vs newer SkillGapModal roadmap shape (empty-state fallback).

## 2. Verdict: is this architecture right?

**Verdict: yes — the REST + DB-as-state + BackgroundTasks + SSE-hints + promoted-learning-module design is correct for a turn-based mock interview at this scale, and the sessions/streaming split with a thin aggregator plus the learning shim is a clean, low-risk seam; the only wrong-shaped pieces are small drifts (untyped results extra key, unwired hint UI, duplicated thread-bridge, spend-after-persist), not structural errors.**
Module splits are correct: lifecycle (sessions) vs token-streaming/voice (streaming) vs pure logic (service) vs construction (generator) vs grading (evaluator) have no circular imports and match the golden route-proof. The aggregator + `learning/` promotion preserves all 21 paths while giving learning paths their own credit/daily-limit/idempotency owner — the right call vs a mega-router. Frontend pages match backend contracts field-for-field; the cut of `InterviewFeedbackPage`/scheduler is consistent with student scope (employer-gated feedback stays server-side). Debatable-but-defensible: pre-generate-all (halves Groq calls at the cost of adaptivity, mitigated by the reserve pool); `study_plan` column reuse as skill-gap cache (pragmatic, but deserves a real column); spend-after-persist with log-only failure (availability over ledger strictness — should be reconciled, §4).

## 3. Scalability assessment (rough quantification)

Assumptions: N-question session (5/10/15), Groq free-tier ~6k tok/min, 131k context; generation prompt ~1–2k in / ~2–4k out; eval prompt ~0.8–1.5k in (history grows) / ~0.2k out; hint 150 tok, feedback 400 tok, skill-gap ~1–2k.

| Flow | LLM calls | Tokens/session (N=10) | DB writes/session | Bottleneck |
|---|---|---|---|---|
| Start | 1 (gen) + 0–1 (profile trigger later) | ~3–6k | 1 session + N+3 Qs (≈14 rows) | Groq burst at cohort start (e.g. class joins → N concurrent `start` × 4k out tokens). |
| Answer ×N | 1 eval/answer (BackgroundTasks) + occasional hint/feedback/skill-gap streams | ~10–17k (evals) + streams | 2/answer (insert + grade update) + 1 session close ≈ 21–31 | **#1 Groq rate limit**: N concurrent answers ≈ N eval calls × ~1–2 s; free-tier TPM + per-min request caps queue visibly; BackgroundTasks has no queue bounds/backpressure. |
| Results poll | 0 (+≤3 retries/failed answer) | 0–small | 1–3 polls × read + session update | Poll amplification: every open results page polls q2s; cheap reads but multiplies under cohorts. |
| Transcribe | 1 Whisper/audio upload | audio-duration-based | 0 | **#2 bandwidth + Groq STT**: audio uploads are the largest payloads; no size cap evident beyond extension check. |
| Learning path | 2 Groq + ~3–4 YouTube + 1 LeetCode | ~2–4k Groq | 1 path + credit txn | **#3 YouTube quota**: ~315 units/path → ~31 paths/day/key; daily cap (2/user) + idempotency protect it, but a cohort burns one key fast. |

**What breaks first (ranked):** (1) Groq free-tier TPM/request limits under concurrent evals — BackgroundTasks are in-process, unbounded, lost on crash (retry-on-poll recovers grading but not load-shedding); multi-worker EC2 multiplies pressure with no shared queue. (2) SSE connection fan-out — one held response per active hint/feedback/skill-gap stream; no heartbeat/timeout visible; idle streams pin workers (uvicorn worker = blocked stream). (3) DB write/read amplification on results + history (full Q/A fetch per poll/eval; conversation history rebuilt from DB per eval, O(N) growth) — fine <100 concurrent, degrades without pagination/caching. Also: credit-spend-after-persist + log-only failure drifts ledger under retries; HMAC beacon has no expiry (low risk, session-scoped); interview limiters are DB-safe but generic upload/verify throttles remain in-memory (documented).

## 4. Proposals (ranked, modular, no mega-rewrites)

1. **Bounded eval queue + graceful degradation (effort M, benefit H).** Cap concurrent `run_evaluation` with a semaphore (e.g. 8–16) + return `{"status":"queued"}` fast; on Groq 429/timeout, backoff with jitter within the existing 3-retry budget and surface `evaluation_failed` honestly (already rendered). Optionally add a cheap heuristic pre-score (keyword coverage) so partial results never look empty. *Respects:* retry-on-poll, mock-mode tests, fallback-bank pattern. *Risk addressed:* #1.
2. **SSE hygiene: timeouts + heartbeats + cached-replay first (effort S, benefit H).** Add ~60–120 s stream timeout, `: ping` heartbeat, and always serve cached skill-gap/hint before generating (already partially built — extend to hint/feedback keyed by answer). Closes worker-pinning and kills duplicate LLM calls on refresh. *Risk addressed:* #2.
3. **YouTube quota guard: single key + pre-generated fallback (effort S, benefit M).** Single `YOUTUBE_DATA_API_KEY`, cache `search_youtube` results per (skill, query) 7 d in `SystemConfiguration` or a small table, and keep the existing LLM-template fallback as the quota-exhausted path with `source: llm_generated` labelling. *Respects:* 10-credit cost + fair-use rationale. *Risk addressed:* #3.
4. **Ledger reconciliation job (effort S, benefit M).** Nightly/startup sweep: sessions `completed` without matching `spend_credits` txn → compensating charge or flag; failed spends alert, not silent. Fixes spend-after-persist drift without moving spend into the hot path.
5. **Dedupe `run_generator_in_thread` + type `ResultsResponse.learning_path_id` + wire hint UI (effort S, benefit M).** Single helper in `common.py`; add optional field to schema; connect `streamHint` to a "Get hint" button (answer-id-gated, rate-limited). Removes three paper cuts in one pass.
6. **Eval read optimization (effort S, benefit M).** Paginate `session/{id}/questions`, select only needed columns for history rebuild, cap history tokens (truncate oldest answers first, keep system + current Q). Defers the O(N²) history cost as N grows.
7. **Transcribe size cap + async cleanup (effort XS, benefit S).** Enforce max audio bytes/duration (413 beyond), delete temp buffers promptly. Cheap DoS guard.
8. **Beacon HMAC expiry (effort XS, benefit S).** Embed timestamp, accept ≤24 h; keeps single-purpose semantics, closes the documented residual (`IMPLEMENTATION_STATUS.md:198-200`).

*Deferred explicitly (not proposed):* WebSocket/Gemini-Live migration, Redis/Celery, LangGraph — correctly rejected at current scale per §2; revisit only with sustained >200 concurrent sessions or sub-second conversational requirements.

## 5. Stale doc items (code is authoritative)

- **Live-WebSocket as current:** `overview.md:55`, `quickstart.md:23`, `DOCS_INDEX.md:25` present the Gemini-Live WebSocket proxy without a proposal flag; contradicts `INTERVIEW_SYSTEM_ARCHITECTURE.md:50` ("no WebSocket… plain HTTP REST"), `LIVE_INTERVIEW_ARCHITECTURE.md:557` ("Under review"), `IMPLEMENTATION_STATUS.md:138` (deferred P3). Live doc also invents unbuilt surface: `POST /api/interviews/live/start` + `ws://…/ws/interviews/…` (note plural vs real singular `/api/interview/*`), credit costs 100/80/150, `interview_session_live` MySQL-`AUTO_INCREMENT` DDL (runtime is PG-only), stale path `resume_pipeline/routes/live_interview.py`.
- **Stale route contracts:** `QUICK_REFERENCE.md:81-84` + `copilot-instructions.md:76-77` list `GET /api/interview/{id}/question` / `POST …/answer` (+ "MCQ" claims) — nonexistent; real shapes are `GET session/{id}`, `GET session/{id}/questions`, `POST answer` (`PAGE_API_AUDIT.md:21`). Credit prefix `GET /api/credit/*` (singular) stale; real is `/api/credits/*`.
- **Resurrected employer/admin scope:** `QUICK_REFERENCE.md:32-38,69-76`, `DOCS_INDEX.md:32-35`, `testing.md:97` (admin stats) contradict the student-scope cut (`IMPLEMENTATION_STATUS.md:43,99`; `PAGE_API_AUDIT.md:3-6`).
- **Stack/counts:** `copilot-instructions.md` MySQL references + "18 tables" (+ `operations.md:23`, `quickstart.md:20`) stale vs `DATABASE.md:17` (31 tables / 16 PG enums, PG-only). Recommendation weights with JEE/college terms stale vs staged student pipeline.
- **Abandon/polling/study-plan:** `INTERVIEW_SYSTEM_ARCHITECTURE.md:1125-1129` beacon without token stale vs HMAC + Bearer quit; `:1111` "poll q2s, max ~10 s" unbounded stale vs retry-max-3 + partial results; `:521,552-579` `GET study-plan/{id}` as current contradicted by `PAGE_API_AUDIT.md:45` (superseded by skill-gap flow) — no frontend caller remains.
- **Learning-path internals:** `:440` `GET /api/learning-paths/{applicant_id}` wrong (real: `GET …/applicant/{applicant_id}`); `:358-366` NULL-`source_session_id` + 30-day cache stale vs migration-0005 UUID linkage (`IMPLEMENTATION_STATUS.md:88`). Credit line self-healed (10, not 2).
- **Hardcoded models / token math:** `llama3-70b-8192`, `whisper-large-v3`, `gemini-2.0-flash-exp`, `llama3-8b-8192` literals stale vs `MODEL_*` env slots; 5KB-session / 8k-window / fixed-10-question math not portable.
- **Voice semantics:** `:585` "voice entirely browser-side, backend unchanged" + Whisper-as-rare-fallback contradicts `VOICE_LAYER_DESIGN.md:82-90` hybrid (live display + silent Whisper correction) and the real `/transcribe` endpoint.
- **Code-level dead headers:** `sessions.py:646-648` (`candidate-intelligence/{applicant_id}` header, no route); `common.py:93-94` (`study-plan` SSE comment, no route); `interview/__init__.py` double-`__all__`; `INTERVIEW_CONFIG` MCQ-era constants (`MCQ_COUNT_RANGE`, `SHORT_ANSWER_COUNT_RANGE=(0,0)`) alongside v2 short-answer reality.
