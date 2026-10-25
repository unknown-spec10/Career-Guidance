# Security Audit — Career Guidance AI System

Read-only audit. No source, test, config, or env files were changed.
Every finding below was verified against the actual code (file:line cited); no theoretical findings.
Severity: Critical / High / Medium / Low.

## 1. Findings

### Authentication & JWT — 3 findings

| ID | Severity | Location | Impact | Remediation |
|---|---|---|---|---|
| A1 | **High** | `resume_pipeline/resume_pipeline/routers/auth.py:249` (`register`), `:345` (`login`) — no `rate_limit()` call, unlike verify/forgot/reset at `:783,:847,:916,:989` | Unlimited credential-stuffing and account-enumeration against login/register. | Add `rate_limit(request, max_requests=5, window=300)` to login/register, same as forgot-password. |
| A2 | Medium | `resume_pipeline/resume_pipeline/routers/auth.py:426,463-467` — Google OAuth `state` is bare `role:student\|employer` with no CSRF nonce/signature | Attacker can force a victim into an attacker-chosen role binding (login CSRF class). | Sign `state` with `SECRET_KEY` (HMAC + nonce) and verify in the callback. |
| A3 | Low | `resume_pipeline/resume_pipeline/auth.py:40-41` — `get_current_user_optional` swallows all exceptions → `None` | Fragile pattern: every anonymous-fallback route must re-check; one missed check becomes an auth bypass. | Log the exception class server-side; audit each `optional` consumer (upload, RAG, preview) to confirm explicit re-checks. |

JWT handling itself (verified, not a finding): `iat` embedded at `auth.py:64-75`, revocation via `password_changed_at` at `auth.py:78-100` wired into both `get_current_user` (`:142-146`) and the optional path (`:37-38`), set on change-password (`routers/auth.py:615`) and reset-password (`:956`), column at `db.py:64`. Gaps tracked as M2/M3 below.

### Authorization & ownership — 2 findings

| ID | Severity | Location | Impact | Remediation |
|---|---|---|---|---|
| B1 | **High** | `resume_pipeline/resume_pipeline/routers/misc.py:66-81` — `GET /static/{file_path:path}` builds `Path(settings.FILE_STORAGE_PATH) / file_path` with no normalization or auth | Path traversal: `GET /static/../../.env` (or any repo-parent file) is served to anyone whenever `is_file()` holds. | Require auth (or scope to avatar dir) and enforce `resolved = (base / file_path).resolve(); require str(resolved).startswith(str(base.resolve()))`. |
| B2 | Medium | `resume_pipeline/resume_pipeline/routers/recommendations.py:51` — any `employer` role may view any applicant's recommendations, vs `authorize_applicant_access` in `routers/deps.py:312-326` restricting employers to linked applications | Inconsistent employer-access policy; broader exposure than the applicant-access helper intends. | Decide one policy: either route recommendations through `authorize_applicant_access` or document the intentional bypass. |

Correctly scoped (verified, not findings): `routers/resume.py:470-493` and `:343-354`, `routers/recommendations.py:158-165`, `routers/profile.py:75-77,201-205,346`, `routers/credits.py:92-97`, `routers/applications.py:86`, `interview/sessions.py:254,370,423,495,609`, `interview/streaming.py:58,91,169,269`.

### Injection — 1 informational

| ID | Severity | Location | Impact | Remediation |
|---|---|---|---|---|
| C1 | Low | `resume_pipeline/resume_pipeline/rag/rag.py:108+` (RAG queries, length-only validation), resume text → Groq/Gemini prompts via `utils.py:122-159` (`truncate_for_llm` truncates only) | Prompt/context injection possible but expected for this app shape; no instruction-hierarchy delimiting. | Delimit untrusted content in prompts (e.g. `<resume>…</resume>` with explicit ignore-instructions); no urgent change. |

