import json, time, requests, re
from typing import Optional, List
from ..config import settings
from ..core.interfaces import LLMClient
from .. import prompts

class GeminiLLMClient(LLMClient):
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.base_url = base_url or settings.GEMINI_API_URL

    def _mock_parse(self, model_name: str, payload: dict) -> dict:
        text = payload.get('doc_text') or ''
        ocr = payload.get('ocr_snippets') or {}
        email = None
        m = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text)
        if m:
            email = m.group(0)
        # very naive skills: include canonical terms found in text
        skills = []
        for sk in payload.get('canonical_skill_list', []):
            if sk.lower() in text.lower():
                skills.append({"name": sk, "canonical_id": None})
        resp = {
            "applicant_id": payload.get('applicant_id'),
            "personal": {"name": None, "email": email, "phone": None, "location": None},
            "education": [],
            "skills": skills,
            "ocr_snippets": ocr,
            "jee_rank": None,
            "llm_confidence": 0.9,
            "flags": [],
            "_provenance": {"model": model_name, "latency": 0.0, "mock": True}
        }
        return resp

    def call_parse(self, model_name: str, payload: dict, images: Optional[List[str]] = None, system_instruction: Optional[str] = None) -> dict:
        if settings.GEMINI_MOCK_MODE or (self.base_url and "example" in self.base_url):
            return self._mock_parse(model_name, payload)
        
        # Use real Google Gemini API
        start = time.time()
        
        # Build the prompt
        doc_text = payload.get('doc_text', '')
        schema = payload.get('instructions_schema', {})
        canonical_skills = payload.get('canonical_skill_list', [])
        applicant_id = payload.get('applicant_id', '')
        
        prompt = f"""You are a resume parser. Extract information from the following resume text and return ONLY valid JSON matching this schema.

Resume Text:
{doc_text}

Available Skills (use these canonical names when possible):
{', '.join(canonical_skills[:50])}

Return JSON with this structure:
{{
  "applicant_id": "{applicant_id}",
  "personal": {{
    "name": "Full name from resume",
    "email": "email@example.com",
    "phone": "phone number",
    "location": "City, State"
  }},
  "education": [
    {{
      "institution": "University/College name",
      "degree": "Degree name",
      "field": "Field of study",
      "start_date": "YYYY-MM",
      "end_date": "YYYY-MM",
      "grade": 8.5,
      "grade_scale": "10"
    }}
  ],
  "experience": [
    {{
      "company": "Company name",
      "title": "Job title",
      "start_date": "YYYY-MM",
      "end_date": "YYYY-MM or Present",
      "description": "Brief description"
    }}
  ],
  "skills": [
    {{"name": "skill1"}},
    {{"name": "skill2"}}
  ],
  "projects": [
    {{
      "name": "Project name",
      "description": "Brief description",
      "technologies": ["tech1", "tech2"],
      "url": "project URL or null",
      "start_date": "YYYY-MM",
      "end_date": "YYYY-MM or Present"
    }}
  ],
  "certifications": [
    {{
      "name": "Certification name",
      "issuer": "Issuing organization",
      "issue_date": "YYYY-MM",
      "expiry_date": "YYYY-MM or null",
      "credential_id": "ID or null",
      "url": "URL or null"
    }}
  ],
  "jee_rank": null,
  "llm_confidence": 0.9
}}

IMPORTANT: Extract ALL projects and certifications from the resume. Do not skip any sections.

Return ONLY the JSON object, no other text."""

        # Call Google Gemini API
        url = f"{self.base_url}/models/{model_name}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        body = {
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "topK": 1,
                "topP": 1,
                "maxOutputTokens": 8192,
                "responseMimeType": "application/json"
            }
        }
        
        try:
            r = requests.post(url, headers=headers, json=body, timeout=60)
            latency = time.time() - start
            
            if r.status_code != 200:
                print(f"Gemini API Error: {r.status_code} - {r.text}")
                return {"error": f"status {r.status_code}", "raw_text": r.text, "_provenance": {"model": model_name, "latency": latency, "mock": False}}
            
            result = r.json()
            
            # Extract the generated text from Gemini response
            if 'candidates' in result and len(result['candidates']) > 0:
                candidate = result['candidates'][0]
                if 'content' in candidate and 'parts' in candidate['content']:
                    generated_text = candidate['content']['parts'][0].get('text', '{}')
                    
                    # Parse the JSON response
                    try:
                        parsed_data = json.loads(generated_text)
                        
                        # Add provenance and missing fields
                        parsed_data['_provenance'] = {"model": model_name, "latency": latency, "mock": False}
                        parsed_data['flags'] = []
                        parsed_data['ocr_snippets'] = payload.get('ocr_snippets', {})
                        
                        # Ensure required fields exist
                        if 'applicant_id' not in parsed_data:
                            parsed_data['applicant_id'] = applicant_id
                        if 'personal' not in parsed_data:
                            parsed_data['personal'] = {"name": None, "email": None, "phone": None, "location": None}
                        if 'education' not in parsed_data:
                            parsed_data['education'] = []
                        if 'skills' not in parsed_data:
                            parsed_data['skills'] = []
                        if 'llm_confidence' not in parsed_data:
                            parsed_data['llm_confidence'] = 0.8
                        if 'jee_rank' not in parsed_data:
                            parsed_data['jee_rank'] = None
                        
                        return parsed_data
                    except json.JSONDecodeError as e:
                        print(f"Failed to parse Gemini JSON response: {e}")
                        print(f"Response text: {generated_text}")
                        return {"error": f"JSON parse error: {e}", "raw_text": generated_text, "_provenance": {"model": model_name, "latency": latency, "mock": False}}
            
            return {"error": "No valid response from Gemini", "raw_response": result, "_provenance": {"model": model_name, "latency": latency, "mock": False}}
        
        except Exception as e:
            latency = time.time() - start
            print(f"Exception calling Gemini API: {e}")
            return {"error": str(e), "_provenance": {"model": model_name, "latency": latency, "mock": False}}

    def call_rerank(self, model_name: str, payload: dict) -> dict:
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        body = {"model": model_name, "input": payload}
        r = requests.post(self.base_url + "/rerank", headers=headers, data=json.dumps(body), timeout=60)
        if r.status_code != 200:
            return {"error": f"status {r.status_code}", "raw_text": r.text}
        return r.json()

    # ============================================================
    # INTERVIEW & ASSESSMENT METHODS
    # ============================================================

    def generate_interview_questions(
        self, 
        applicant_skills: List[str], 
        focus_areas: Optional[List[str]], 
        difficulty: str, 
        session_type: str,
        previous_score: Optional[float] = None,
        mcq_count: int = 7,
        short_answer_count: int = 3
    ) -> dict:
        """
        Generate personalized interview questions based on applicant's resume skills.
        
        Args:
            applicant_skills: Skills extracted from resume
            focus_areas: Specific topics to focus on (e.g., ["DSA", "Python"])
            difficulty: "easy", "medium", or "hard"
            session_type: "technical", "hr", "behavioral", or "mixed"
            previous_score: If available, adjust difficulty based on past performance
            mcq_count: Number of MCQ questions (5-10)
            short_answer_count: Number of short answer questions (2-5)
        
        Returns:
            Dict with 'questions' array containing generated questions
        """
        # Adjust difficulty based on previous performance
        if previous_score and previous_score > 70:
            difficulty_levels = {"easy": "medium", "medium": "hard", "hard": "hard"}
            difficulty = difficulty_levels.get(difficulty, difficulty)
        
        focus_str = ', '.join(focus_areas) if focus_areas else ', '.join(applicant_skills[:5])
        
        prompt = f"""Generate {mcq_count + short_answer_count} interview questions for a candidate with these skills: {', '.join(applicant_skills)}.

Session Type: {session_type}
Difficulty: {difficulty}
Focus Areas: {focus_str}

Generate:
- {mcq_count} Multiple Choice Questions (MCQ) with 4 options each
- {short_answer_count} Short Answer/Theory questions (expecting 3-5 sentence answers)

Return ONLY valid JSON:
{{
  "questions": [
    {{
      "question_type": "mcq",
      "question_text": "Clear, specific question text",
      "difficulty": "{difficulty}",
      "category": "DSA|DBMS|OS|Python|Java|OOP|etc",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correct_answer": "Option A text",
      "skills_tested": ["skill1", "skill2"],
      "expected_answer_points": ["key point 1", "key point 2"],
      "max_score": 10.0
    }},
    {{
      "question_type": "short_answer",
      "question_text": "Clear question requiring 3-5 sentence explanation",
      "difficulty": "{difficulty}",
      "category": "DSA|DBMS|OS|Python|Java|OOP|etc",
      "expected_answer_points": ["key concept 1", "key concept 2", "example usage"],
      "skills_tested": ["skill1", "skill2"],
      "max_score": 10.0
    }}
  ]
}}

Make questions resume-specific and practical. For technical sessions, focus on {focus_str}. For HR/behavioral, ask situational questions."""

        url = f"{self.base_url}/models/{settings.GEMINI_LARGE_MODEL}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.7,  # Higher for diverse questions
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 4096,
                "responseMimeType": "application/json"
            }
        }
        
        try:
            r = requests.post(url, headers=headers, json=body, timeout=60)
            if r.status_code != 200:
                return {"error": f"Gemini API error: {r.status_code}", "questions": []}
            
            result = r.json()
            if 'candidates' in result and len(result['candidates']) > 0:
                generated_text = result['candidates'][0]['content']['parts'][0].get('text', '{}')
                return json.loads(generated_text)
            
            return {"error": "No valid response", "questions": []}
        except Exception as e:
            print(f"Error generating questions: {e}")
            return {"error": str(e), "questions": []}

    def evaluate_answer(
        self, 
        question_text: str, 
        question_type: str,
        candidate_answer: str, 
        correct_answer: Optional[str],
        expected_points: Optional[List[str]],
        max_score: float = 10.0
    ) -> dict:
        """
        Evaluate a candidate's answer using Gemini AI.
        
        Args:
            question_text: The interview question
            question_type: "mcq", "short_answer", etc.
            candidate_answer: User's submitted answer
            correct_answer: For MCQ - the correct option
            expected_points: Key points that should be covered
            max_score: Maximum score for this question
        
        Returns:
            Dict with score, is_correct, strengths, weaknesses, suggestions
        """
        if question_type == "mcq":
            # Simple comparison for MCQ
            is_correct = candidate_answer.strip().lower() == correct_answer.strip().lower()
            return {
                "score": max_score if is_correct else 0.0,
                "is_correct": is_correct,
                "strengths": ["Correct answer"] if is_correct else [],
                "weaknesses": ["Incorrect answer"] if not is_correct else [],
                "improvement_suggestions": None if is_correct else f"The correct answer is: {correct_answer}",
                "points_covered": expected_points if is_correct else [],
                "points_missed": [] if is_correct else expected_points
            }
        
        # For short answer/theory questions, use Gemini to evaluate
        expected_str = '\n- ' + '\n- '.join(expected_points) if expected_points else "N/A"
        
        prompt = f"""Evaluate this interview answer on a scale of 0-{max_score}.

Question: {question_text}

Expected Key Points:
{expected_str}

Candidate's Answer:
{candidate_answer}

Provide evaluation in JSON format:
{{
  "score": <number between 0 and {max_score}>,
  "is_correct": <true if score >= {max_score * 0.6} else false>,
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "improvement_suggestions": "Specific actionable feedback",
  "points_covered": ["key point 1", "key point 2"],
  "points_missed": ["missing point 1"]
}}

Be fair but strict. Award partial credit for partially correct answers."""

        url = f"{self.base_url}/models/{settings.GEMINI_LARGE_MODEL}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1024,
                "responseMimeType": "application/json"
            }
        }
        
        try:
            r = requests.post(url, headers=headers, json=body, timeout=30)
            if r.status_code != 200:
                # Fallback scoring
                return {
                    "score": max_score * 0.5,
                    "is_correct": False,
                    "strengths": ["Answer provided"],
                    "weaknesses": ["Unable to evaluate automatically"],
                    "improvement_suggestions": "Please review the expected key points.",
                    "points_covered": [],
                    "points_missed": expected_points or []
                }
            
            result = r.json()
            if 'candidates' in result and len(result['candidates']) > 0:
                generated_text = result['candidates'][0]['content']['parts'][0].get('text', '{}')
                evaluation = json.loads(generated_text)
                
                # Ensure score is within bounds
                evaluation['score'] = max(0.0, min(max_score, evaluation.get('score', 0.0)))
                
                return evaluation
            
            return {
                "score": max_score * 0.5,
                "is_correct": False,
                "strengths": [],
                "weaknesses": ["Evaluation unavailable"],
                "improvement_suggestions": None,
                "points_covered": [],
                "points_missed": expected_points or []
            }
        except Exception as e:
            print(f"Error evaluating answer: {e}")
            return {
                "score": max_score * 0.5,
                "is_correct": False,
                "strengths": [],
                "weaknesses": [f"Evaluation error: {str(e)}"],
                "improvement_suggestions": None,
                "points_covered": [],
                "points_missed": expected_points or []
            }

    def analyze_skill_gaps(
        self, 
        session_results: dict,
        applicant_skills: List[str]
    ) -> dict:
        """
        Analyze interview performance and generate skill gap analysis.
        
        Args:
            session_results: Dict with questions, answers, scores by category
            applicant_skills: Skills from resume
        
        Returns:
            Dict with skill_gaps, recommended_courses, projects, practice_problems
        """
        prompt = f"""Analyze this interview performance and provide skill gap analysis.

Applicant's Resume Skills: {', '.join(applicant_skills)}

Interview Results:
{json.dumps(session_results, indent=2)}

Provide analysis in JSON format:
{{
  "skill_gaps": {{
    "Python": "strong|moderate|weak",
    "DSA": "strong|moderate|weak",
    "DBMS": "weak"
  }},
  "overall_assessment": "Brief 2-3 sentence summary",
  "priority_skills": ["skill1", "skill2", "skill3"],
  "recommended_courses": [
    {{"title": "Course name", "provider": "Udemy/Coursera/YouTube", "focus": "What it teaches", "url_hint": "search term"}}
  ],
  "recommended_projects": [
    {{"title": "Project idea", "description": "What to build", "skills_practiced": ["skill1", "skill2"]}}
  ],
  "practice_problems": [
    {{"problem": "Specific coding/theory problem", "difficulty": "easy|medium|hard", "category": "DSA|DBMS|etc"}}
  ]
}}

Focus on the 3 weakest skills. Be specific and actionable."""

        url = f"{self.base_url}/models/{settings.GEMINI_LARGE_MODEL}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 2048,
                "responseMimeType": "application/json"
            }
        }
        
        try:
            r = requests.post(url, headers=headers, json=body, timeout=45)
            if r.status_code != 200:
                return {
                    "skill_gaps": {},
                    "overall_assessment": "Unable to analyze",
                    "priority_skills": [],
                    "recommended_courses": [],
                    "recommended_projects": [],
                    "practice_problems": []
                }
            
            result = r.json()
            if 'candidates' in result and len(result['candidates']) > 0:
                generated_text = result['candidates'][0]['content']['parts'][0].get('text', '{}')
                try:
                    return json.loads(generated_text)
                except json.JSONDecodeError as json_err:
                    print(f"JSON decode error in skill gap analysis: {json_err}")
                    print(f"Problematic JSON: {generated_text[:500]}...")
                    # Return fallback structure
                    return {
                        "skill_gaps": {},
                        "overall_assessment": "Unable to parse analysis results",
                        "priority_skills": [],
                        "recommended_courses": [],
                        "recommended_projects": [],
                        "practice_problems": []
                    }
            
            return {
                "skill_gaps": {},
                "overall_assessment": "Analysis unavailable",
                "priority_skills": [],
                "recommended_courses": [],
                "recommended_projects": [],
                "practice_problems": []
            }
        except Exception as e:
            print(f"Error analyzing skill gaps: {e}")
            return {
                "skill_gaps": {},
                "overall_assessment": f"Error: {str(e)}",
                "priority_skills": [],
                "recommended_courses": [],
                "recommended_projects": [],
                "practice_problems": []
            }
