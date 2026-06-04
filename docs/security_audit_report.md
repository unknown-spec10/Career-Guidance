# Executive Summary

The Career Guidance System was subjected to a comprehensive security audit combining manual source code analysis and automated static application security testing (SAST). The objective of this audit was to identify security vulnerabilities, evaluate their impact on the system, and provide concrete remediation steps.

The audit analyzed both the backend (`resume_pipeline/` running FastAPI/Python 3.11) and the frontend (`frontend/` running React/Vite/JS).

### Summary of Key Findings

1. **Secrets Exposure (Critical)**: Production credentials and API keys (Gemini, Groq, OpenRouter, Google, YouTube, Gmail App Password, and PostgreSQL passwords) were found hardcoded in the `.env` configuration file tracked by version control.
2. **Broken Object-Level Authorization (High)**: Lack of ownership validation on critical backend endpoints (`/api/applicant/{applicant_id}` and `/api/parse/status/{applicant_id}`) allows any authenticated user to fetch other users' detailed resumes and parsing confidence scores.
3. **Insecure Deserialization (Medium)**: Use of Python's `pickle.load()` on FAISS vector store indexes introduces potential Remote Code Execution (RCE) vulnerabilities if indices are tampered with.
4. **Vulnerable Custom Rate Limiting (Medium)**: Custom rate limiters rely on in-memory `defaultdict` objects, which fail under multi-process application deployments (like Render) and are susceptible to memory exhaustion.
5. **Weak Frontend Cryptography & XSS Vectors (Low)**: Client-side obfuscation (`btoa` / `atob`) is labeled as "encrypted storage" but provides zero cryptographic security. Unsanitized rendering of markdown in `AskPage.jsx` presents XSS risks.
6. **Outdated/Vulnerable Dependencies (High/Moderate)**:
   - Python backend relies on weak MD5 hashes for key generation and contains insecure XML parsing via `ElementTree`.
   - Node.js frontend packages contain 14 vulnerabilities, including high-severity issues in `axios` (SSRF/Prototype Pollution), `@remix-run/router` (XSS via Open Redirects), and `rollup` (Arbitrary File Write).

---

# Vulnerability Details Table

