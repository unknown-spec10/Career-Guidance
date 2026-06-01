import re
import datetime
from sqlalchemy.orm import Session


def score_resume(parsed_data: dict, job_skills: list = None, db: Session = None) -> dict:
    """Calculate a deterministic ATS score (0-100) and structured suggestions for a parsed resume.
    
    Weights:
    - keyword_match: 35%
    - completeness: 20%
    - formatting: 15%
    - experience_depth: 20%
    - contact_info: 10%
    """
    scores = {}
    suggestions = []

    # 1. Keyword match (35%)
    scores["keyword_match"], keyword_suggestions = _calculate_keyword_match(parsed_data, job_skills, db)
    suggestions.extend(keyword_suggestions)

    # 2. Section completeness (20%)
    scores["completeness"], completeness_suggestions = _calculate_completeness(parsed_data)
    suggestions.extend(completeness_suggestions)

    # 3. Formatting (15%)
    scores["formatting"], formatting_suggestions = _calculate_formatting(parsed_data)
    suggestions.extend(formatting_suggestions)

    # 4. Experience depth (20%)
    scores["experience_depth"], experience_suggestions = _calculate_experience_depth(parsed_data)
    suggestions.extend(experience_suggestions)

    # 5. Contact info (10%)
    scores["contact_info"], contact_suggestions = _calculate_contact_info(parsed_data)
    suggestions.extend(contact_suggestions)

    # Calculate weighted average
    total_score = round(
        (scores["keyword_match"] * 0.35) +
        (scores["completeness"] * 0.20) +
        (scores["formatting"] * 0.15) +
        (scores["experience_depth"] * 0.20) +
        (scores["contact_info"] * 0.10)
    )

    return {
        "total": min(100, max(0, total_score)),
        "breakdown": scores,
        "suggestions": suggestions[:6]  # Return top 6 actionable suggestions
    }


def _calculate_keyword_match(parsed_data: dict, job_skills: list = None, db: Session = None) -> tuple:
    """Compare parsed skills against target job skills or dynamic market demand baseline."""
    suggestions = []
    resume_skills = parsed_data.get("skills", [])
    
    # Handle list of dicts/strings for resume skills
    resume_skills_set = set()
    for s in resume_skills:
        name = s.get("name", "") if isinstance(s, dict) else str(s)
        if name:
            resume_skills_set.add(name.lower().strip())

    target_skills = []
    is_job_specific = False

    if job_skills:
        is_job_specific = True
        for s in job_skills:
            name = s.get("name", "") if isinstance(s, dict) else str(s)
            if name:
                target_skills.append(name.lower().strip())
    elif db:
        # Dynamic market demand list: fetch all required skills from active approved jobs
        try:
            from ..db import Job
            now = datetime.datetime.utcnow()
            active_jobs = db.query(Job).filter(
                Job.status == "approved",
                ((Job.expires_at.is_(None)) | (Job.expires_at > now))
            ).all()
            
            market_skills = []
            for j in active_jobs:
                for s in j.required_skills or []:
                    name = s.get("name", "") if isinstance(s, dict) else str(s)
                    if name:
                        market_skills.append(name.lower().strip())
            
            from collections import Counter
            counts = Counter(market_skills)
            # Take top 15 most in-demand skills as baseline
            target_skills = [item[0] for item in counts.most_common(15)]
        except Exception:
            target_skills = []

    # Fallback default canonical list if no job or market database skills exist
    if not target_skills:
        target_skills = ["python", "javascript", "react", "sql", "git", "docker", "fastapi", "html", "css"]

    matched_skills = []
    missing_skills = []

    for req in target_skills:
        matched = False
        # Keyword matching (supports exact and substring matching for robust normalization)
        for cand in resume_skills_set:
            if req == cand or req in cand or cand in req:
                matched = True
                matched_skills.append(req)
                break
        if not matched:
            missing_skills.append(req)

    total_req = len(target_skills)
    if total_req > 0:
        score = (len(matched_skills) / total_req) * 100.0
    else:
        score = 100.0

    score = min(100.0, score)

    # Suggestions based on missing keywords
    if missing_skills:
        missing_display = ", ".join([s.title() for s in missing_skills[:3]])
        if is_job_specific:
            suggestions.append(f"Add key technical skills required by this job description: {missing_display}.")
        else:
            suggestions.append(f"Improve your general market value by adding in-demand tech keywords: {missing_display}.")
    else:
        suggestions.append("Excellent keyword coverage! Your skills perfectly match the target profile.")

    return round(score), suggestions


def _calculate_completeness(parsed_data: dict) -> tuple:
    """Verify presence of core resume sections (Summary, Education, Experience, Skills)."""
    suggestions = []
    points = 0
    
    # 1. Summary
    has_summary = bool(parsed_data.get("summary")) or (
        parsed_data.get("personal_info") and bool(parsed_data.get("personal_info", {}).get("summary"))
    )
    if has_summary:
        points += 25
    else:
        suggestions.append("Add a professional summary or profile overview at the beginning of your resume.")

    # 2. Education
    education = parsed_data.get("education", [])
    if isinstance(education, list) and len(education) > 0:
        points += 25
    else:
        suggestions.append("Add an 'Education' section detailing your degrees, institution names, and graduation years.")

    # 3. Experience
    experience = parsed_data.get("experience", [])
    if isinstance(experience, list) and len(experience) > 0:
        points += 25
    else:
        suggestions.append("Add an 'Experience' or 'Work History' section listing your relevant roles and responsibilities.")

    # 4. Skills
    skills = parsed_data.get("skills", [])
    if isinstance(skills, list) and len(skills) > 0:
        points += 25
    else:
        suggestions.append("Add a dedicated 'Skills' section listing your technical competencies.")

    return points, suggestions


