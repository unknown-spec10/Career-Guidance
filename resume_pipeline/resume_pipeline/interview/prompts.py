"""
Interview System v2 — Groq Prompt Templates
All prompts used for question generation, evaluation, study plan, and hints.
"""

GROQ_MODEL = "llama-3.3-70b-versatile"

# ---------------------------------------------------------------------------
# System prompt — establishes the interviewer persona for conversation history
# ---------------------------------------------------------------------------
INTERVIEWER_SYSTEM_PROMPT = """You are an experienced technical interviewer at a top technology company.
You are conducting a mock interview for a candidate.

Candidate profile:
- Role: {target_role}
- Experience: {experience_years} years
- Skills: {skills}
- Projects: {projects}

Interview configuration:
- Type: {interview_type}
- Difficulty: {difficulty}
- Total questions: {num_questions}

Your behavior:
- Ask one question at a time
- Be professional but warm — like a real human interviewer
- Reference the candidate's background naturally when relevant
- Do not give away answers or over-hint
- Keep questions focused and clear
- Vary question types: conceptual, practical, scenario-based

Important: Generate questions that specifically test the skills listed
in the candidate's resume. Make the interview feel personalized.
"""

# ---------------------------------------------------------------------------
# Question generation — called once at session start
# ---------------------------------------------------------------------------
QUESTION_GENERATION_PROMPT = """Generate exactly {total_count} interview questions for this candidate.
The first {num_questions} are the main interview questions.
The remaining {reserve_count} are RESERVE questions used for adaptive difficulty (harder variants).

Candidate skills: {skills}
Target role: {target_role}
Experience level: {experience_years} years
Interview type: {interview_type}
Difficulty: {difficulty}
Topic focus (if any): {topic_focus}

{growth_context}

Rules:
- Each question must test a specific skill from the candidate's profile
- Distribute questions across different skills (do not repeat the same skill more than twice in the main set)
- Mix question types: conceptual explanation, practical scenario, problem-solving
- Main questions: match the specified difficulty
- Reserve questions: one difficulty level HARDER than specified (for adaptive difficulty)
- If topic_focus is provided, emphasize that topic for at least 40% of the questions

Respond ONLY with a valid JSON array. No preamble, no markdown, no explanation.
Format:
[
  {{
    "question_text": "...",
    "skill_tag": "React",
    "difficulty": "medium",
    "expected_keywords": ["hooks", "state", "lifecycle", "functional component"],
    "question_type": "conceptual",
    "is_reserve": false
  }},
  ...
]

For reserve questions, set "is_reserve": true and increase difficulty by one level.
"""

# ---------------------------------------------------------------------------
# Answer evaluation — called in background after each answer submission
# ---------------------------------------------------------------------------
EVALUATION_PROMPT = """Evaluate this interview answer.

Question: {question_text}
Skill being tested: {skill_tag}
Expected key concepts: {expected_keywords}
Candidate's answer: {answer_text}

Evaluate objectively. Consider:
- Accuracy of technical content
- Depth of understanding (not just surface-level)
- Clarity of explanation
- Coverage of key concepts

Respond ONLY with valid JSON. No preamble.
Format:
{{
  "score": 0.75,
  "feedback": "Good understanding of X. Missing discussion of Y and Z.",
  "strength": "Clear explanation of the core mechanism",
  "missing_concepts": ["concept1", "concept2"],
  "hint_for_next": null
}}

Score guide: 0.0-0.39=poor, 0.40-0.59=average, 0.60-0.79=good, 0.80-1.0=excellent
hint_for_next: populate ONLY if score < 0.40 and a gentle nudge would help bridge to the next question.
The hint should be 1-2 sentences max. Otherwise set to null.
"""

# ---------------------------------------------------------------------------
# Study plan — called once after all evaluations complete
# ---------------------------------------------------------------------------
STUDY_PLAN_PROMPT = """Generate a personalized 30-day study plan for a {experience_level} developer.
Target role: {target_role}

Current mock interview results:
- Current weak skills: {weak_skills}
- Gaps identified: {missing_concepts_summary}

{history_context}

For each weak skill, provide:
- Why it matters for their target role
- Specific resources (books, YouTube channels, practice sites — be specific with names)
- Concrete exercises to practice
- A realistic weekly breakdown

Format as a readable, motivating study guide. Be specific — not generic advice.
Reference real resources, real problem sets, real concepts to study.
Use markdown formatting with clear headings per skill and per week.
"""

# ---------------------------------------------------------------------------
# Mid-interview hint — streamed before next question on weak answer
# ---------------------------------------------------------------------------
HINT_PROMPT = """A candidate gave a weak answer in a mock interview. Write a brief, encouraging nudge
(1-2 sentences) that naturally transitions to the next question without revealing the answer.

The candidate struggled with: {skill_tag}
What they missed: {missing_concepts}

The hint should feel like a real interviewer saying: "Interesting take. Before we move on,
could you touch on [specific concept] specifically?" — natural, not condescending.

Respond with ONLY the hint text. No preamble, no labels, no JSON.
"""
