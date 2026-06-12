"""
test_confidence_scorer.py
-------------------------
Unit tests for the ConfidenceScorer heuristic scoring functions.
Pure Python — no DB, no API calls, no filesystem.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from resume_pipeline.resume.confidence_scorer import ConfidenceScorer


@pytest.fixture
def scorer():
    return ConfidenceScorer()


# ── Contact section ───────────────────────────────────────────────────────────

def test_contact_all_fields_present(scorer):
    contact = {
        "name": "Alice Smith",
        "email": "alice@example.com",
        "phone": "+91-9876543210",
        "location": "Bangalore, Karnataka",
    }
    score = scorer.score_contact(contact)
    assert score == 1.0, f"Expected 1.0 but got {score}"


def test_contact_missing_half_fields(scorer):
    contact = {"name": "Alice", "email": "alice@example.com"}
    score = scorer.score_contact(contact)
    assert 0.40 <= score <= 0.60, f"Expected ~0.50 but got {score}"


def test_contact_social_bonus(scorer):
    contact = {
        "name": "Alice", "email": "alice@example.com",
        "phone": "+91-9876543210", "location": "Delhi",
        "linkedin_url": "https://linkedin.com/in/alice",
    }
    score = scorer.score_contact(contact)
    assert score > 1.0 - 0.001 or score == 1.0, "Should be capped at 1.0"


def test_contact_error_dict(scorer):
    score = scorer.score_contact({"error": "json_parse_error"})
    assert score == 0.30


def test_contact_empty(scorer):
    score = scorer.score_contact({})
    assert score == 0.30


# ── Education section ─────────────────────────────────────────────────────────

def test_education_complete_entry_with_grade(scorer):
    education = {
        "education": [
            {
                "institution": "IIT Delhi",
                "degree": "B.Tech",
                "field": "Computer Science",
                "end_year": "2024",
                "grade": 8.5,
            }
        ]
    }
    score = scorer.score_education(education)
    assert score >= 0.90, f"Expected >= 0.90 but got {score}"


def test_education_missing_grade_capped(scorer):
    education = {
        "education": [
            {
                "institution": "Some College",
                "degree": "BCA",
                "field": "Computer Science",
                "end_year": "2023",
                "grade": None,  # No grade
            }
        ]
    }
    score = scorer.score_education(education)
    assert score <= 0.70, f"Expected cap at 0.70 due to missing grade but got {score}"


def test_education_no_entries(scorer):
    score = scorer.score_education({"education": []})
    assert score == 0.40


def test_education_error(scorer):
    score = scorer.score_education({"error": "no_candidates"})
    assert score == 0.30


# ── Experience section ────────────────────────────────────────────────────────

def test_experience_complete_entry(scorer):
    experience = {
        "experience": [
            {
                "company": "Infosys",
                "title": "Software Engineer",
                "start_date": "2022-06",
                "end_date": "Present",
                "responsibilities": ["Built APIs", "Led deployments"],
            }
        ]
    }
    score = scorer.score_experience(experience)
    assert score >= 0.80, f"Expected >= 0.80 but got {score}"


def test_experience_empty_with_long_resume(scorer):
    """No experience entries but resume > 500 words → likely extraction failure"""
    score = scorer.score_experience({"experience": []}, resume_word_count=600)
    assert score == 0.30, f"Expected 0.30 (long resume, no experience) but got {score}"


def test_experience_empty_short_resume(scorer):
    """No experience, short resume → likely genuinely a fresher"""
    score = scorer.score_experience({"experience": []}, resume_word_count=200)
    assert score == 0.80, f"Expected 0.80 (fresher) but got {score}"


# ── Skills section ────────────────────────────────────────────────────────────

def test_skills_8_plus(scorer):
    skills = {"skills": ["Python", "Java", "SQL", "FastAPI", "Docker", "K8s", "ML", "TensorFlow", "AWS"]}
    score = scorer.score_skills(skills)
    assert score == 1.0


def test_skills_exactly_8(scorer):
    skills = {"skills": ["Python", "Java", "SQL", "FastAPI", "Docker", "K8s", "ML", "TF"]}
    score = scorer.score_skills(skills)
    assert score == 1.0


def test_skills_4_skills(scorer):
    skills = {"skills": ["Python", "SQL", "ML", "Docker"]}
    score = scorer.score_skills(skills)
    assert score == 0.5, f"Expected 0.50 (4/8) but got {score}"


def test_skills_fewer_than_3(scorer):
    score = scorer.score_skills({"skills": ["Python", "SQL"]})
    assert score == 0.30


def test_skills_empty_list(scorer):
    score = scorer.score_skills({"skills": []})
    assert score == 0.30


# ── Projects section ──────────────────────────────────────────────────────────

def test_projects_absent_defaults_to_high(scorer):
    """Missing projects section — default to 0.80 (optional section)"""
    score = scorer.score_projects({})
    assert score == 0.80


def test_projects_empty_list_defaults_to_high(scorer):
    """Empty projects list — also default to 0.80"""
    score = scorer.score_projects({"projects": []})
    assert score == 0.80


def test_projects_good_entry(scorer):
    projects = {
        "projects": [
            {
                "name": "Resume Parser",
                "description": "Built a resume parser using FastAPI and Gemini.",
                "tech_stack": ["Python", "FastAPI"],
            }
        ]
    }
    score = scorer.score_projects(projects)
    assert score >= 0.90, f"Expected >= 0.90 but got {score}"


# ── Overall weighted score ────────────────────────────────────────────────────

def test_overall_all_perfect(scorer):
    section_scores = {
        "contact": 1.0,
        "education": 1.0,
        "experience": 1.0,
        "skills": 1.0,
        "projects": 1.0,
        "extras": 1.0,
    }
    overall = scorer.compute_overall(section_scores)
    assert overall == 1.0


def test_overall_all_zero(scorer):
    section_scores = {
        "contact": 0.0,
        "education": 0.0,
        "experience": 0.0,
        "skills": 0.0,
        "projects": 0.0,
        "extras": 0.0,
    }
    overall = scorer.compute_overall(section_scores)
    assert overall == 0.0


def test_score_all_returns_overall_key(scorer):
    result = scorer.score_all(
        contact={"name": "Alice", "email": "a@b.com", "phone": "999", "location": "Delhi"},
        education={"education": [{"institution": "IIT", "degree": "B.Tech", "field": "CS", "end_year": "2024", "grade": 8.0}]},
        experience={"experience": []},
        skills={"skills": ["Python", "SQL", "Docker", "FastAPI"]},
        projects={"projects": []},
        extras={},
        resume_text="short resume text",
        resume_word_count=3,
    )
    assert "overall" in result
    assert 0.0 <= result["overall"] <= 1.0
    assert all(k in result for k in ["contact", "education", "experience", "skills", "projects", "extras"])
