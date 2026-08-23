# Implementation Status Register

> **FINAL STATE — post completion-cycle (P0–P2 implemented; P3 deferred), plus a
> scrutiny round that closed the residual security items and a testing/CI
> foundation milestone.**
> This document describes what the codebase actually does **today**, verified by an
> independent adversarial audit, a 183-test backend regression suite, an 82-test
> frontend Vitest suite, and frontend lint/build. It is not a roadmap: anything not
> finished is listed explicitly under Partially Implemented / Missing / Deferred.
>
> Related: `deploy/` for ops, `docs_wiki/architecture/*` for design deep-dives.

## Testing & CI Milestone (post-scrutiny)

- **Frontend testing foundation established**: Vitest 4 + React Testing Library +
  jsdom (`frontend/vitest.config.mjs`, setup in `src/test/setup.js`). 82 tests across
  13 files cover auth (login flows, role routing, protected routes, session expiry),
  credits widget (authoritative API costs), application tracker, the interview session
  hook lifecycle (start/answer/finish/quit/HMAC abandon beacon/hint SSE/recovery),
  evaluation polling recovery, skill-gap SSE → learning-path generation contract,
  semantic talent search (incl. unscored-badge honesty), admin stats consumption, and
  job listing/application — all at the HTTP boundary with error/loading/empty states.
- **Backend suites restored to CI**: `test_interview.py` and `test_learning_path.py`
  run again via a shared-schema in-memory SQLite stub in `db.py`
  (`CI_SKIP_DB_VALIDATION=true` branch only; production paths untouched).
  `test_recommendation_fallback.py` / `test_recommendation_system.py` re-enabled after
  verifying they pass under mock mode. Only `test_api.py` remains excluded (live-key
  smoke test). `test_storage.py::test_s3_file_storage_lifecycle` fixed to assert call
  semantics instead of `BytesIO` object identity.
- **CI pipeline strengthened** (`.github/workflows/ci-cd.yml`): frontend job now runs
  `npm test`; backend job re-enabled the four restored suites and added an Alembic
  verification step running `alembic upgrade head` twice against a disposable
  PostgreSQL 16 service container (real PG DDL/enum coverage + idempotency).
- **Regression found & fixed by the new tests**: JobsPage crashed on every render
  (`ReferenceError: learningPathState is not defined` — dangling reference left when
  the dead learning-path button was removed in commit a100f56). Fixed minimally;
  regression now covered by `JobsPage.test.jsx`.

## Scrutiny Round (post-completion hardening)

- **JWT revocation implemented** (`password_changed_at` + `iat`, enforced in both
  auth dependencies, fail-closed for legacy/malformed tokens; migrations 0006).
- **Code-attempt lockouts moved to the DB** (`security_attempts`, migration 0007) —
  brute-force bounds now hold across workers.
- **Bonus-dedup TOCTOU fixed** (`SELECT … FOR UPDATE` on the account row + exact
  `[session:<id>]` endswith marker); refund/bonus balance updates made atomic.
- **Stale-token upload guard**: presenting invalid credentials no longer silently
  creates an anonymous applicant profile (401 instead of data-split).
- **Last fabricated UI signal removed** (JobModerationPage `job.id % 2` "Flagged").
- **Talent-pool authorization model confirmed by product owner**: open pool stays.

## Phase History (this cycle)

