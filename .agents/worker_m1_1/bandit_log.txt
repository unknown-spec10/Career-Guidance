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
568	
569	@app.get("/api/auth/me", response_model=UserResponse)

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
923	

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
