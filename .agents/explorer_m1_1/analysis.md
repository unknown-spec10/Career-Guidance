# Security Analysis Report — Career Guidance System

This report presents a detailed security analysis of the Career Guidance System codebase (FastAPI backend and React frontend). The audit identifies potential vulnerabilities, evaluates their impacts, and provides concrete remediation steps.

---

## 1. Executive Summary

A comprehensive security review of the `resume_pipeline/` backend and `frontend/` codebase was conducted. The main findings include:
*   **Secrets Exposure**: Critical production API keys (Gemini, Groq, OpenRouter, Google Search Engine) and credentials (Gmail App Password, database root passwords) are hardcoded in the `.env` file within the repository.
*   **BOLA / IDOR Vulnerabilities**: Multiple API endpoints (specifically `/api/applicant/{applicant_id}` and `/api/parse/status/{applicant_id}`) lack ownership validation, allowing any authenticated user to fetch other users' detailed resumes and parsing confidences.
*   **Volatile Rate Limiting**: The custom rate-limiting implementation uses Python's in-memory `defaultdict` structures. Under multi-process/gunicorn server deployments (such as Render), rate limits can be easily bypassed.
*   **Insecure Obfuscation**: Client-side secure storage (`secureStorage.js`) uses simple Base64 encoding labeled as "encryption" to store sensitive user data and tokens, offering no true cryptographic security.

---

## 2. Detailed Vulnerability Findings

### Finding 1: Hardcoded Secrets and Credentials in Repository Configuration
*   **File Path**: `D:\Career Guidence\.env`
*   **Severity**: **Critical**
*   **Description**: The `.env` configuration file contains highly sensitive keys and credentials active in production:
    *   `GEMINI_API_KEY`: Google Gemini API key (Line 14)
    *   `YOUTUBE_DATA_API_KEY`: YouTube developer key (Line 20)
    *   `GROQ_API_KEY`: Groq API token (Line 22)
    *   `OPENROUTER_API_KEY`: OpenRouter API key (Line 25)
    *   `DEEPSEEK_API_KEY`: DeepSeek API key (Line 28)
    *   `GOOGLE_SEARCH_API_KEY`: Google Search API key (Line 33)
    *   `SECRET_KEY`: JWT Signing Key (Line 67)
    *   `GMAIL_USER` & `GMAIL_APP_PASSWORD`: Plaintext SMTP credentials (Lines 74–75)
    *   `PG_PASSWORD`: Default DB root password `root` (Line 7)
*   **Impact**: Compromise of these API keys can lead to service denial, financial loss through unauthorized usage of AI credits, access to sensitive databases, and the ability to send phishing emails via the verified Gmail account.
*   **Remediation**:
    1.  Immediately revoke and regenerate all exposed API keys and passwords.
    2.  Ensure `.env` is omitted from all version control commits. Although `.gitignore` correctly lists `.env`, these credentials were already checked into the local environment state. Remove cached tracking:
        ```powershell
        git rm --cached .env
        ```
    3.  Inject secret credentials at runtime using the host platform's secure environment manager (e.g., Render Environment Variables).

---

### Finding 2: Broken Object-Level Authorization (BOLA / IDOR) on Applicant Endpoints
*   **File Path**: `D:\Career Guidence\resume_pipeline\resume_pipeline\app.py`
*   **Severity**: **High**
*   **Description**:
    *   **Endpoint `/api/applicant/{applicant_id}`** (Lines 1505–1547): This endpoint resolves an applicant by ID (numeric or UUID string) and returns their full profile, parsed resume text (`normalized` field), and confidences. There is no user identity check; any user (including other students) can query this endpoint.
    *   **Endpoint `/api/parse/status/{applicant_id}`** (Lines 1364–1414): Polls parsing status and returns field confidences and flags. The endpoint verifies `current_user = Depends(get_current_user)` but fails to verify that the requesting user owns the `applicant_id` resource.
*   **Impact**: Malicious users can scan sequential integer IDs or enumerate UUIDs to scrape candidates' personal details, contact information, work history, and grades.
*   **Remediation**:
    Check user ownership prior to returning records, similar to the validation implemented in `/api/recommendations/{applicant_id}` (Lines 2573–2581):
    ```python
    if current_user.role not in ("admin", "employer", "college"):
        if getattr(applicant, "user_id", None) != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not own this profile."
            )
    ```

---

### Finding 3: Vulnerable Custom Rate Limiting
*   **File Path**: `D:\Career Guidence\resume_pipeline\resume_pipeline\app.py`
*   **Severity**: **Medium**
*   **Description**:
    The general API rate limiter (Lines 142–164) and the RAG rate limiter (Lines 4025–4046) use in-memory `defaultdict` structures (`rate_limiting_storage` and `rag_rate_limiter`).
