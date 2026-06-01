"""
llm_groq.py
-----------
Groq-based LLM extraction client for the career guidance parser pipeline.
Handles the six section-extraction prompts concurrently using the Groq API.
Model used: settings.GROQ_CHAT_MODEL (llama-3.3-70b-versatile)
"""

import asyncio
import json
import logging
import time
import random
from typing import Any, Dict, List, Optional
from groq import Groq

from ..config import settings

logger = logging.getLogger(__name__)

_SYSTEM_NOTE = (
    "Return ONLY valid JSON. No markdown, no prose, no ```json fences. "
    "If a field is missing or unknown in the resume, return null. "
    "Do NOT invent values — only extract what is explicitly present."
)


# ─────────────────────────────────────────────────────────────
# Internal helper — raw Groq API call (sync)
# ─────────────────────────────────────────────────────────────

def _call_groq_sync(
    prompt: str,
    model: str,
    api_key: str,
    max_tokens: int = 4096,
    temperature: float = 0.05,
) -> dict:
    """
    Single synchronous Groq completions call with automatic retry on transient errors.
    Enforces valid JSON output via response_format.
    """
    if not api_key:
        return {"error": "groq_api_key_not_set"}

    client = Groq(api_key=api_key)
    max_retries = 5
    base_delay = 1.0
    start = time.monotonic()

    for attempt in range(max_retries):
        try:
            # Groq chat completion call
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a precise resume parser. You extract information and output strict, valid JSON matching the requested schema."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=temperature,
                max_tokens=max_tokens,
                response_format={"type": "json_object"},
            )
            latency = time.monotonic() - start

            content = resp.choices[0].message.content
            if not content:
                return {"error": "empty_groq_response", "_latency": latency}

            parsed = json.loads(content.strip())
            parsed["_latency"] = latency
            return parsed

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Groq JSON response on attempt {attempt+1}: {e}")
            if attempt == max_retries - 1:
                return {"error": "json_parse_error", "_raw": str(e)[:200], "_latency": time.monotonic() - start}
            time.sleep(0.5)
            continue

        except Exception as e:
            # Check for transient errors or rate limits (HTTP 429 / 5xx)
            err_str = str(e).lower()
            is_transient = "429" in err_str or "rate_limit" in err_str or "quota" in err_str or "500" in err_str or "502" in err_str or "503" in err_str or "504" in err_str
            
            if not is_transient or attempt == max_retries - 1:
                logger.error(f"Groq API call failed: {e}")
                return {"error": str(e)[:200], "_latency": time.monotonic() - start}

            delay = base_delay * (2 ** attempt) + random.uniform(0.1, 0.5)
            logger.warning(
                f"Groq API transient error/rate limit on attempt {attempt+1}. "
                f"Retrying in {delay:.2f} seconds... Error: {e}"
            )
            time.sleep(delay)

    return {"error": "max_retries_exceeded", "_latency": time.monotonic() - start}


# ─────────────────────────────────────────────────────────────
# Async wrappers — one per section
# ─────────────────────────────────────────────────────────────

async def extract_contact(resume_text: str, model: str, api_key: str, base_url: str = None) -> Dict[str, Any]:
    """Extract contact and personal information."""
    prompt = f"""{_SYSTEM_NOTE}

You are extracting ONLY the personal/contact section from this resume.

Resume:
\"\"\"
{resume_text}
\"\"\"

Return this JSON structure (null for any field not found):
{{
  "name": "Full name as written",
  "email": "email@example.com",
  "phone": "phone number string",
  "location": "City, State/Country",
  "linkedin_url": "https://linkedin.com/in/...",
  "github_url": "https://github.com/...",
  "portfolio_url": "https://..."
}}"""

    return await asyncio.to_thread(
        _call_groq_sync, prompt, model, api_key, 512
    )


async def extract_education(resume_text: str, model: str, api_key: str, base_url: str = None) -> Dict[str, Any]:
    """Extract all education entries with CGPA/grades."""
    prompt = f"""{_SYSTEM_NOTE}

You are extracting ONLY the education section from this resume.
Be especially careful to extract CGPA/GPA/percentage exactly as written.

Resume:
\"\"\"
{resume_text}
\"\"\"

Return this JSON structure:
{{
  "education": [
    {{
      "institution": "University/College name",
      "degree": "B.Tech / BCA / M.Sc / etc",
      "field": "Field of study",
      "start_year": "YYYY or null",
      "end_year": "YYYY or null",
      "grade": 8.5,
      "grade_scale": "10 or 100 or null",
      "grade_type": "cgpa or percentage or gpa or null",
      "board_university": "Board or university name or null",
      "coursework": ["subject1", "subject2"]
    }}
  ]
}}"""

    return await asyncio.to_thread(
        _call_groq_sync, prompt, model, api_key, 2048
    )