| Phase | Scope | Result |
|---|---|---|
| P0.1 | Auth/authz perimeter | ✅ All applicant-data endpoints authenticated + ownership-scoped; BOLA fixed; regression-tested |
| P0.2 | Config/secrets | ✅ `APP_ENV=production` requires ≥32-char SECRET_KEY; mock-mode defaults fixed; DSN no longer logged |
| P0.3 | Migrations | ✅ Alembic introduced (0001–0005); non-destructive baseline; applied to dev DB |
| P0.4 | Prod API/SSE base URL | ✅ All raw fetch/SSE/beacon calls route through `apiUrl()` |
| P1.1 | Interview abandon | ✅ Explicit quit (Bearer) + HMAC beacon token; honest modal copy |
| P1.2 | Endpoint reconciliation | ✅ 4 mismatches fixed; real `/api/admin/stats`; all admin mocks removed |
| P1.3 | Credit durability | ✅ Atomic spend, refunds wired, bonus dedup, no anonymous credit minting |
| P1.4 | Code hardening | ✅ Attempt lockouts + throttles + uniform anti-enumeration responses |
| P1.5 | Employer scoping | ✅ Schedule/feedback/candidate-intelligence require an application link |
| P1.6 | Evaluation recovery | ✅ Bounded retry-on-poll → honest partial results |
| P2 | Mock purge & integration | ✅ Mentor/analytics/talent/search/embedding fabrications removed or made real; expiry sweeper; taxonomy/config seeding; LearningPath type fix |

## Complete

| Feature | Notes |
|---|---|
| Resume upload + AI parsing (Groq ∥ + Gemini vision OCR) | Upload validation, ownership-gated parse trigger |
| Job posting → admin approval → visibility → expiry | Real expiry sweeper (startup + admin trigger), 'expired' status |
| Recommendations engine + 24h cooldown + credit bypass | Atomic bypass spend with compensating refund on failure |
| Job applications + tracking board | Employer/student transitions enforced; relationship-scoped employer access |
| Interview v2 happy path | Groq generation/evaluation, SSE hints/feedback/study-plan, voice TTS/STT |
| Interview session lifecycle | DB-backed limiters, explicit quit, HMAC beacon abandon, abandon suspension |
| Evaluation recovery | Retry-on-poll (max 3 attempts) then honest partial results |
| Learning paths | Session-based generation; correct UUID session linkage (migration 0005) |
| RAG Q&A assistant | BM25+TF-IDF hybrid over repo docs → Gemini via llm_router |
| Credit ledger core | Atomic conditional updates; refill cycle; transaction log; refunds |
| Auth flows | Register/verify/login/reset/OAuth with lockouts & anti-enumeration |
| Alembic migrations | 0001 baseline (checkfirst) → 0005; applied cleanly to dev DB |

## Mostly Complete

| Feature | Remaining gap |
|---|---|
| Semantic candidate search | Real vector path works off persisted embeddings; coverage depends on reindex runs; text fallback returns unscored results by design |
| Admin center | Real stats endpoint wired; activity-log view depends on audit-log data; duplicate user-management UIs exist in AdminDashboard vs UserManagementPage |
| Rate limiting | Correct single-process; still in-memory (multi-worker deployments need Redis — see Known Limitations) |
| Skill normalization | canonical_skills seeded (98 skills); semantic Pass-2 embeddings require optional `seed_skill_embeddings.py` run |
| Frontend UX states | Loading/error/empty states added on remediated pages; older pages not exhaustively audited for every edge case |

## Partially Implemented

| Feature | State | What's missing |
|---|---|---|
| Premium tiers | Flag-based (`is_premium`) with real quota differences | No payment provider; upgrade/downgrade endpoints are free toggles (documented, not hidden) |
| Mentor network | Backend list + request endpoints are real; frontend consumes them honestly | No accept/decline lifecycle or messaging (product requirements undefined) |
| Notifications | Client-side synthesized banners only | No backend/notification model |
| Source attribution in analytics | Field returned as `null` honestly | Requires schema addition (`source` column) if the product wants it |

## Broken

*(none known)* — the previously broken surfaces (abandon flow, admin user
management, recruitment-analytics error path, recommendation-status endpoint,
production SSE streaming) are fixed and covered by regression tests.
Pre-existing failure `tests/test_storage.py::test_s3_file_storage_lifecycle`
is a stale unit-test expectation against locally-modified storage code,
unrelated to product behavior.

## Mocked / Placeholder

*(none serving fabricated data as real)* — all identified fake surfaces were
removed or replaced with genuine implementations. Remaining placeholders are
explicitly labelled in the UI ("coming soon", "not available yet", "Unscored").

## Missing (intentionally deferred — P3)

See **Deferred** below. Nothing documented as shipped is missing.

