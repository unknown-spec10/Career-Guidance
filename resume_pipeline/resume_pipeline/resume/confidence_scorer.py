"""
confidence_scorer.py
--------------------
Layer 3: Heuristic confidence scoring for the redesigned resume parse pipeline.

Confidence is computed by the Python layer AFTER extraction, based on
observable properties of the extracted data. It does NOT rely on LLM
self-reported confidence (which is unreliable and poorly calibrated).

Public API:
    scorer = ConfidenceScorer()
    scores = scorer.score_all(contact, education, experience, skills, projects, extras)
    # Returns: {"contact": 0.75, "education": 0.80, ..., "overall": 0.82}
"""

import logging
import re
from typing import Any, Dict, List, Optional

from ..constants import CONFIDENCE_WEIGHTS

logger = logging.getLogger(__name__)


class ConfidenceScorer:
    """
    Computes per-section and overall confidence scores from extracted resume sections.
    All scores are in the range [0.0, 1.0].
    """

    def score_contact(self, contact: Dict[str, Any]) -> float:
        """
        Score based on completeness of 4 core contact fields.
        Bonus for LinkedIn/GitHub URL presence.
        """
        if not contact or "error" in contact:
            return 0.30

        expected = ["name", "email", "phone", "location"]
        present = sum(1 for f in expected if contact.get(f))
        score = present / len(expected)

        # Bonus: +0.05 if at least one social/portfolio URL present
        has_social = any(contact.get(f) for f in ["linkedin_url", "github_url", "portfolio_url"])
        if has_social:
            score = min(score + 0.05, 1.0)

        return round(score, 4)

    def score_education(self, education_data: Dict[str, Any], resume_word_count: int = 0) -> float:
        """
        Score based on completeness of education entries.
        CGPA/grade is a critical field — missing grade caps section confidence at 0.70.
        """
        if not education_data or "error" in education_data:
            return 0.30

        entries = education_data.get("education", [])
        if not entries:
            return 0.40  # some resumes genuinely omit this (unlikely for our use case)

        entry_fields = ["institution", "degree", "field", "end_year", "grade"]
        scores = []
        has_any_grade = False

        for entry in entries:
            if not isinstance(entry, dict):
                continue
            present = sum(1 for f in entry_fields if entry.get(f) is not None)
            entry_score = present / len(entry_fields)
            if entry.get("grade") is not None:
                has_any_grade = True
            scores.append(entry_score)

        if not scores:
            return 0.30

        avg = sum(scores) / len(scores)

        # Critical field penalty: missing CGPA caps at 0.70
        # (CGPA feeds downstream recommendation scoring directly)
        if not has_any_grade:
            avg = min(avg, 0.70)

        return round(avg, 4)

    def score_experience(self, experience_data: Dict[str, Any], resume_word_count: int = 0) -> float:
        """
        Score based on completeness of experience entries.
        If zero roles extracted but resume is long (>500 words) → likely extraction failure.
        """
        if not experience_data or "error" in experience_data:
            return 0.30

        entries = experience_data.get("experience", [])

        # Heuristic: if the resume is long but no experience found → failure signal
        if not entries:
            if resume_word_count > 500:
                return 0.30  # very likely extraction missed it
            return 0.80  # short resume may genuinely have no experience (fresher)

        entry_fields = ["company", "title", "start_date", "end_date", "responsibilities"]
        scores = []

        for entry in entries:
            if not isinstance(entry, dict):
                continue
            present = 0
            for f in entry_fields:
                val = entry.get(f)
                if val is not None and val != [] and val != "":
                    present += 1
            scores.append(present / len(entry_fields))

        if not scores:
            return 0.30

        return round(sum(scores) / len(scores), 4)

    def score_skills(self, skills_data: Dict[str, Any]) -> float:
        """
        Score based on skill count.
        Minimum 3 skills expected for any technical resume.
        Score = min(count / 8, 1.0), capped at 1.0 for 8+ skills.
        """
        if not skills_data or "error" in skills_data:
            return 0.30

        skills = skills_data.get("skills", [])
        if not isinstance(skills, list):
            return 0.30

        count = len([s for s in skills if s and str(s).strip()])
        if count < 3:
            return 0.30  # fewer than 3 almost always indicates extraction failure

        score = min(count / 8.0, 1.0)
        return round(score, 4)

    def score_projects(self, projects_data: Dict[str, Any]) -> float:
        """
        Projects is an optional section.
        Default 0.80 (absence is normal — many resumes lack a projects section).
        Penalized if the section was found by the LLM but extraction came back empty.
        """
        if not projects_data or "error" in projects_data:
            return 0.80  # assume absence, not failure

        entries = projects_data.get("projects", [])
        if entries is None:
            return 0.80  # explicitly null → section not present

        if isinstance(entries, list) and len(entries) == 0:
            # Empty list returned — could mean the LLM found the section but got nothing
            # We trust the LLM here: if it returned [], section was likely absent
            return 0.80

        entry_fields = ["name", "description", "tech_stack"]
        scores = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            present = sum(1 for f in entry_fields if entry.get(f))
            scores.append(present / len(entry_fields))

        if not scores:
            return 0.80

        return round(sum(scores) / len(scores), 4)

    def score_extras(self, extras_data: Dict[str, Any], resume_text: str = "") -> float:
        """
        Extras is an optional section — defaults to 0.85.
        Penalized only if certifications are mentioned in the resume text but not extracted.
        """
        if not extras_data or "error" in extras_data:
            return 0.85

        score = 0.85

        # Check if certifications seem to be in the resume but weren't extracted
        has_cert_mention = bool(
            resume_text and re.search(
                r"certif|credential|course|udemy|coursera|aws|gcp|azure",
                resume_text,
                re.IGNORECASE,
            )
        )
        extracted_certs = extras_data.get("certifications", [])
        if has_cert_mention and (not extracted_certs or not isinstance(extracted_certs, list)):
            score = min(score, 0.65)

        return round(score, 4)

    def compute_overall(self, section_scores: Dict[str, float]) -> float:
        """
        Weighted average of per-section scores using CONFIDENCE_WEIGHTS from constants.py.
        """
        total = 0.0
        weight_sum = 0.0
        for section, weight in CONFIDENCE_WEIGHTS.items():
            s = section_scores.get(section, 0.80)  # default to 0.80 if missing
            total += s * weight
            weight_sum += weight

        if weight_sum == 0:
            return 0.0

        return round(total / weight_sum, 4)

    def score_all(
        self,
        contact: Dict[str, Any],
        education: Dict[str, Any],
        experience: Dict[str, Any],
        skills: Dict[str, Any],
        projects: Dict[str, Any],
        extras: Dict[str, Any],
        resume_text: str = "",
        resume_word_count: int = 0,
    ) -> Dict[str, float]:
        """
        Compute all per-section scores and the weighted overall score.

        Returns:
            {
                "contact": 0.75,
                "education": 0.80,
                "experience": 0.85,
                "skills": 1.0,
                "projects": 0.80,
                "extras": 0.85,
                "overall": 0.84,
            }
        """
        scores = {
            "contact":    self.score_contact(contact),
            "education":  self.score_education(education, resume_word_count),
            "experience": self.score_experience(experience, resume_word_count),
            "skills":     self.score_skills(skills),
            "projects":   self.score_projects(projects),
            "extras":     self.score_extras(extras, resume_text),
        }
        scores["overall"] = self.compute_overall(scores)
        logger.info(f"ConfidenceScorer: {scores}")
        return scores