async def extract_experience(resume_text: str, model: str, api_key: str, base_url: str = None) -> Dict[str, Any]:
    """Extract all work experience entries."""
    prompt = f"""{_SYSTEM_NOTE}

You are extracting ONLY the work experience section from this resume.
Handle bullets, paragraphs, and mixed formats. Include internships.

Resume:
\"\"\"
{resume_text}
\"\"\"

Return this JSON structure:
{{
  "experience": [
    {{
      "company": "Company name",
      "title": "Job title",
      "employment_type": "full-time or internship or contract or part-time or null",
      "start_date": "YYYY-MM or YYYY or null",
      "end_date": "YYYY-MM or YYYY or Present or null",
      "location": "City, Country or remote or null",
      "responsibilities": ["bullet or sentence 1", "bullet 2"]
    }}
  ]
}}"""

    return await asyncio.to_thread(
        _call_groq_sync, prompt, model, api_key, 3072
    )


async def extract_skills(resume_text: str, model: str, api_key: str, base_url: str = None) -> Dict[str, Any]:
    """Extract ALL skills mentioned anywhere in the resume."""
    prompt = f"""{_SYSTEM_NOTE}

You are extracting ONLY skills from this resume.
Find skills in the dedicated skills section, in experience bullets, in project descriptions, everywhere.
Include programming languages, frameworks, tools, platforms, databases, concepts.

Resume:
\"\"\"
{resume_text}
\"\"\"

Return this JSON structure:
{{
  "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Machine Learning"]
}}

Return a flat list of skill name strings. Do NOT group by category. Include ALL skills found."""

    return await asyncio.to_thread(
        _call_groq_sync, prompt, model, api_key, 1024
    )


async def extract_projects(resume_text: str, model: str, api_key: str, base_url: str = None) -> Dict[str, Any]:
    """Extract all project entries."""
    prompt = f"""{_SYSTEM_NOTE}

You are extracting ONLY the projects section from this resume.
Include academic projects, personal projects, open-source contributions.

Resume:
\"\"\"
{resume_text}
\"\"\"

Return this JSON structure:
{{
  "projects": [
    {{
      "name": "Project name",
      "description": "1-2 sentence description of what it does",
      "tech_stack": ["tech1", "tech2"],
      "url": "GitHub/demo URL or null",
      "role": "Developer / Lead / etc or null",
      "start_date": "YYYY-MM or null",
      "end_date": "YYYY-MM or Present or null"
    }}
  ]
}}"""

    return await asyncio.to_thread(
        _call_groq_sync, prompt, model, api_key, 2048
    )


async def extract_extras(resume_text: str, model: str, api_key: str, base_url: str = None) -> Dict[str, Any]:
    """Extract certifications, awards, languages, publications, and other extras."""
    prompt = f"""{_SYSTEM_NOTE}

You are extracting certifications, awards, languages spoken, publications, volunteer work,
and any other sections NOT covered by contact / education / experience / skills / projects.

Resume:
\"\"\"
{resume_text}
\"\"\"

Return this JSON structure:
{{
  "certifications": [
    {{
      "name": "Certification name",
      "issuer": "Issuing organization",
      "issue_date": "YYYY-MM or YYYY or null",
      "expiry_date": "YYYY-MM or null",
      "credential_id": "ID string or null",
      "url": "URL or null"
    }}
  ],
  "awards": [
    {{"title": "Award name", "issuer": "null or org", "year": "YYYY or null"}}
  ],
  "languages_spoken": ["English", "Hindi"],
  "publications": [
    {{"title": "Paper title", "venue": "Conference/Journal", "year": "YYYY or null"}}
  ],
  "volunteer": [
    {{"organization": "Org name", "role": "Role", "description": "null or brief"}}
  ]
}}"""

    return await asyncio.to_thread(
        _call_groq_sync, prompt, model, api_key, 2048
    )
