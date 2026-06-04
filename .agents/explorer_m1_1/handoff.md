# Handoff Report — explorer_m1_1

## 1. Observation
*   The `.env` file at `D:\Career Guidence\.env` contains plain-text active API keys:
    *   `GEMINI_API_KEY=<REDACTED>` (Line 14)
    *   `GROQ_API_KEY=<REDACTED>` (Line 22)
    *   `OPENROUTER_API_KEY=<REDACTED>` (Line 25)
    *   `YOUTUBE_DATA_API_KEY=<REDACTED>` (Line 20)
    *   `GOOGLE_SEARCH_API_KEY=<REDACTED>` (Line 33)
    *   `GMAIL_APP_PASSWORD=<REDACTED>` (Line 75)
*   The endpoints `/api/applicant/{applicant_id}` (Lines 1505–1547) and `/api/parse/status/{applicant_id}` (Lines 1364–1414) in `D:\Career Guidence\resume_pipeline\resume_pipeline\app.py` fetch user profile details and parsed resume contents, but do not contain validation matching the authenticated `current_user.id` to the queried `applicant.user_id` record.
*   The general rate limiter (Lines 142–164) and the RAG rate limiter (Lines 4025–4046) in `D:\Career Guidence\resume_pipeline\resume_pipeline\app.py` record rate-limiting metadata in local worker memory dictionaries (`rate_limiting_storage = defaultdict(list)` and `rag_rate_limiter = defaultdict(lambda: {"count": 0, "reset_time": 0})`).
*   The utility class `D:\Career Guidence\frontend\src\utils\secureStorage.js` uses standard Base64 obfuscation (`btoa` / `atob`) to secure stored session objects.
*   Dependency versions:
    *   `axios` in `frontend/package.json` is set to `^1.6.7` (Line 12).
    *   `bcrypt` in `resume_pipeline/requirements.txt` is set to `==3.2.2` (Line 23).

---

## 2. Logic Chain
1.  **Observations → Secrets Exposure**: Since active tokens are checked in under the `.env` file, any user or attacker with access to the repo state (or historical git commits if committed) can misuse resources.
2.  **Observations → BOLA / IDOR vulnerability**: Because endpoints `/api/applicant/{applicant_id}` and `/api/parse/status/{applicant_id}` retrieve student records directly from DB based on url parameters without owner validations (which exist on other endpoints like recommendations), any user with a student token can fetch any other student's data.
3.  **Observations → Volatile Rate Limiting**: Since FastAPI worker processes (e.g., standard gunicorn config in Render deployment) do not share state, the in-memory defaultdict configuration will track requests per-worker, allowing bypasses of rate limiting when traffic is distributed across workers.
4.  **Observations → Weak Cryptography**: Because Base64 encoding is fully reversible without any cryptographic key, any local client script can immediately read "encrypted" entries inside the sessionStorage prefix.

---

## 3. Caveats
*   No dynamic security scanning was executed using shell tools (Bandit / npm audit / pip-audit) because permission prompts for `run_command` timed out. All findings are derived via static code review.
*   Production Supabase database connection details were not audited (only localhost connection parameters were observed in local `.env`).

---

## 4. Conclusion
The repository has several high-severity security vulnerabilities, notably hardcoded production credentials, Broken Object Level Authorization (BOLA) exposing student profile and parsed data, volatile in-memory rate limiting, and weak obfuscation of client-side credentials. Remediation plans must be prioritized immediately.

---

## 5. Verification Method
1.  **Identify Secrets**: View `D:\Career Guidence\.env` using `view_file` to confirm plain-text keys are stored locally.
2.  **BOLA Verification**: Inspect `D:\Career Guidence\resume_pipeline\resume_pipeline\app.py` at Line 1505 and Line 1364. Verify that there is no check comparing `applicant.user_id` with `current_user.id` for non-admin/employer roles.
3.  **Client-side Encryption Verification**: View `D:\Career Guidence\frontend\src\utils\secureStorage.js` to inspect the `encode` and `decode` functions using `btoa` and `atob`.