*   **Impact**:
    1.  **Server Scaling**: In multi-process or cluster deployments (e.g., standard Render/Gunicorn setups), requests are distributed across multiple worker processes. Since memory is not shared between processes, the actual rate limit is multiplied by the number of workers.
    2.  **Memory Exhaustion**: The `rate_limiting_storage` continues to grow dynamically with every new IP address request. An attacker can perform a Distributed Denial of Service (DDoS) by rotating IP addresses or endpoints, consuming server memory.
*   **Remediation**:
    Use a central distributed storage system like **Redis** (e.g., using `slowapi` or `fastapi-limiter`) to track requests across process boundaries.
    ```python
    # Example using slowapi
    from slowapi import Limiter
    from slowapi.util import get_remote_address

    limiter = Limiter(key_func=get_remote_address, storage_uri="redis://localhost:6379")
    ```

---

### Finding 4: Weak Cryptographic Obfuscation on Frontend Storage
*   **File Path**: `D:\Career Guidence\frontend\src\utils\secureStorage.js`
*   **Severity**: **Low**
*   **Description**:
    The utility `secureStorage.js` claims to provide "encrypted storage for sensitive data" (Lines 2–3). However, it uses `btoa` (Base64 encoding) and `atob` (Base64 decoding) (Lines 11–29):
    ```javascript
    const encode = (data) => {
      try {
        const json = JSON.stringify(data)
        return btoa(json)
      } catch (err) { ... }
    }
    ```
*   **Impact**: Base64 is an encoding scheme, not encryption. Any malicious script or browser extension executing in the user's browser context can decode this data instantly. This can lead to credential theft if access tokens or PII are stored here.
*   **Remediation**:
    If client-side data must be encrypted to prevent physical device inspection, use standard symmetric encryption libraries (e.g., `CryptoJS` with `AES-256`) with a key derived dynamically (or accept that `sessionStorage` is plaintext and do not advertise it as "secure" or "encrypted").
    ```javascript
    import CryptoJS from 'crypto-js';
    const encrypt = (data, secret) => CryptoJS.AES.encrypt(JSON.stringify(data), secret).toString();
    ```

---

### Finding 5: Potential XSS Vector in Markdown Rendering (Missing Sanitization)
*   **File Path**: `D:\Career Guidence\frontend\src\pages\AskPage.jsx`
*   **Severity**: **Low**
*   **Description**:
    The page `AskPage.jsx` (Lines 115 and 188) uses the `<ReactMarkdown>` component to render LLM responses. Unlike other pages (e.g., `JobDetailsPage.jsx`), it does not configure restrictive renderers or apply HTML sanitization to outputs.
*   **Impact**: If the LLM generates or forwards malicious markdown links or scripts, it could lead to Stored/Reflected Cross-Site Scripting (XSS) in the context of the user's browser session.
*   **Remediation**:
    Use a library like `DOMPurify` to sanitize HTML content before rendering, or configure `rehypeRaw` with caution:
    ```javascript
    import DOMPurify from 'dompurify';
    // Sanitize output
    ```
    Alternatively, enforce markdown constraints by disabling dangerous protocols:
    ```javascript
    <ReactMarkdown allowedSchemes={['http', 'https', 'mailto']}>
    ```

---

## 3. Dependency Security Assessment

### Backend Dependencies (`requirements.txt`)
*   `cryptography>=46.0.3` (Secure)
*   `passlib[bcrypt]==1.7.4` (Known Issue: passlib relies on legacy internal structures in Python 3.11+, leading to warnings during bcrypt imports).
*   `bcrypt==3.2.2` (Legacy version. Recommended upgrade to `bcrypt>=4.0.0` for performance improvements and security fixes).
*   `python-jose[cryptography]>=3.5.0` (Secure, but ensure standard configurations are used).

### Frontend Dependencies (`package.json`)
*   `axios": "^1.6.7"` (Vulnerability Check: `axios < 1.7.4` has a Server-Side Request Forgery / SSRF vulnerability when handling relative redirects. Recommended upgrade: `^1.7.4` or newer).
*   `eslint": "^8.56.0"` (Development dependency, low risk).
*   `vite": "^5.1.4"` (Secure, but keep updated to mitigate local dev server vulnerabilities).

---

## 4. Recommended Security Scanning Commands

To perform automated validation of the codebase, execute the following commands in the workspace:

### Python Backend Static Analysis (Bandit)
Bandit scans Python code for security issues like hardcoded passwords, unsafe imports, SQL injection, and insecure random number generators.
```powershell
# Install Bandit
pip install bandit

# Run Bandit scan on the backend directory (recursive, exclude tests)
bandit -r resume_pipeline/ -x resume_pipeline/tests/
```

### Node.js Frontend Dependency Scan (npm audit)
Npm audit checks frontend libraries in `package.json` against the GitHub Advisory Database for known vulnerabilities.
```powershell
# Navigate to frontend and run audit
cd frontend
npm audit
```

### OWASP Dependency Check
Scans Python packages and Node modules against global CVE databases:
```powershell
# Audit python requirements
pip-audit -r resume_pipeline/requirements.txt
```
