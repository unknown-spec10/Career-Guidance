import json, time, requests, re
from typing import Optional, List
from ..config import settings
from ..core.interfaces import LLMClient
from ..core.llm_router import llm_router
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
        """Stub for legacy single-shot parsing. Decomposed prompts are preferred."""
        return self._mock_parse(model_name, payload)

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
        Generate MCQ interview questions using Gemini API.
        
        Args:
            applicant_skills: Skills extracted from resume
            focus_areas: Specific topics to focus on (e.g., ["DSA", "Python"])
            difficulty: "easy", "medium", or "hard"
            session_type: "technical", "hr", "behavioral", or "mixed"
            previous_score: If available, adjust difficulty based on past performance
            mcq_count: Number of MCQ questions to generate
            short_answer_count: Number of short answer questions (usually 0)
        
        Returns:
            Dict with 'questions' array containing generated MCQ questions
        """
        # Adjust difficulty based on previous performance
        if previous_score and previous_score > 70:
            difficulty_levels = {"easy": "medium", "medium": "hard", "hard": "hard"}
            difficulty = difficulty_levels.get(difficulty, difficulty)
        
        focus_str = ', '.join(focus_areas) if focus_areas else ', '.join(applicant_skills[:5])
        skills_str = ', '.join(applicant_skills[:10]) if applicant_skills else "Programming, Data Structures, Algorithms"
        
        prompt = f"""You are an expert technical interviewer. Generate exactly {mcq_count} multiple choice questions (MCQ) for a {session_type} interview.

TOPICS TO COVER: {focus_str}
CANDIDATE SKILLS: {skills_str}
DIFFICULTY LEVEL: {difficulty}

INSTRUCTIONS:
- Generate exactly {mcq_count} MCQ questions
- Each question must have exactly 4 options (A, B, C, D)
- One option must be the correct answer
- Questions should test practical knowledge, not just definitions
- Include code snippets or examples where relevant
- Mix conceptual and problem-solving questions

OUTPUT FORMAT - Return ONLY this JSON structure, nothing else:
{{
  "questions": [
    {{
      "question_type": "mcq",
      "question_text": "What is the time complexity of binary search?",
      "difficulty": "{difficulty}",
      "category": "DSA",
      "options": ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      "correct_answer": "O(log n)",
      "skills_tested": ["Algorithms", "Time Complexity"],
      "max_score": 10.0
    }},
    {{
      "question_type": "mcq", 
      "question_text": "Which data structure uses LIFO principle?",
      "difficulty": "{difficulty}",
      "category": "DSA",
      "options": ["Queue", "Stack", "Array", "Linked List"],
      "correct_answer": "Stack",
      "skills_tested": ["Data Structures"],
      "max_score": 10.0
    }}
  ]
}}

Generate {mcq_count} unique, challenging MCQ questions about {focus_str}. Return ONLY valid JSON."""

        messages = [{"role": "user", "content": prompt}]
        try:
            print(f"🔄 Calling LLMRouter for {mcq_count} MCQ questions...")
            res = llm_router.generate_chat_completion(
                messages=messages,
                provider="gemini",
                model_name=settings.GEMINI_INTERVIEW_MODEL,
                temperature=0.8,
                max_tokens=8192,
                response_format={"type": "json_object"},
                timeout=90
            )
            generated_text = res["content"]
            print(f"✅ LLMRouter response received, parsing JSON...")
            parsed = json.loads(generated_text)
            questions = parsed.get('questions', [])
            print(f"✅ Parsed {len(questions)} questions from LLMRouter")
            
            for i, q in enumerate(questions):
                print(f"  Question {i+1}: type={q.get('question_type')}, has_options={bool(q.get('options'))}, has_correct={bool(q.get('correct_answer'))}")
            
            return parsed
        except json.JSONDecodeError as e:
            print(f"❌ JSON parsing error: {e}")
            return {"error": f"Failed to parse LLMRouter response: {str(e)}", "questions": []}
        except Exception as e:
            print(f"❌ Error generating questions: {e}")
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

        messages = [{"role": "user", "content": prompt}]
        try:
            res = llm_router.generate_chat_completion(
                messages=messages,
                provider="gemini",
                model_name=settings.GEMINI_INTERVIEW_MODEL,
                temperature=0.2,
                max_tokens=1024,
                response_format={"type": "json_object"},
                timeout=30
            )
            evaluation = json.loads(res["content"])
            evaluation['score'] = max(0.0, min(max_score, evaluation.get('score', 0.0)))
            return evaluation
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

        messages = [{"role": "user", "content": prompt}]
        try:
            res = llm_router.generate_chat_completion(
                messages=messages,
                provider="gemini",
                model_name=settings.GEMINI_INTERVIEW_MODEL,
                temperature=0.3,
                max_tokens=2048,
                response_format={"type": "json_object"},
                timeout=45
            )
            return json.loads(res["content"])
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