| Severity | Location/File Path | Description | Impact | Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **Critical** | `D:\Career Guidence\.env` <br>(Lines 7, 14, 20, 22, 25, 28, 33, 67, 74-75) | Exposure of sensitive credentials (Gemini, Groq, OpenRouter, Google, YouTube API keys, Gmail SMTP credentials, PG_PASSWORD, JWT SECRET_KEY) in version-controlled repository configuration. | Unauthorized API access, financial charge escalation on AI credits, email-based spoofing/phishing, and complete database compromise. | Revoke and regenerate all exposed keys/secrets. Ensure `.env` is omitted from version control (`git rm --cached .env`). Inject credentials at runtime using environment variables managed by the hosting platform (e.g. Render env vars). |
| **High** | `D:\Career Guidence\resume_pipeline\resume_pipeline\app.py` <br>(Lines 1505-1547 & 1364-1414) | Broken Object-Level Authorization (BOLA/IDOR) on applicant profile and parsing status endpoints. Authenticated users can retrieve details for any applicant ID without ownership checks. | Malicious users can enumerate integer or UUID IDs to scrape personal details, grades, resume text, and emails of all registered candidates. | Implement owner validation check. Verify that `current_user.id` matches `applicant.user_id` or that the user has administrative/employer/college credentials before returning applicant records. |
| **High** | `D:\Career Guidence\resume_pipeline\resume_pipeline\app.py` (Line 3145) <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\core\google_search.py` (Line 28) <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\rag\document_processor.py` (Line 237) <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\rag\file_watcher.py` (Lines 125, 131) <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\rag\rag_service.py` (Lines 234, 244, 253, 486) <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\resume\skill_taxonomy_builder.py` (Line 31) | Use of weak MD5 hash function for generating cache keys, vector store IDs, file content hashes, and skill taxonomy cache keys. (Bandit Issue B324) | MD5 is prone to hash collision attacks. While used here primarily for non-security indexing/caching, standard security scanners mark it as a high-risk cryptographic vulnerability. | Replace MD5 with a secure hashing algorithm like SHA-256 (`hashlib.sha256()`). Alternatively, for non-security uses in Python 3.9+, pass `usedforsecurity=False` to `hashlib.md5()` to satisfy scanner rules. |
| **High** | Frontend Dependency: `axios` <br>(v1.6.7 in `frontend/package.json`) | Frontend dependency `axios` is vulnerable to several critical flaws including Server-Side Request Forgery (SSRF) via NO_PROXY bypass, prototype pollution leading to data exfiltration, CRLF Injection, and denial of service. | Attackers can compromise request integrity, inject headers, trigger server SSRF via redirects, or cause client-side application crashes. | Upgrade `axios` in `frontend/package.json` to `^1.7.4` (or latest `1.7.7+`) and run `npm install`. |
| **High** | Frontend Dependency: `@remix-run/router` / `react-router` / `react-router-dom` | React Router components are vulnerable to Cross-Site Scripting (XSS) via Open Redirects when parsing malicious parameters. | Attackers can construct links that execute arbitrary Javascript code in the user's browser context. | Upgrade `@remix-run/router` and all `react-router` dependencies to a version greater than `6.30.3` (e.g., v6.31.0 or newer). |
| **High** | Frontend Dependency: `flatted` | `flatted` (<=3.4.1) is vulnerable to unbounded recursion DoS in the parse revive phase and prototype pollution. | Execution of malicious payload during state restoration can crash the application or pollute prototypes. | Upgrade `flatted` to `>3.4.1`. |
| **High** | Frontend Dependency: `rollup` | `rollup` (4.0.0 - 4.58.0) is vulnerable to arbitrary file write via path traversal during build processes. | A malicious dependency or input could overwrite local development/build files. | Upgrade `rollup` to `>4.58.0`. |
| **High** | Frontend Dependency: `minimatch` & `picomatch` | `minimatch` (<=3.1.3) and `picomatch` (<=2.3.1 / 4.0.0 - 4.0.3) are vulnerable to Regular Expression Denial of Service (ReDoS) via repeated wildcards and method injection in POSIX character classes. | Attackers can send craft payloads causing catastrophic backtracking, hanging the process and exhausting server/client resources. | Upgrade `minimatch` to `>3.1.3` and `picomatch` to `>2.3.1` (or `>4.0.3`). |
| **Medium** | `D:\Career Guidence\resume_pipeline\resume_pipeline\app.py` <br>(Lines 142-164 & 4025-4046) | Custom rate limiters for general API and RAG query endpoints store client requests in local in-memory `defaultdict` structures. | In multi-process deployments (e.g., Gunicorn workers on Render), rate limits are not shared and can be bypassed. Additionally, untracked IP rotation can cause memory exhaustion (DDoS). | Migrate from in-memory dicts to a distributed cache/store (e.g., Redis) using standard libraries like `slowapi` or `fastapi-limiter`. |
| **Medium** | `D:\Career Guidence\resume_pipeline\resume_pipeline\rag\vector_store.py` <br>(Line 366) | Deserialization of vector store indices using standard Python `pickle.load`. (Bandit Issue B301) | If an attacker is able to write a crafted malicious pickle file to the server's FAISS storage directory, loading the index will execute arbitrary code (RCE). | Avoid using `pickle` for untrusted inputs. Use safer formats (like JSON) or verify index file signatures before loading. |
| **Medium** | `D:\Career Guidence\resume_pipeline\resume_pipeline\resume\file_type_router.py` <br>(Line 184) | Parsing of untrusted DOCX/XML files using the standard `xml.etree.ElementTree.fromstring` function. (Bandit Issue B314) | Prone to XML External Entity (XXE) injection attacks or Billion Laughs denial of service when processing uploaded candidate resumes. | Use `defusedxml` package (`defusedxml.ElementTree.fromstring`) to parse XML files securely and prevent external entity resolution. |
| **Medium** | `D:\Career Guidence\resume_pipeline\resume_pipeline\app.py` <br>(Line 4226) | Dev server configuration binds the FastAPI app to all interfaces (`host="0.0.0.0"`). (Bandit Issue B104) | Exposes the dev server to the external network, potentially allowing unauthorized access in shared/untrusted network environments. | Bind to local loopback (`127.0.0.1`) by default during development, and control binding via environment variables. |
| **Medium** | Frontend Dependency: `esbuild` / `vite` | Dev server vulnerabilities in `esbuild` and `vite` allow malicious websites to send requests to local development server and read responses. | Local development environment compromise. | Upgrade `esbuild` to `>0.24.2` and `vite` to `>6.4.1` (or latest). |
| **Medium** | Frontend Dependency: `ajv`, `brace-expansion`, `follow-redirects`, `postcss` | Outdated dependencies in frontend containing moderate vulnerabilities: Ajv (ReDoS), brace-expansion (process hang), follow-redirects (auth header leak), postcss (XSS via unescaped style). | Potential client/dev resource exhaustion, style-based XSS, or credential leakage over insecure redirects. | Run `npm audit fix` to apply safe upgrades for these packages. |
| **Low** | `D:\Career Guidence\frontend\src\utils\secureStorage.js` <br>(Lines 2-3, 11-29) | Insecure client-side obfuscation. Uses standard Base64 encoding (`btoa` / `atob`) to obfuscate token and user session data, advertised as "encrypted storage". | Provides no cryptographic security. Any malicious script or browser extension can decode stored data instantly. | Do not advertise Base64 as encryption. If encryption is required, use CryptoJS library (e.g., AES-256) with a dynamically derived key. |
| **Low** | `D:\Career Guidence\frontend\src\pages\AskPage.jsx` <br>(Lines 115, 188) | Missing output sanitization when rendering LLM responses via `<ReactMarkdown>`. | Potential cross-site scripting (XSS) if Gemini/LLM output contains malicious scripts or markdown links. | Wrap markdown output in sanitization blocks using `DOMPurify` or restrict allowed link protocols inside ReactMarkdown options. |
| **Low** | `D:\Career Guidence\resume_pipeline\resume_pipeline\app.py` <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\auth.py` <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\core\llm_router.py` <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\interview\learning_path_generator.py` <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\interview\router.py` <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\recommendation\aggregator.py` <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\recommendation\explainer.py` <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\resume\preprocessor.py` | Empty `except: pass` blocks swallow arbitrary exceptions. (Bandit Issue B110) | Suppressing exceptions hides underlying system or runtime bugs, hindering error debugging and tracing. | Replace bare `except` blocks with specific exception types and log warnings before continuing/passing. |
| **Low** | `D:\Career Guidence\resume_pipeline\resume_pipeline\interview\learning_path_generator.py` (Lines 78, 147) <br> `D:\Career Guidence\resume_pipeline\resume_pipeline\resume\skill_normalizer.py` (Lines 107, 121) | Use of standard pseudo-random generators (`random.sample()`, `random.uniform()`) for selection and retry jitter. (Bandit Issue B311) | Standard PRNGs are predictable. (However, in these contexts, they are used for retry delay jitter and question pool sampling, representing a negligible risk). | Use Python's `secrets` module if cryptographic uniqueness/unpredictability is required. |
| **Low** | `D:\Career Guidence\resume_pipeline\resume_pipeline\resume\preprocessor.py` <br>(Line 46) | Preprocessor starts a subprocess (`pdftotext`) with a partial executable path and executes without explicit input validation. (Bandit Issues B404, B603, B607) | Potential command injection or hijack if the system path is poisoned and the input is maliciously crafted. | Use full absolute paths to executables where possible, and strictly sanitize or validate file paths passed to external subprocesses. |

