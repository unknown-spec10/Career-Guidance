import logging
import json
from google import genai
from groq import Groq
from ..config import settings

logger = logging.getLogger(__name__)


def optimize_job_description(prompt_text: str, title: str = None) -> dict:
    """Expand a brief job draft into a structured, SEO-friendly job description and extract skills.
    
    Returns a dict matching this schema:
    {
        "optimized_description": "string",
        "required_skills": [{"name": "string", "level": "basic|intermediate|advanced"}],
        "optional_skills": [{"name": "string", "level": "basic|intermediate|advanced"}]
    }
    """
    prompt = f"""You are an expert recruiter and technical writer. 
Your task is to take a simple, brief job description draft and expand it into a highly structured, professional, and SEO-friendly job description. 
In addition, you must analyze the requirements and extract the ideal technical stack, classifying them into Required Skills and Optional (nice-to-have) Skills.

Job context:
- Title: {title or 'Software Engineer'}
- Input Draft: {prompt_text}

Generate a JSON object containing exactly three fields:
1. "optimized_description": A beautifully formatted markdown description including sections for "Role Overview", "Key Responsibilities", and "Ideal Candidate Profile". Keep it engaging and professional to attract top-tier talent.
2. "required_skills": A list of objects representing core technical skills absolutely required for this role. Each object must have a "name" (the skill) and "level" ("basic", "intermediate", or "advanced"). Limit to 3-6 core skills.
3. "optional_skills": A list of objects representing nice-to-have/preferred technical skills. Each object must have a "name" and "level" ("basic", "intermediate", or "advanced"). Limit to 2-4 skills.

Respond ONLY with a valid JSON object matching this schema:
{{
  "optimized_description": "string",
  "required_skills": [
    {{
      "name": "string",
      "level": "basic|intermediate|advanced"
    }}
  ],
  "optional_skills": [
    {{
      "name": "string",
      "level": "basic|intermediate|advanced"
    }}
  ]
}}
"""

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
                cleaned = response.text.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("```")[1]
                    if cleaned.startswith("json"):
                        cleaned = cleaned[4:]
                parsed = json.loads(cleaned.strip())
                if "optimized_description" in parsed:
                    logger.info("Optimized job description via Gemini")
                    return parsed
        except Exception as e:
            logger.warning(f"Failed to optimize job description via Gemini, trying Groq: {e}")

    groq_key = settings.GROQ_API_KEY
    if groq_key:
        try:
            groq_client = Groq(api_key=groq_key)
            model_name = settings.GROQ_CHAT_MODEL or "llama-3.3-70b-versatile"
            response = groq_client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000,
                temperature=0.3,
                response_format={"type": "json_object"}
            )
            if response.choices and response.choices[0].message.content:
                parsed = json.loads(response.choices[0].message.content.strip())
                if "optimized_description" in parsed:
                    logger.info("Optimized job description via Groq fallback")
                    return parsed
        except Exception as e:
            logger.warning(f"Failed to optimize job description via Groq fallback: {e}")

    # Local heuristic fallback
    return {
        "optimized_description": f"### Role Overview\n{prompt_text}\n\n### Key Responsibilities\n- Build high-quality features and clean code.\n- Collaborate with product and engineering teams.\n\n### Requirements\n- Experience with technical stack and software engineering best practices.",
        "required_skills": [
            {"name": "Python", "level": "advanced"}
        ],
        "optional_skills": [
            {"name": "Git", "level": "intermediate"}
        ]
    }