Verified clean: SQL is ORM-bound throughout (`jobs.py:96-113,123` `ilike(f"%{q}%")` passes the pattern as a bind value); the only f-string SQL is `CREATE DATABASE` from server config (`app.py:152`); the sole `subprocess` is list-form `["pdftotext", path, "-"]` with no `shell=True` (`resume/ingest.py:62`).

### Secrets — none found

Grep for hardcoded secrets returns only `auth.py:49 SECRET_KEY = settings.SECRET_KEY` (env-sourced); `config.py` defaults are empty strings. No finding.

### CORS & rate limiting — 2 findings

| ID | Severity | Location | Impact | Remediation |
|---|---|---|---|---|
| D1 | Medium | `resume_pipeline/resume_pipeline/routers/deps.py:98,246-268` — `rate_limit()` backed by in-process `defaultdict(list)`, keyed on `client.host`, no `X-Forwarded-For` handling | Limiter does not survive multi-process deploys (EC2/Docker multi-worker) and is spoofable behind a proxy; abuse-path endpoints (upload, email-send) unprotected in prod. | Move to a DB/Redis-backed limiter (code-attempt tracking in `deps.py:101-103` already uses `security_attempts`; extend the pattern). |
| D2 | Low | `resume_pipeline/resume_pipeline/app.py:64-77` — `allow_credentials=True` with `allow_methods/headers=["*"]`; origins from `CORS_ORIGINS` (default localhost-only, `config.py:182`) | Safe as configured, but one operator setting `CORS_ORIGINS=*` plus credentials becomes a live misconfiguration the code does not guard against. | Reject `*` when `allow_credentials=True` at startup; narrow methods/headers to what the frontend uses. `Cache-Control: no-store` on `/api/*` (`:80-88`) is good. |

### File upload — 2 findings

| ID | Severity | Location | Impact | Remediation |
|---|---|---|---|---|
| E1 | Medium | `resume_pipeline/resume_pipeline/routers/resume.py:107-112` (resume: extension-only check), `:118-120` (marksheets: size-only, no extension check), `routers/auth.py:649-654` (avatar: extension-only); `ALLOWED_MIME_TYPES` imported but never enforced; no magic-bytes sniffing anywhere | Polyglot/mislabeled executables pass validation; exposure is downstream parsing (`pdfplumber`/`pdfminer`/`pdftotext`) of crafted files. | Enforce MIME + magic bytes (e.g. `python-magic`) on resume/avatar, add the missing extension check on marksheets. |
| E2 | Low | `resume_pipeline/resume_pipeline/routers/resume.py:363-368` — `parse_applicant` builds `DATA_ROOT/"resumes"/applicant_id` from the URL param; `routers/profile.py:243-247` — resume preview accepts JWT via `?token=` query param | Path probing (impact limited to `.exists()` + task enqueue); tokens in URLs leak into logs/history. | Sanitize/validate the path segment; move preview token to `Authorization` header. |

Verified good: 10 MB server-side size checks (`resume.py:115,120` via `deps.py:333-345`), 2 MB avatar cap (`auth.py:657-663`), `sanitize_filename` (basename + charset, `utils.py:79-98`, used `resume.py:138,194`, `auth.py:667`), server-generated storage dirs, anonymous-upload orphan-row trade-off with stale-token rejection (`resume.py:68-99`) being intentional.

### Error handling — 3 findings

| ID | Severity | Location | Impact | Remediation |
|---|---|---|---|---|
| F1 | Medium | `resume_pipeline/resume_pipeline/routers/resume.py:316-324` — `str(e)` returned to client in `"warning"` plus full `traceback.format_exc()` logged | DB internals (constraint/table names, DSN fragments) leak to clients. | Log server-side with a correlation ID; return a generic message + ID. |
| F2 | Medium | `resume_pipeline/resume_pipeline/routers/resume.py:465` — `result['database_error'] = str(e)` in parse response | Same internal-details leak via the parse path. | Same fix as F1. |
| F3 | Low | `resume_pipeline/resume_pipeline/routers/auth.py:574` — `f"Authentication error: {str(e)}"` reflected into a frontend redirect `?error=` URL | Internal error text ends up in browser history/logs. | Map to a fixed set of user-facing error codes. |