def _calculate_formatting(parsed_data: dict) -> tuple:
    """Assess resume formatting parseability (clean descriptions, bullet points, standard layouts)."""
    suggestions = []
    score = 100
    
    # Heuristic 1: Check for extremely long unstructured text blocks (suggesting lack of clean lists/bullets)
    exp_list = parsed_data.get("experience", [])
    has_bullets = False
    has_long_blocks = False
    
    for exp in exp_list:
        desc = exp.get("description", "") or ""
        # Check if description uses common list bullet characters
        if any(char in desc for char in ("•", "-", "*", "▪", "◦")):
            has_bullets = True
        if len(desc.split()) > 100 and not any(char in desc for char in ("•", "-", "*")):
            has_long_blocks = True

    if has_long_blocks:
        score -= 20
        suggestions.append("Structure your experience descriptions with bullet points instead of dense paragraphs for easier scanning.")
    elif not has_bullets and len(exp_list) > 0:
        score -= 10
        suggestions.append("Use standard bullet point lists in your work history sections.")

    # Heuristic 2: Standard dates formatting
    has_proper_dates = True
    for exp in exp_list:
        start = str(exp.get("start_date") or "")
        end = str(exp.get("end_date") or "")
        if not re.search(r'\b(?:19|20)\d{2}\b', start) and not re.search(r'\b(?:19|20)\d{2}\b', end):
            has_proper_dates = False
            break

    if not has_proper_dates and len(exp_list) > 0:
        score -= 15
        suggestions.append("Ensure your employment dates include the year (e.g., '2022' or 'YYYY') so ATS checkers can compute tenure.")

    # Heuristic 3: Check for empty/missing project URLs or links
    proj_list = parsed_data.get("projects", [])
    missing_links = False
    for p in proj_list:
        if not p.get("link"):
            missing_links = True
            break
            
    if missing_links and len(proj_list) > 0:
        score -= 10
        suggestions.append("Include clickable GitHub or live URL links to your key projects to prove real-world impact.")

    return max(50, score), suggestions


def _calculate_experience_depth(parsed_data: dict) -> tuple:
    """Measure if candidate quantifies achievements with numbers, percentages, or money metrics."""
    suggestions = []
    exp_list = parsed_data.get("experience", [])
    
    if not exp_list:
        return 50, ["Add professional or internship experience to show practical application of skills."]

    metric_roles = 0
    for exp in exp_list:
        desc = exp.get("description", "") or ""
        # Regex to scan for metrics: percentages, dollar/rupee sums, numbers of users, scale, counts
        has_metrics = bool(re.search(
            r'\b\d+(?:\s*%|\+)?\b|\$\s*\d+|\b\d+\s*(?:million|percent|USD|INR|developers|users|clients|projects|team|employees)\b', 
            desc, 
            re.IGNORECASE
        ))
        if has_metrics:
            metric_roles += 1

    score = (metric_roles / len(exp_list)) * 100.0
    score = min(100.0, score)

    if score < 50.0:
        suggestions.append("Quantify your achievements! Add metrics like '%' increased, revenue saved, or team scale managed (e.g. 'boosted efficiency by 20%').")
    else:
        suggestions.append("Great job of quantifying impact with performance metrics in your roles!")

    return round(score), suggestions


def _calculate_contact_info(parsed_data: dict) -> tuple:
    """Verify presence of core contact details (Email, Phone, Location, Socials)."""
    suggestions = []
    points = 0
    
    personal = parsed_data.get("personal_info") or parsed_data.get("personal", {})
    if not isinstance(personal, dict):
        personal = {}

    # Email
    email = personal.get("email") or parsed_data.get("email")
    if email and "@" in str(email):
        points += 35
    else:
        suggestions.append("Include your contact email address directly on your resume.")

    # Phone
    phone = personal.get("phone") or parsed_data.get("phone")
    if phone:
        points += 30
    else:
        suggestions.append("Include a working mobile phone number.")

    # Location
    location = personal.get("location") or parsed_data.get("location") or parsed_data.get("location_city")
    if location:
        points += 15
    else:
        suggestions.append("State your location (City, State) to clear up any relocations query.")

    # Socials/Portfolio (GitHub or LinkedIn)
    social_keywords = ["github.com", "linkedin.com", "portfolio", "git", "linkedin", "github"]
    has_social = False
    
    # Scan personal info and summary for social keywords
    personal_str = str(personal).lower()
    summary_str = str(parsed_data.get("summary", "")).lower()
    
    if any(keyword in personal_str or keyword in summary_str for keyword in social_keywords):
        has_social = True
        
    if has_social:
        points += 20
    else:
        suggestions.append("Add a link to your LinkedIn or GitHub profile to provide online credibility.")

    return points, suggestions
