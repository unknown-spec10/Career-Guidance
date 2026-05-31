import logging
from google import genai
from groq import Groq
from ..config import settings

logger = logging.getLogger(__name__)


def build_explanation_prompt(applicant, job, breakdown) -> str:
    """Build the prompt for explanation generation."""
    # Extract candidate skills
    candidate_skills = []
    if applicant.parsed_record and applicant.parsed_record.normalized:
        skills = applicant.parsed_record.normalized.get("skills", [])
        for s in skills:
            name = s.get("name", "") if isinstance(s, dict) else str(s)
            if name:
                candidate_skills.append(name)
    candidate_skills_str = ", ".join(list(dict.fromkeys(candidate_skills))[:20])

    # Extract job required skills
    job_skills = []
    for s in job.required_skills or []:
        name = s.get("name", "") if isinstance(s, dict) else str(s)
        if name:
            job_skills.append(name)
    job_skills_str = ", ".join(list(dict.fromkeys(job_skills))[:20])

    # Experience details
    exp_years = job.min_experience_years if job.min_experience_years is not None else 0

    prompt = f"""You are a career advisor. Given a score breakdown of how well a candidate matches a job, write a 2-sentence explanation in plain English.
Be specific about strengths and one gap if any. Do not mention specific scores, weights, or percentages.

Candidate profile:
- Skills: {candidate_skills_str or 'None listed'}

Job posting:
- Title: {job.title}
- Required Skills: {job_skills_str or 'None listed'}
- Min Experience Required: {exp_years} years

Score breakdown:
- Technical Skills Fit: {breakdown.get('skills_score', 0.0)}
- Experience Fit: {breakdown.get('experience_score', 0.0)}
- Location Fit: {breakdown.get('location_score', 0.0)}

Speak directly to the candidate using "your" and "you". Write exactly 1 or 2 concise, encouraging sentences.
"""
    return prompt


def generate_explanation(applicant, job, breakdown) -> tuple[str | None, str | None]:
    """Generate a recommendation explanation using primary Gemini or secondary Groq.
    
    Returns:
        (explanation_string, source_flag)
        source_flag can be: 'gemini', 'groq_fallback', or None
    """
    prompt = build_explanation_prompt(applicant, job, breakdown)

    # 1. Primary: Gemini 2.5 Flash (via new google-genai client)
    gemini_key = settings.GEMINI_API_KEY
    if gemini_key:
        try:
            client = genai.Client(api_key=gemini_key)
            model_name = settings.GEMINI_INTERVIEW_MODEL or "gemini-2.5-flash"
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            if response.text:
                explanation = response.text.strip().strip('"')
                logger.info(f"Generated explanation via Gemini (model={model_name})")
                return explanation, "gemini"
        except Exception as e:
            logger.warning(f"Primary Gemini explanation failed, trying Groq fallback: {e}")

    # 2. Secondary: Groq LLaMA 3
    groq_key = settings.GROQ_API_KEY
    if groq_key:
        try:
            groq_client = Groq(api_key=groq_key)
            model_name = settings.GROQ_CHAT_MODEL or "llama-3.3-70b-versatile"
            response = groq_client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=150,
                temperature=0.7
            )
            if response.choices and response.choices[0].message.content:
                explanation = response.choices[0].message.content.strip().strip('"')
                logger.info(f"Generated explanation via Groq fallback (model={model_name})")
                return explanation, "groq_fallback"
        except Exception as e:
            logger.warning(f"Secondary Groq fallback explanation failed: {e}")

    # 3. Terminal: Store null, to be retried later
    logger.error("All explainer APIs failed. Storing null explanation.")
    return None, None