### Token & session hygiene — 2 findings

| ID | Severity | Location | Impact | Remediation |
|---|---|---|---|---|
| G1 | Medium | `resume_pipeline/resume_pipeline/config.py:107` — `ACCESS_TOKEN_EXPIRE_MINUTES=1440` (24 h), no refresh rotation; `auth.py:103-113` decode has no denylist | A stolen token is usable for a full day; no explicit logout invalidation. | Shorten access-token TTL (e.g. 60 min) with refresh-token rotation, or add a logout denylist. |
| G2 | Low | `resume_pipeline/resume_pipeline/config.py:105` — `SECRET_KEY` defaults to `""`; `routers/deps.py:190-202` `validate_env` errors only in production | Dev/staging instances with weak keys sign forgeable tokens. | Fail startup on empty/weak `SECRET_KEY` in every environment. |

### Dependencies — 4 findings

| ID | Severity | Location | Impact | Remediation |
|---|---|---|---|---|
| H1 | **High** | `resume_pipeline/requirements.txt:25` — `python-jose[cryptography]` (unmaintained since ~2022; CVE-2024-33663 algorithm-confusion class). Only HS256 allow-listed (`auth.py:106`), which narrows but does not remove the maintenance risk | Unpatched JOSE library in the auth path. | Migrate to actively maintained `PyJWT`. |
| H2 | Medium | `resume_pipeline/requirements.txt:23-24` — `passlib[bcrypt]==1.7.4` + `bcrypt==3.2.2` (2021-era) | Forgoes 4+ years of fixes; known `bcrypt>=4` friction keeps the ecosystem stale. | Keep the pin deliberately or migrate to `pwdlib` / direct `bcrypt`. |
| H3 | Medium | `resume_pipeline/requirements.txt` — all other backend deps lower-bounded (`>=`) with no lockfile | Non-reproducible builds; supply-chain drift between installs. | Commit a locked requirements file (`pip freeze` / `pip-compile`). |
| H4 | Medium | `frontend/package.json:14` — `axios ^1.6.7` (floor predates the 1.8.4 SSRF fix CVE-2024-39396) | A fresh install at the floor pulls a vulnerable axios. | Bump floor to `^1.8.4`. |

Informational (no severity): frontend JWT lives in `sessionStorage` with base64 "obfuscation" (`frontend/src/utils/secureStorage.js:6-19`, attached `config/api.js:35-38`) — the file's own comments state it is not encryption; mitigation is XSS hygiene, not storage.

## 2. Verified claims (as the code actually stands)

- **Ownership scoping:** enforced on all applicant-data routes via `resolve_applicant` + `authorize_applicant_access` (student-own-only, employer-linked-only, admin-all) and per-user filters — except the intentionally anonymous upload path (creates `user_id=None` orphans, `routers/resume.py:243-251`) and the unauthenticated `/static/{file_path:path}` traversal hole (B1 above).
- **JWT revocation:** correctly implemented — `iat` issuance, `password_changed_at` comparison with fail-closed legacy/malformed handling, wired into both auth paths, set on password change and reset. Residual risk is lifetime/rotation (G1), not revocation logic.
- **Upload validation:** size limits and filename sanitization are enforced server-side; type validation is extension-only (marksheets: none) with `ALLOWED_MIME_TYPES` imported but unenforced and no magic-bytes check (E1 above). Storage paths are server-generated and safe (E2 notes the two edge cases).

## 3. Severity summary

Critical 0 · **High 3** (A1, B1, H1) · **Medium 10** (A2, B2, D1, E1, F1, F2, G1, H2, H3, H4) · **Low 7** (A3, C1, D2, E2, F3, G2, + storage informational).
