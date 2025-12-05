"""
LLM Prompts for Resume Parsing and Interview System
All prompts are centralized here for easy maintenance and updates.
"""

# ============================================================
# RESUME PARSING PROMPTS
# ============================================================

RESUME_PARSE_PROMPT_TEMPLATE = """You are a resume parser. Extract information from the following resume text and return ONLY valid JSON matching this schema.

Resume Text:
{doc_text}

Available Skills (use these canonical names when possible):
{canonical_skills}

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

IMPORTANT: 
- Extract ALL projects and certifications from the resume. Do not skip any sections.
- Only extract information that is explicitly present in the resume text.
- Use null for missing fields.
- Return ONLY the JSON object, no other text."""


# ============================================================
# INTERVIEW QUESTION GENERATION PROMPTS
# ============================================================

INTERVIEW_QUESTIONS_PROMPT_TEMPLATE = """Generate {total_questions} interview questions for a candidate with these skills: {applicant_skills}.

Session Type: {session_type}
Difficulty: {difficulty}
Focus Areas: {focus_areas}

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

Make questions resume-specific and practical. For technical sessions, focus on {focus_areas}. For HR/behavioral, ask situational questions."""


# ============================================================
# INTERVIEW ANSWER EVALUATION PROMPTS
# ============================================================

ANSWER_EVALUATION_PROMPT_TEMPLATE = """Evaluate this interview answer on a scale of 0-{max_score}.

Question: {question_text}

Expected Key Points:
{expected_points}

Candidate's Answer:
{candidate_answer}

Provide evaluation in JSON format:
{{
  "score": <number between 0 and {max_score}>,
  "is_correct": <true if score >= {passing_score} else false>,
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "improvement_suggestions": "Specific actionable feedback",
  "points_covered": ["key point 1", "key point 2"],
  "points_missed": ["missing point 1"]
}}

Be fair but strict. Award partial credit for partially correct answers."""


# ============================================================
# SKILL GAP ANALYSIS PROMPTS
# ============================================================

SKILL_GAP_ANALYSIS_PROMPT_TEMPLATE = """Analyze this interview performance and provide skill gap analysis.

Applicant's Resume Skills: {applicant_skills}

Interview Results:
{session_results}

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