---

# Tool Scan Logs

Below are the raw outputs from executing the automated static analysis scans (Bandit for Python backend and npm audit for React frontend) in the local environment.

### Bandit Static Analysis Scan Output (Python Backend)

```text
Working... ---------------------------------------- 100% 0:00:02
Run started:2026-06-04 04:18:10.898912+00:00

Test results:
>> Issue: [B110:try_except_pass] Try, Except, Pass detected.
   Severity: Low   Confidence: High
   CWE: CWE-703 (https://cwe.mitre.org/data/definitions/703.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b110_try_except_pass.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\app.py:366:8
365	                    logger.warning(f"Failed to create ivfflat index on job_embeddings_cache: {e}")
366	        except Exception as e:
367	            # Under SQLite or if already altered, we safely ignore
368	            pass
369	        

--------------------------------------------------
>> Issue: [B105:hardcoded_password_string] Possible hardcoded password: 'bearer'
   Severity: Low   Confidence: Medium
   CWE: CWE-259 (https://cwe.mitre.org/data/definitions/259.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b105_hardcoded_password_string.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\app.py:558:8
557	        "access_token": access_token,
558	        "token_type": "bearer",
559	        "user": {
560	            "id": user.id,
561	            "email": user.email,
562	            "name": user.name,
563	            "role": user.role,
564	            "is_verified": user.is_verified
565	        }
566	    }
567	

@app.get("/api/auth/me", response_model=UserResponse)

--------------------------------------------------
>> Issue: [B110:try_except_pass] Try, Except, Pass detected.
   Severity: Low   Confidence: High
   CWE: CWE-703 (https://cwe.mitre.org/data/definitions/703.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b110_try_except_pass.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\app.py:1111:20
1110	                            created_str = val.isoformat()
1111	                    except:
1112	                        pass
1113	                return JSONResponse({

--------------------------------------------------
>> Issue: [B324:hashlib] Use of weak MD5 hash for security. Consider usedforsecurity=False
   Severity: High   Confidence: High
   CWE: CWE-327 (https://cwe.mitre.org/data/definitions/327.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b324_hashlib.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\app.py:3145:29
3144	    # Generate a mock vector store ID (in production, call actual vector store API)
3145	    vector_store_id = f"vec_{hashlib.md5(text_to_embed.encode()).hexdigest()[:16]}"
3146	    

--------------------------------------------------
>> Issue: [B104:hardcoded_bind_all_interfaces] Possible binding to all interfaces.
   Severity: Medium   Confidence: Medium
   CWE: CWE-605 (https://cwe.mitre.org/data/definitions/605.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b104_hardcoded_bind_all_interfaces.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\app.py:4226:13
4225	        "resume_pipeline.app:app",
4226	        host="0.0.0.0",
4227	        port=port,

--------------------------------------------------
>> Issue: [B110:try_except_pass] Try, Except, Pass detected.
   Severity: Low   Confidence: High
   CWE: CWE-703 (https://cwe.mitre.org/data/definitions/703.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b110_try_except_pass.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\auth.py:43:8
42	            db.close()
43	        except Exception:
44	            pass
45	

--------------------------------------------------
>> Issue: [B105:hardcoded_password_string] Possible hardcoded password: '5000'
   Severity: Low   Confidence: Medium
   CWE: CWE-259 (https://cwe.mitre.org/data/definitions/259.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b105_hardcoded_password_string.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\constants.py:186:4
185	    # Token budgets (for optimization)
186	    'FULL_MOCK_TOKEN_BUDGET': 5000,  # Target 5k tokens per full interview
187	    'MICRO_SESSION_TOKEN_BUDGET': 800,  # Target 800 tokens per micro-session
188	    'CODING_QUESTION_TOKEN_BUDGET': 500,  # Target 500 tokens per coding question
189	    'PROJECT_IDEA_TOKEN_BUDGET': 1000,  # Target 1k tokens per project idea
190	}
191	
192	# Interview Question Types
193	QUESTION_TYPES = ['mcq', 'short_answer', 'coding', 'theory', 'behavioral']
194	
195	# Interview Categories
196	INTERVIEW_CATEGORIES = [
197	    'DSA', 'Python', 'Java', 'JavaScript', 'C++', 
198	    'DBMS', 'SQL', 'OS', 'OOP', 'System Design',
199	    'Machine Learning', 'Data Structures', 'Algorithms',
200	    'Networking', 'Cloud Computing', 'DevOps'
201	]
202	
203	# Difficulty Levels
204	DIFFICULTY_LEVELS = ['easy', 'medium', 'hard']
205	
206	# Proficiency Mapping (based on assessment scores)
207	PROFICIENCY_MAPPING = {
208	    (0, 40): 'beginner',
209	    (40, 60): 'intermediate',
210	    (60, 80): 'advanced',
211	    (80, 100): 'expert'
212	}
213	
214	# Interview Score Multipliers for Recommendations
215	

--------------------------------------------------
>> Issue: [B105:hardcoded_password_string] Possible hardcoded password: '800'
   Severity: Low   Confidence: Medium
   CWE: CWE-259 (https://cwe.mitre.org/data/definitions/259.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b105_hardcoded_password_string.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\constants.py:187:4
186	    'FULL_MOCK_TOKEN_BUDGET': 5000,  # Target 5k tokens per full interview
187	    'MICRO_SESSION_TOKEN_BUDGET': 800,  # Target 800 tokens per micro-session
188	    'CODING_QUESTION_TOKEN_BUDGET': 500,  # Target 500 tokens per coding question
189	    'PROJECT_IDEA_TOKEN_BUDGET': 1000,  # Target 1k tokens per project idea
190	}
191	
192	# Interview Question Types
193	QUESTION_TYPES = ['mcq', 'short_answer', 'coding', 'theory', 'behavioral']
194	
195	# Interview Categories
196	INTERVIEW_CATEGORIES = [
197	    'DSA', 'Python', 'Java', 'JavaScript', 'C++', 
198	    'DBMS', 'SQL', 'OS', 'OOP', 'System Design',
199	    'Machine Learning', 'Data Structures', 'Algorithms',
200	    'Networking', 'Cloud Computing', 'DevOps'
201	]
202	
203	# Difficulty Levels
204	DIFFICULTY_LEVELS = ['easy', 'medium', 'hard']
205	
206	# Proficiency Mapping (based on assessment scores)
207	PROFICIENCY_MAPPING = {
208	    (0, 40): 'beginner',
209	    (40, 60): 'intermediate',
210	    (60, 80): 'advanced',
211	    (80, 100): 'expert'
212	}
213	
214	# Interview Score Multipliers for Recommendations
215	INTERVIEW_SCORE_MULTIPLIERS = {

--------------------------------------------------
>> Issue: [B105:hardcoded_password_string] Possible hardcoded password: '500'
   Severity: Low   Confidence: Medium
   CWE: CWE-259 (https://cwe.mitre.org/data/definitions/259.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b105_hardcoded_password_string.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\constants.py:188:4
187	    'MICRO_SESSION_TOKEN_BUDGET': 800,  # Target 800 tokens per micro-session
188	    'CODING_QUESTION_TOKEN_BUDGET': 500,  # Target 500 tokens per coding question
189	    'PROJECT_IDEA_TOKEN_BUDGET': 1000,  # Target 1k tokens per project idea
190	}
191	
192	# Interview Question Types
193	QUESTION_TYPES = ['mcq', 'short_answer', 'coding', 'theory', 'behavioral']
194	
195	# Interview Categories
196	INTERVIEW_CATEGORIES = [
197	    'DSA', 'Python', 'Java', 'JavaScript', 'C++', 
198	    'DBMS', 'SQL', 'OS', 'OOP', 'System Design',
199	    'Machine Learning', 'Data Structures', 'Algorithms',
200	    'Networking', 'Cloud Computing', 'DevOps'
201	]
202	
203	# Difficulty Levels
204	DIFFICULTY_LEVELS = ['easy', 'medium', 'hard']
205	
206	# Proficiency Mapping (based on assessment scores)
207	PROFICIENCY_MAPPING = {
208	    (0, 40): 'beginner',
209	    (40, 60): 'intermediate',
210	    (60, 80): 'advanced',
211	    (80, 100): 'expert'
212	}
213	
214	# Interview Score Multipliers for Recommendations
215	INTERVIEW_SCORE_MULTIPLIERS = {
216	    'excellent': 1.0,  # >= 80: Full 15 points

--------------------------------------------------
>> Issue: [B105:hardcoded_password_string] Possible hardcoded password: '1000'
   Severity: Low   Confidence: Medium
   CWE: CWE-259 (https://cwe.mitre.org/data/definitions/259.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b105_hardcoded_password_string.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\constants.py:189:4
188	    'CODING_QUESTION_TOKEN_BUDGET': 500,  # Target 500 tokens per coding question
189	    'PROJECT_IDEA_TOKEN_BUDGET': 1000,  # Target 1k tokens per project idea
190	}
191	
192	# Interview Question Types
193	QUESTION_TYPES = ['mcq', 'short_answer', 'coding', 'theory', 'behavioral']
194	
195	# Interview Categories
196	INTERVIEW_CATEGORIES = [
197	    'DSA', 'Python', 'Java', 'JavaScript', 'C++', 
198	    'DBMS', 'SQL', 'OS', 'OOP', 'System Design',
199	    'Machine Learning', 'Data Structures', 'Algorithms',
200	    'Networking', 'Cloud Computing', 'DevOps'
201	]
202	
203	# Difficulty Levels
204	DIFFICULTY_LEVELS = ['easy', 'medium', 'hard']
205	
206	# Proficiency Mapping (based on assessment scores)
207	PROFICIENCY_MAPPING = {
208	    (0, 40): 'beginner',
209	    (40, 60): 'intermediate',
210	    (60, 80): 'advanced',
211	    (80, 100): 'expert'
212	}
213	
214	# Interview Score Multipliers for Recommendations
215	INTERVIEW_SCORE_MULTIPLIERS = {
216	    'excellent': 1.0,  # >= 80: Full 15 points
217	    'good': 0.67,  # 60-79: 10 points

--------------------------------------------------
>> Issue: [B324:hashlib] Use of weak MD5 hash for security. Consider usedforsecurity=False
   Severity: High   Confidence: High
   CWE: CWE-327 (https://cwe.mitre.org/data/definitions/327.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b324_hashlib.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\core\google_search.py:28:15
27	        """Generate cache key from query"""
28	        return hashlib.md5(query.encode()).hexdigest()
29	    

--------------------------------------------------
>> Issue: [B110:try_except_pass] Try, Except, Pass detected.
   Severity: Low   Confidence: High
   CWE: CWE-703 (https://cwe.mitre.org/data/definitions/703.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b110_try_except_pass.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\core\llm_router.py:921:24
920	                                yield delta
921	                        except Exception:
922	                            pass

--------------------------------------------------
>> Issue: [B105:hardcoded_password_string] Possible hardcoded password: 'Great news ΓÇö no significant weak areas identified! Keep practicing consistently to maintain your strengths.'
   Severity: Low   Confidence: Medium
   CWE: CWE-259 (https://cwe.mitre.org/data/definitions/259.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b105_hardcoded_password_string.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\interview\evaluator.py:259:35
258	    if not weak_skills:
259	        yield f"data: {json.dumps({'token': 'Great news ΓÇö no significant weak areas identified! Keep practicing consistently to maintain your strengths.'})}\n\n"
260	        yield "data: [DONE]\n\n"

--------------------------------------------------
>> Issue: [B311:blacklist] Standard pseudo-random generators are not suitable for security/cryptographic purposes.
   Severity: Low   Confidence: High
   CWE: CWE-330 (https://cwe.mitre.org/data/definitions/330.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/blacklists/blacklist_calls.html#b311-random
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\interview\learning_path_generator.py:78:11
77	        
78	    return random.sample(pool, min(len(pool), 3))
79	

--------------------------------------------------
>> Issue: [B311:blacklist] Standard pseudo-random generators are not suitable for security/cryptographic purposes.
   Severity: Low   Confidence: High
   CWE: CWE-330 (https://cwe.mitre.org/data/definitions/330.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/blacklists/blacklist_calls.html#b311-random
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\interview\learning_path_generator.py:147:24
146	            # Select up to 2 questions randomly for this skill
147	            selection = random.sample(candidates, min(len(candidates), 2))
148	            for p in selection:

--------------------------------------------------
>> Issue: [B110:try_except_pass] Try, Except, Pass detected.
   Severity: Low   Confidence: High
   CWE: CWE-703 (https://cwe.mitre.org/data/definitions/703.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b110_try_except_pass.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\interview\learning_path_generator.py:366:8
365	                score += 0.5
366	        except Exception:
367	            pass
368	            

--------------------------------------------------
>> Issue: [B110:try_except_pass] Try, Except, Pass detected.
   Severity: Low   Confidence: High
   CWE: CWE-703 (https://cwe.mitre.org/data/definitions/703.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b110_try_except_pass.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\interview\router.py:496:12
495	                    accumulated_tokens.append(token)
496	            except Exception:
497	                pass
498	                

--------------------------------------------------
>> Issue: [B110:try_except_pass] Try, Except, Pass detected.
   Severity: Low   Confidence: High
   CWE: CWE-703 (https://cwe.mitre.org/data/definitions/703.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b110_try_except_pass.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\interview\router.py:1125:16
1124	                        continue
1125	                except Exception:
1126	                    pass
1127	        active_paths.append(p)

--------------------------------------------------
>> Issue: [B324:hashlib] Use of weak MD5 hash for security. Consider usedforsecurity=False
   Severity: High   Confidence: High
   CWE: CWE-327 (https://cwe.mitre.org/data/definitions/327.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b324_hashlib.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\rag\document_processor.py:237:15
236	        content = f"{source_file}:{section}:{index}"
237	        return hashlib.md5(content.encode()).hexdigest()[:12]
238	    

--------------------------------------------------
>> Issue: [B324:hashlib] Use of weak MD5 hash for security. Consider usedforsecurity=False
   Severity: High   Confidence: High
   CWE: CWE-327 (https://cwe.mitre.org/data/definitions/327.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b324_hashlib.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\rag\file_watcher.py:125:23
124	                content = f.read()
125	                return hashlib.md5(content).hexdigest()
126	        except (IOError, OSError) as e:

--------------------------------------------------
>> Issue: [B324:hashlib] Use of weak MD5 hash for security. Consider usedforsecurity=False
   Severity: High   Confidence: High
   CWE: CWE-327 (https://cwe.mitre.org/data/definitions/327.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b324_hashlib.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\rag\file_watcher.py:131:23
130	                mtime = file_path.stat().st_mtime
131	                return hashlib.md5(str(mtime).encode()).hexdigest()
132	            except Exception as e2:

--------------------------------------------------
>> Issue: [B324:hashlib] Use of weak MD5 hash for security. Consider usedforsecurity=False
   Severity: High   Confidence: High
   CWE: CWE-327 (https://cwe.mitre.org/data/definitions/327.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b324_hashlib.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\rag\rag_service.py:234:17
233	        """
234	        hasher = hashlib.md5()
235	        docs_path = Path(self.docs_path)

--------------------------------------------------
>> Issue: [B324:hashlib] Use of weak MD5 hash for security. Consider usedforsecurity=False
   Severity: High   Confidence: High
   CWE: CWE-327 (https://cwe.mitre.org/data/definitions/327.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b324_hashlib.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\rag\rag_service.py:244:39
243	                        content = f.read()
244	                        content_hash = hashlib.md5(content).hexdigest()
245	                        file_hashes[md_file.name] = content_hash

--------------------------------------------------
>> Issue: [B324:hashlib] Use of weak MD5 hash for security. Consider usedforsecurity=False
   Severity: High   Confidence: High
   CWE: CWE-327 (https://cwe.mitre.org/data/definitions/327.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b324_hashlib.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\rag\rag_service.py:253:37
252	                        mtime = md_file.stat().st_mtime
253	                        mtime_hash = hashlib.md5(str(mtime).encode()).hexdigest()
254	                        file_hashes[md_file.name] = mtime_hash

--------------------------------------------------
>> Issue: [B324:hashlib] Use of weak MD5 hash for security. Consider usedforsecurity=False
   Severity: High   Confidence: High
   CWE: CWE-327 (https://cwe.mitre.org/data/definitions/327.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b324_hashlib.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\rag\rag_service.py:486:15
485	        """Generate cache key for a query"""
486	        return hashlib.md5(query.lower().strip().encode()).hexdigest()
487	    

--------------------------------------------------
>> Issue: [B403:blacklist] Consider possible security implications associated with pickle module.
   Severity: Low   Confidence: High
   CWE: CWE-502 (https://cwe.mitre.org/data/definitions/502.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/blacklists/blacklist_imports.html#b403-import-pickle
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\rag\vector_store.py:15:0
14	import logging
15	import pickle
16	from pathlib import Path

--------------------------------------------------
>> Issue: [B301:blacklist] Pickle and modules that wrap it can be unsafe when used to deserialize untrusted data, possible security issue.
   Severity: Medium   Confidence: High
   CWE: CWE-502 (https://cwe.mitre.org/data/definitions/502.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/blacklists/blacklist_calls.html#b301-pickle
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\rag\vector_store.py:366:23
365	            with open(load_path, 'rb') as f:
366	                data = pickle.load(f)
367	            

--------------------------------------------------
>> Issue: [B110:try_except_pass] Try, Except, Pass detected.
   Severity: Low   Confidence: High
   CWE: CWE-703 (https://cwe.mitre.org/data/definitions/703.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b110_try_except_pass.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\recommendation\aggregator.py:59:8
58	            return 0.5  # Has education, but doesn't meet minimum CGPA
59	        except Exception:
60	            pass
61	    return 0.8

--------------------------------------------------
>> Issue: [B110:try_except_pass] Try, Except, Pass detected.
   Severity: Low   Confidence: High
   CWE: CWE-703 (https://cwe.mitre.org/data/definitions/703.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b110_try_except_pass.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\recommendation\explainer.py:221:16
220	                        missing.append(skill_name)
221	                except Exception:
222	                    # Per-skill embed failure ΓåÆ fall through to string match for this skill
223	                    pass
224	

--------------------------------------------------
>> Issue: [B110:try_except_pass] Try, Except, Pass detected.
   Severity: Low   Confidence: High
   CWE: CWE-703 (https://cwe.mitre.org/data/definitions/703.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b110_try_except_pass.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\recommendation\explainer.py:374:8
373	                return parsed
374	        except Exception:
375	            pass
376	        return None

--------------------------------------------------
>> Issue: [B405:blacklist] Using xml.etree.ElementTree to parse untrusted XML data is known to be vulnerable to XML attacks. Replace xml.etree.ElementTree with the equivalent defusedxml package, or make sure defusedxml.defuse_stdlib() is called.
   Severity: Low   Confidence: High
   CWE: CWE-20 (https://cwe.mitre.org/data/definitions/20.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/blacklists/blacklist_imports.html#b405-import-xml-etree
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\resume\file_type_router.py:28:0
27	import zipfile
28	import xml.etree.ElementTree as ET
29	from enum import Enum

--------------------------------------------------
>> Issue: [B314:blacklist] Using xml.etree.ElementTree.fromstring to parse untrusted XML data is known to be vulnerable to XML attacks. Replace xml.etree.ElementTree.fromstring with its defusedxml equivalent function or make sure defusedxml.defuse_stdlib() is called
   Severity: Medium   Confidence: High
   CWE: CWE-20 (https://cwe.mitre.org/data/definitions/20.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/blacklists/blacklist_calls.html#b313-b320-xml-bad-elementtree
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\resume\file_type_router.py:184:15
183	            xml_bytes = zf.read("word/document.xml")
184	        root = ET.fromstring(xml_bytes)
185	        texts = [node.text for node in root.iter() if node.tag.endswith("}t") and node.text]

--------------------------------------------------
>> Issue: [B404:blacklist] Consider possible security implications associated with the subprocess module.
   Severity: Low   Confidence: High
   CWE: CWE-78 (https://cwe.mitre.org/data/definitions/78.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/blacklists/blacklist_imports.html#b404-import-subprocess
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\resume\preprocessor.py:1:0
1	import subprocess, re
2	from pathlib import Path
3	from typing import Dict

--------------------------------------------------
>> Issue: [B110:try_except_pass] Try, Except, Pass detected.
   Severity: Low   Confidence: High
   CWE: CWE-703 (https://cwe.mitre.org/data/definitions/703.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b110_try_except_pass.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\resume\preprocessor.py:35:8
34	                    return text
35	        except Exception:
36	            pass
37	        # 2) Fallback to pdfminer.six

--------------------------------------------------
>> Issue: [B110:try_except_pass] Try, Except, Pass detected.
   Severity: Low   Confidence: High
   CWE: CWE-703 (https://cwe.mitre.org/data/definitions/703.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b110_try_except_pass.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\resume\preprocessor.py:42:8
41	                return text
42	        except Exception:
43	            pass
44	        # 3) Fallback to system pdftotext if available

--------------------------------------------------
>> Issue: [B607:start_process_with_partial_path] Starting a process with a partial executable path
   Severity: Low   Confidence: High
   CWE: CWE-78 (https://cwe.mitre.org/data/definitions/78.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b607_start_process_with_partial_path.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\resume\preprocessor.py:46:18
45	        try:
46	            out = subprocess.check_output(["pdftotext", path, "-"])
47	            return out.decode("utf-8", errors="ignore")

--------------------------------------------------
>> Issue: [B603:subprocess_without_shell_equals_true] subprocess call - check for execution of untrusted input.
   Severity: Low   Confidence: High
   CWE: CWE-78 (https://cwe.mitre.org/data/definitions/78.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b603_subprocess_without_shell_equals_true.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\resume\preprocessor.py:46:18
45	        try:
46	            out = subprocess.check_output(["pdftotext", path, "-"])
47	            return out.decode("utf-8", errors="ignore")

--------------------------------------------------
>> Issue: [B110:try_except_pass] Try, Except, Pass detected.
   Severity: Low   Confidence: High
   CWE: CWE-703 (https://cwe.mitre.org/data/definitions/703.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b110_try_except_pass.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\resume\preprocessor.py:83:12
82	                tmp.unlink(missing_ok=True)
83	            except Exception:
84	                pass
85	        return ocr_text

--------------------------------------------------
>> Issue: [B311:blacklist] Standard pseudo-random generators are not suitable for security/cryptographic purposes.
   Severity: Low   Confidence: High
   CWE: CWE-330 (https://cwe.mitre.org/data/definitions/330.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/blacklists/blacklist_calls.html#b311-random
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\resume\skill_normalizer.py:107:54
106	
107	                delay = base_delay * (2 ** attempt) + random.uniform(0.1, 0.5)
108	                logger.warning(

--------------------------------------------------
>> Issue: [B311:blacklist] Standard pseudo-random generators are not suitable for security/cryptographic purposes.
   Severity: Low   Confidence: High
   CWE: CWE-330 (https://cwe.mitre.org/data/definitions/330.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/blacklists/blacklist_calls.html#b311-random
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\resume\skill_normalizer.py:121:50
120	                return [None] * len(skill_names)
121	            delay = base_delay * (2 ** attempt) + random.uniform(0.1, 0.5)
122	            logger.warning(f"SkillNormalizer: embedding API failed: {e}. Retrying in {delay:.2f}s...")

--------------------------------------------------
>> Issue: [B324:hashlib] Use of weak MD5 hash for security. Consider usedforsecurity=False
   Severity: High   Confidence: High
   CWE: CWE-327 (https://cwe.mitre.org/data/definitions/327.html)
   More Info: https://bandit.readthedocs.io/en/1.9.4/plugins/b324_hashlib.html
   Location: D:\Career Guidence\resume_pipeline\resume_pipeline\resume\skill_taxonomy_builder.py:31:20
30	        # Check cache first
31	        cache_key = hashlib.md5(skill.lower().encode()).hexdigest()
32	        if cache_key in self.cache:

--------------------------------------------------

Code scanned:
	Total lines of code: 17081
	Total lines skipped (#nosec): 0
	Total potential issues skipped due to specifically being disabled (e.g., #nosec BXXX): 0

Run metrics:
	Total issues (by severity):
		Undefined: 0
		Low: 28
		Medium: 3
		High: 10
	Total issues (by confidence):
		Undefined: 0
		Low: 0
		Medium: 7
		High: 34
Files skipped (0):
```

