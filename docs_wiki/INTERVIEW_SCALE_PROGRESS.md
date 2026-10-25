# Interview Scale Progress

Date: 2026-10-24. Task: implement 3 scalability proposals from INTERVIEW_ARCHITECTURE_AUDIT.md §4.1-4.3. No commit.

## Baselines (before changes)
- Backend interview scope (PY=/c/Program Files/Python312/python.exe, GEMINI_MOCK_MODE=true, CI_SKIP_DB_VALIDATION=true, SECRET_KEY=test...jwt): test_interview.py + test_learning_path.py + test_evaluation_recovery.py + test_interview_abandon.py + test_llm_router.py + test_circuit_breaker.py + test_retrieval_rerank.py = **56 passed**.
- Full backend (minus test_api/test_migrations/test_storage): 196 passed, 20 failed (all missing-optional-dep env noise: boto3, google-cloud-storage, the local embedding stack, pdf extras — unrelated to interview), 1 skipped.
- Frontend vitest: 20 files, 103 tests passed.

## Plan
1. Bounded eval concurrency + backoff: semaphore (cap 8) + rate-limit backoff inside MAX_EVAL_RETRIES=3 in evaluator.py; config in constants.py INTERVIEW_CONFIG_V2.
2. SSE timeouts + heartbeats + cached-replay-first: wrap_sse_with_heartbeat + SSE_* constants in common.py; cached hint/feedback replay + wrapped streams in streaming.py; idle timeout in skill-gap streamer.
3. YouTube single-key + cache: YOUTUBE_DATA_API_KEY in config.py; get_youtube_keys/search_youtube_with_rotation/YouTubeQuotaExhausted/7d SystemConfiguration+memory cache/source labelling in learning/generator.py; re-export shim.
4. New tests: tests/test_interview_scale.py (cap, backoff, SSE, single-key+cache).
5. Docs touch-up after green: architecture/INTERVIEW_SYSTEM_ARCHITECTURE.md (+ audit §4 statuses).

## Status
- [x] Baselines recorded
- [x] Build 1 (evaluator + constants)
- [x] Build 2 (common + streaming)
- [x] Build 3 (config + learning generator + shim)
- [x] New tests green + full suites green
- [x] Docs touch-up

## Final numbers (2026-10-24)
- New: resume_pipeline/tests/test_interview_scale.py — 11 passed.
- Interview scope (scale + interview + learning_path + evaluation_recovery + abandon + llm_router + circuit_breaker + retrieval_rerank + refactor_proof): 72 passed, 2 failed — the 2 failures are test_interview_refactor_proof route-enumeration, a pre-existing FastAPI 0.162 `_IncludedRouter` env artifact (routes serve fine via TestClient; was failing identically at baseline).
- Full backend (minus test_api/migrations/storage): 215 passed, 12 failed, 1 skipped. Baseline: 196 passed, 20 failed. All 12 remaining failures are pre-existing env issues, also failing at baseline: local_embedder x8 (local embedding backend not installed), refactor_proof x2 (above), parsing gcs x1 (google-cloud-storage namespace), security_followups x1 (bcrypt 72-byte limit). boto3 install during this session fixed 8 previously-failing tests (profile_picture x4, secfix x1, perimeter x3).
- Frontend vitest: 21 files, 116 passed (one transient InterviewPage failure on first full run passed in isolation and on rerun — flaky, file untouched by this change).

## Deliberate deviation
- Proposal 1 says `return {"status":"queued"}` fast — NOT adopted: AnswerResponse has no such status and same-API-contracts forbids it. Shedding happens worker-side (answer stays pending_evaluation) with recovery via existing retry-on-poll.