## Deferred (P3 — not started, by priority discipline)

| Item | Reason deferred |
|---|---|
| Payment integration | Requires business model + provider decision (stop-condition per instructions) |
| Coding challenges | Priced/metered in config but no judge exists; large feature |
| Live/WebSocket interviews | Roadmap/proposal only (`LIVE_INTERVIEW_ARCHITECTURE.md`); requires product confirmation |
| Notification backend | Product scope undefined |
| Report export, Add Education/Experience buttons, misc dead handlers | Polish items behind core-workflow reliability |
| Accessibility pass (focus traps, hover-only menus, ARIA) | Polish |
| Frontend test framework + CI suite re-enablement (test_interview, test_learning_path, etc.) | Infrastructure work; suites exist and pass locally |
| JWT revocation after password reset | Stateless tokens; needs token-versioning scheme decision |

## Known Limitations (documented residual risks)

1. **Generic IP rate limiting is in-memory** (`rate_limit()` for upload/verify/reset
   throttles) — per-process only; a reverse proxy makes it coarse-grained. It acts as
   a soft DoS guard, NOT a security control. Security-critical bounds that must hold
   across workers (code-attempt lockouts) are **DB-backed** in the `security_attempts`
   table (migration 0007). Note: concurrent bursts can momentarily exceed the
   5-attempt verify-code cap before the server-side code invalidation kicks in — the
   code itself is invalidated on lockout, so excess guesses cannot succeed.
2. **BackgroundTasks are in-process** — evaluation retries recover lost tasks
   on poll, but a crash mid-task still relies on that retry path (bounded).
3. **JWTs are revoked on password change/reset** (`password_changed_at` + `iat`,
   fail-closed for legacy/malformed tokens). Edge: a token issued in the same
   wall-clock second as the change is also revoked — client just re-logins.
4. **Semantic search authorization model — PRODUCT DECISION (confirmed by owner)**:
   `entity_type=applicant` intentionally serves the whole talent pool to any
   employer ("proactive candidate discovery" model). Stricter application-link
   scoping remains available via one call to `authorize_applicant_access` if the
   product direction ever changes.
5. **Abandon-beacon HMAC has no expiry binding** — a leaked beacon token stays
   valid until its session ends; replay only re-abandons the same session
   (single-purpose, negligible impact).
6. **Landing-page testimonials are static marketing copy** (Hero.jsx) — not
   presented as platform data; source real quotes or label as illustrative.
7. **PostgreSQL ≥ 12 required** — enum-widening migrations use transactional
   `ALTER TYPE … ADD VALUE` (Supabase PG15 is fine).
8. **In-memory rate limiting / JWT revocation**: rate limiting scale-out needs Redis
   (see #1). JWT revocation after credential change IS implemented (was previously
   listed as open).
9. **SkillGapModal has no visible error banner when the gap-analysis SSE stream
   fails** — the roadmap button correctly disables and no fabricated content is
   shown (covered by `SkillGapModal.test.jsx`), but the user gets no explicit error
   text; adding one is a small UX polish item, deferred with P3.

## Verification Summary

- Backend: `pytest tests/ -q --ignore=tests/test_api.py` → **183 passed, 1 skipped**
  (up from 179 — the four previously CI-excluded suites are restored).
- Frontend: `npm test` → **82 passed (13 files)**; `npm run lint` (zero warnings);
  `npm run build` clean.
- Migrations: `alembic upgrade head` applied 0001→0007 to the dev database
  without data loss and re-runs idempotently; chain also verified against throwaway
  SQLite DBs in `test_migrations.py`; CI validates on real PostgreSQL.
- Independent adversarial audit: 10 claims attacked from scratch; 8 CONFIRMED-RESOLVED,
  C5 PARTIAL→burst-nuance documented (#1), C10 violation found & fixed
  (JobModerationPage fake "Flagged" heuristic removed). All actionable defects
  (D1, D3, D4, D6, D7 plus latent `InterviewService` NameError in award-bonus)
  fixed with tests; informational items disclosed above.