### npm audit Static Dependency Scan Output (React Frontend)

```text
# npm audit report

@remix-run/router  <=1.23.1
Severity: high
React Router vulnerable to XSS via Open Redirects - https://github.com/advisories/GHSA-2w69-qvjg-hvjx
fix available via `npm audit fix`
node_modules/@remix-run/router
  react-router  6.4.0-pre.0 - 6.30.3
  Depends on vulnerable versions of @remix-run/router
  node_modules/react-router
    react-router-dom  6.4.1-pre.0 - 6.30.3
    Depends on vulnerable versions of @remix-run/router
    Depends on vulnerable versions of react-router
    node_modules/react-router-dom

ajv  <6.14.0
Severity: moderate
ajv has ReDoS when using `$data` option - https://github.com/advisories/GHSA-2g4f-4pwh-qvx6
fix available via `npm audit fix`
node_modules/ajv

axios  1.0.0 - 1.15.2
Severity: high
Axios has a NO_PROXY Hostname Normalization Bypass that Leads to SSRF - https://github.com/advisories/GHSA-3p68-rc4w-qgx5
Axios: Authentication Bypass via Prototype Pollution Gadget in `validateStatus` Merge Strategy - https://github.com/advisories/GHSA-w9j2-pvgh-6h63
Axios: Incomplete Fix for CVE-2025-62718 — NO_PROXY Protection Bypassed via RFC 1122 Loopback Subnet (127.0.0.0/8) in Axios 1.15.0 - https://github.com/advisories/GHSA-pmwg-cvhr-8vh7
Axios: Invisible JSON Response Tampering via Prototype Pollution Gadget in `parseReviver` - https://github.com/advisories/GHSA-3w6x-2g7m-8v23
Axios: Null Byte Injection via Reverse-Encoding in AxiosURLSearchParams - https://github.com/advisories/GHSA-xhjh-pmcv-23jw
Axios: CRLF Injection in multipart/form-data body via unsanitized blob.type in formDataToStream - https://github.com/advisories/GHSA-445q-vr5w-6q77
Axios: no_proxy bypass via IP alias allows SSRF - https://github.com/advisories/GHSA-m7pr-hjqh-92cm
Axios: unbounded recursion in toFormData causes DoS via deeply nested request data - https://github.com/advisories/GHSA-62hf-57xw-28j9
Axios' HTTP adapter-streamed uploads bypass maxBodyLength when maxRedirects: 0 - https://github.com/advisories/GHSA-5c9x-8gcm-mpgx
Axios: HTTP adapter streamed responses bypass maxContentLength - https://github.com/advisories/GHSA-vf2m-468p-8v99
Axios: Prototype Pollution Gadgets - Response Tampering, Data Exfiltration, and Request Hijacking - https://github.com/advisories/GHSA-pf86-5x62-jrwf
Axios: Header Injection via Prototype Pollution - https://github.com/advisories/GHSA-6chq-wfr3-2hj9
Axios: XSRF Token Cross-Origin Leakage via Prototype Pollution Gadget in `withXSRFToken` Boolean Coercion - https://github.com/advisories/GHSA-xx6v-rp6x-q39c
Axios is Vulnerable to Denial of Service via __proto__ Key in mergeConfig - https://github.com/advisories/GHSA-43fc-jf86-j433
Axios has prototype pollution read-side gadgets in HTTP adapter that allow credential injection and request hijacking - https://github.com/advisories/GHSA-q8qp-cvcw-x6jj
Axios has Unrestricted Cloud Metadata Exfiltration via Header Injection Chain - https://github.com/advisories/GHSA-fvcv-3m26-pcqx
axios's shouldBypassProxy does not recognize IPv4-mapped IPv6 addresses, allowing NO_PROXY bypass (incomplete fix for CVE-2025-62718) - https://github.com/advisories/GHSA-pjwm-pj3p-43mv
axios has DoS & Header Injection via Prototype Pollution Read-Side Gadgets in axios merge functions - https://github.com/advisories/GHSA-898c-q2cr-xwhg
axios Vulnerable to Credential Theft and Response Hijacking via Prototype Pollution Gadget in Config Merge - https://github.com/advisories/GHSA-3g43-6gmg-66jw
axios Vulnerable to Full Man-in-the-Middle via Prototype Pollution Gadget in `config.proxy` - https://github.com/advisories/GHSA-35jp-ww65-95wh
fix available via `npm audit fix`
node_modules/axios

brace-expansion  <1.1.13
Severity: moderate
brace-expansion: Zero-step sequence causes process hang and memory exhaustion - https://github.com/advisories/GHSA-f886-m6hf-6m8v
fix available via `npm audit fix`
node_modules/brace-expansion

esbuild  <=0.24.2
Severity: moderate
esbuild enables any website to send any requests to the development server and read the response - https://github.com/advisories/GHSA-67mh-4wv8-2f99
fix available via `npm audit fix --force`
Will install vite@8.0.16, which is a breaking change
node_modules/esbuild
  vite  <=6.4.1
  Depends on vulnerable versions of esbuild
  node_modules/vite

flatted  <=3.4.1
Severity: high
flatted vulnerable to unbounded recursion DoS in parse() revive phase - https://github.com/advisories/GHSA-25h7-pfq9-p65f
Prototype Pollution via parse() in NodeJS flatted - https://github.com/advisories/GHSA-rf6f-7fwh-wjgh
fix available via `npm audit fix`
node_modules/flatted

follow-redirects  <=1.15.11
Severity: moderate
follow-redirects leaks Custom Authentication Headers to Cross-Domain Redirect Targets - https://github.com/advisories/GHSA-r4q5-vmmm-2653
fix available via `npm audit fix`
node_modules/follow-redirects

minimatch  <=3.1.3
Severity: high
minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern - https://github.com/advisories/GHSA-3ppc-4f35-3m26
minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments - https://github.com/advisories/GHSA-7r86-cg39-jmmj
minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions - https://github.com/advisories/GHSA-23c5-xmqv-rm74
fix available via `npm audit fix`
node_modules/minimatch

picomatch  <=2.3.1 || 4.0.0 - 4.0.3
Severity: high
Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching - https://github.com/advisories/GHSA-3v7f-55p6-f55p
Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching - https://github.com/advisories/GHSA-3v7f-55p6-f55p
Picomatch has a ReDoS vulnerability via extglob quantifiers - https://github.com/advisories/GHSA-c2c7-rcm5-vvqj
Picomatch has a ReDoS vulnerability via extglob quantifiers - https://github.com/advisories/GHSA-c2c7-rcm5-vvqj
fix available via `npm audit fix`
node_modules/picomatch
node_modules/tinyglobby/node_modules/picomatch

postcss  <8.5.10
Severity: moderate
PostCSS has XSS via Unescaped </style> in its CSS Stringify Output - https://github.com/advisories/GHSA-qx2v-qp2m-jg93
fix available via `npm audit fix`
node_modules/postcss

rollup  4.0.0 - 4.58.0
Severity: high
Rollup 4 has Arbitrary File Write via Path Traversal - https://github.com/advisories/GHSA-mw96-cpmx-2vgc
fix available via `npm audit fix`
node_modules/rollup

14 vulnerabilities (6 moderate, 8 high)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force
```
