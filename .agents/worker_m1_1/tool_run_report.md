# Tool Run Report — Security Scans

This report summarizes the automated security scan findings on the Career Guidance repository.

---

## 1. Static Analysis (Bandit)

Bandit was run on the Python backend:
- **Command:** `python -X utf8 -m bandit -r D:\Career Guidence\resume_pipeline\resume_pipeline -x D:\Career Guidence\resume_pipeline\tests`
- **Scanned Lines:** 17,081 lines of code
- **Total Issues Found:** 41

### Severity & Confidence Metrics
- **Severity**: High: 10, Medium: 3, Low: 28, Undefined: 0
- **Confidence**: High: 34, Medium: 7, Low: 0, Undefined: 0

### Key Findings
1. **High Severity: Weak Cryptographic Algorithms (CWE-327 / B324)**
   - **Issue:** Multiple usages of `hashlib.md5()` for generating cache keys and identifiers.
   - **Locations:** 
     - `resume_pipeline/app.py:3145`
     - `resume_pipeline/resume/skill_taxonomy_builder.py:31`
     - `resume_pipeline/core/google_search.py:28`
     - `resume_pipeline/rag/document_processor.py:237`
     - `resume_pipeline/rag/file_watcher.py:125, 131`
     - `resume_pipeline/rag/rag_service.py:234, 244, 253, 486`
   - **Remediation:** For non-cryptographic uses (like caching), pass `usedforsecurity=False` in Python 3.9+ to avoid triggering compliance checks, or migrate to SHA-256 where applicable.

2. **Medium Severity: Insecure Deserialization (CWE-502 / B301)**
   - **Issue:** Using `pickle.load()` on a file.
   - **Location:** `resume_pipeline/rag/vector_store.py:366`
   - **Remediation:** Ensure files are trusted, or migrate to a safer format (e.g., JSON or safetensors).

3. **Medium Severity: Binding to All Interfaces (CWE-605 / B104)**
   - **Issue:** Hardcoded binding to `"0.0.0.0"`.
   - **Location:** `resume_pipeline/app.py:4226`
   - **Remediation:** Control this via environment config (e.g. settings).

4. **Medium Severity: XML Parsing Vulnerabilities (CWE-20 / B314)**
   - **Issue:** Using standard `xml.etree.ElementTree.fromstring` to parse DOCX contents.
   - **Location:** `resume_pipeline/resume/file_type_router.py:184`
   - **Remediation:** Replace with `defusedxml` to prevent XML Entity Expansion (XXE) attacks.

5. **Low Severity: False Positives & Best Practices**
   - **Hardcoded Passwords (B105):** Standard config metrics containing "budget" or "bearer" tokens flagged falsely as passwords.
   - **Silent Exceptions (B110):** `try-except-pass` blocks without logs.
   - **Weak Pseudo-random Generators (B311):** Using standard `random` for delay calculations and sampling.

---

## 2. Dependency Vulnerability Scan (npm audit)

`npm audit` was run on the React frontend project.
- **Path:** `D:\Career Guidence\frontend\`
- **Vulnerabilities Found:** 14 (6 moderate, 8 high)

### Detailed Dependencies & Risks
| Package | Vulnerability | Severity | Advisory link |
|---|---|---|---|
| `axios` | SSRF, Prototype Pollution, CRLF Injection, DoS | High | [GHSA-3p68-rc4w-qgx5](https://github.com/advisories/GHSA-3p68-rc4w-qgx5) |
| `@remix-run/router` | XSS via Open Redirects | High | [GHSA-2w69-qvjg-hvjx](https://github.com/advisories/GHSA-2w69-qvjg-hvjx) |
| `flatted` | DoS / Prototype Pollution | High | [GHSA-25h7-pfq9-p65f](https://github.com/advisories/GHSA-25h7-pfq9-p65f) |
| `minimatch` | Regular Expression DoS (ReDoS) | High | [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26) |
| `picomatch` | Method Injection & ReDoS | High | [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p) |
| `rollup` | Arbitrary File Write via Path Traversal | High | [GHSA-mw96-cpmx-2vgc](https://github.com/advisories/GHSA-mw96-cpmx-2vgc) |
| `ajv` | ReDoS via `$data` option | Moderate | [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) |
| `brace-expansion` | Process hang / memory exhaustion | Moderate | [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) |
| `esbuild` / `vite` | Dev Server response leak | Moderate | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) |
| `follow-redirects` | Auth header leak | Moderate | [GHSA-r4q5-vmmm-2653](https://github.com/advisories/GHSA-r4q5-vmmm-2653) |
| `postcss` | XSS via unescaped tags | Moderate | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) |

### Remediation Action Plan
- Run `npm audit fix` to address issues that do not require major version upgrades (e.g. minor updates to axios, picomatch, ajv).
- Run `npm audit fix --force` with caution to resolve rollup/vite/esbuild, which may introduce breaking changes.
