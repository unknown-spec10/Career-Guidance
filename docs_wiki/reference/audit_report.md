## Forensic Audit Report

**Work Product**: `D:\Career Guidence\docs\security_audit_report.md`
**Profile**: General Project
**Verdict**: CLEAN

### Phase Results
- **Presence Check**: PASS — The file `D:\Career Guidence\docs\security_audit_report.md` exists and is fully populated with comprehensive documentation, vulnerability tables, and logs.
- **Log Authenticity Audit**: PASS — Checked the logs in `D:\Career Guidence\.agents\worker_m1_1\bandit_log.txt` and `D:\Career Guidence\.agents\worker_m1_1\npm_audit_log.txt`. The output formats, line numbers, packages, and vulnerabilities correspond exactly with the physical source code files (e.g. `app.py`, `package.json`, `secureStorage.js`, `AskPage.jsx`, `google_search.py`, `vector_store.py`, `file_type_router.py`) in the repository. No signs of mocking or fabricating logs were found.
- **Source Code Integrity Check**: PASS — Manual verification of lines and modules matching the reported issues confirms that they exist in the repository as claimed.

### Evidence
1. **Secrets Exposure**: 
   - Verified that `D:\Career Guidence\.env` contains hardcoded credentials including Gemini API keys (`AIzaSyDBotc7...`), YouTube API keys (`AIzaSyCB...`), Groq API keys (`gsk_9oTda...`), OpenRouter API keys (`sk-or-v...`), DeepSeek API keys (`sk-2c87f...`), Google Search API keys (`AIzaSyDM...`), database password (`PG_PASSWORD=root`), JWT secret (`SECRET_KEY=09d25e...`), and Gmail SMTP credentials (`GMAIL_APP_PASSWORD=xcezxv...`).
2. **Broken Object-Level Authorization (BOLA)**:
   - Verified endpoint `D:\Career Guidence\resume_pipeline\resume_pipeline\app.py` at `/api/applicant/{applicant_id}` (lines 1505-1547) and `/api/parse/status/{applicant_id}` (lines 1364-1414). Both accept applicant ID inputs and return detailed records without performing ownership or tenant-level checks against `current_user.id`.
3. **MD5 Weak Hash Findings**:
   - Verified `D:\Career Guidence\resume_pipeline\resume_pipeline\core\google_search.py` at line 28: uses `hashlib.md5(query.encode()).hexdigest()` to generate cache keys.
   - Verified `D:\Career Guidence\resume_pipeline\resume_pipeline\resume\file_type_router.py` at line 184: uses standard XML parser `ET.fromstring(xml_bytes)` which is vulnerable to XXE.
   - Verified `D:\Career Guidence\resume_pipeline\resume_pipeline\rag\vector_store.py` at line 366: uses `pickle.load(f)` on vector store indices which is vulnerable to insecure deserialization/RCE.
4. **Obfuscation & Front-End Vulnerabilities**:
   - Verified `D:\Career Guidence\frontend\src\utils\secureStorage.js` uses standard `btoa`/`atob` base64 encoding (lines 11-29) advertised as "encrypted storage".
   - Verified `D:\Career Guidence\frontend\src\pages\AskPage.jsx` renders Gemini output directly via `<ReactMarkdown>` without sanitizing it first (line 115 / 188), which can lead to XSS.
5. **Frontend Dependency Versions**:
   - Checked `D:\Career Guidence\frontend\package.json` where dependencies like `axios` (`^1.6.7`), `react-router-dom` (`^6.22.0`), and devDependencies like `postcss` (`^8.4.35`) and `vite` (`^5.1.4`) match the vulnerable packages reported in `npm_audit_log.txt`.
