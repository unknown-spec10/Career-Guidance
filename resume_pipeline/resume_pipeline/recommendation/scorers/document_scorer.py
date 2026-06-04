import logging
from ..embedder import Embedder

logger = logging.getLogger(__name__)


class DocumentScorer:
    """Tier 5: Full Semantic Understanding via Document Embeddings.
    
    Compares the full resume profile summary text against the complete job description text.
    Uses cached job embeddings in the DB.
    """

    def __init__(self, embedder: Embedder):
        self.embedder = embedder

    def build_resume_text(self, applicant) -> str:
        """Construct a single summary text block from the parsed candidate resume."""
        parsed = applicant.parsed_record
        if not parsed or not parsed.normalized:
            return ""

        normalized = parsed.normalized

        # Extract name and location
        personal = normalized.get("personal", {}) or normalized.get("personal_info", {})
        name = personal.get("name") or applicant.display_name or "Candidate"
        location = personal.get("location") or f"{applicant.location_city or ''}, {applicant.location_state or ''}".strip(", ")

        # Skills list
        skills_list = []
        for s in normalized.get("skills", []):
            name_s = s.get("name", "") if isinstance(s, dict) else str(s)
            if name_s:
                skills_list.append(name_s)
        skills_str = ", ".join(list(dict.fromkeys(skills_list))[:25])

        # Education
        edu_list = []
        for edu in normalized.get("education", []):
            degree = edu.get("degree", "")
            field = edu.get("field", "")
            inst = edu.get("institution", "") or edu.get("college", "")
            cgpa = edu.get("cgpa") or edu.get("grade") or ""
            parts = [f"{degree} in {field}" if (degree and field) else (degree or field)]
            if inst:
                parts.append(f"from {inst}")
            if cgpa:
                parts.append(f"with {cgpa} CGPA")
            edu_list.append(" ".join(filter(None, parts)))
        edu_str = " • ".join(edu_list)

        # Experience
        exp_list = []
        for exp in normalized.get("experience", []):
            role = exp.get("role") or exp.get("title", "")
            comp = exp.get("company", "")
            desc = exp.get("description", "")
            parts = [f"{role}" if role else ""]
            if comp:
                parts.append(f"at {comp}")
            if desc:
                parts.append(f"({desc[:100]}...)")
            exp_list.append(" ".join(filter(None, parts)))
        exp_str = "; ".join(exp_list[:3])

        # Simple experience years check
        years = len(normalized.get("experience", []))

        summary_parts = [f"{name} is a professional with {years} years of experience."]
        if location:
            summary_parts.append(f"Preferred location: {location}.")
        if skills_str:
            summary_parts.append(f"Skills: {skills_str}.")
        if edu_str:
            summary_parts.append(f"Education: {edu_str}.")
        if exp_str:
            summary_parts.append(f"Experience: {exp_str}.")

        return " ".join(summary_parts)

    def score(self, applicant, job) -> float | None:
        """Score document-level similarity between applicant summary and full job posting.

        The applicant's resume-summary vector is persisted to applicant_embeddings (suffix='')
        so repeated runs reuse the cached vector — zero Gemini API calls after first run.
        """
        resume_text = self.build_resume_text(applicant)
        if not resume_text:
            return 0.0

        # Embed candidate profile — uses DB cache (suffix='document' → '' default)
        instruction_candidate = "Represent this candidate profile for job matching:"
        user_vector = self.embedder.get_applicant_embedding(
            applicant=applicant,
            text=resume_text,
            suffix="",  # document-level embedding
            instruction=instruction_candidate,
        )

        # Helper payload builder for caching job document text
        def _build_job_doc_payload(j) -> str:
            from ...utils import truncate_for_llm
            req_skills = []
            for s in j.required_skills or []:
                name = s.get("name", "") if isinstance(s, dict) else str(s)
                if name:
                    req_skills.append(name)
            skills_str = ", ".join(req_skills)

            desc_safe = truncate_for_llm(j.description or "", "recommendation_max_chars")
            payload = f"Title: {j.title or ''}. Description: {desc_safe}."
            if skills_str:
                payload += f" Required Skills: {skills_str}."
            return payload

        # Retrieve or compute job document embedding vector
        job_vector = self.embedder.get_job_embedding(job.id, _build_job_doc_payload, job)

        # Cosine similarity matching
        similarity = self.embedder.cosine_similarity(user_vector, job_vector)
        return min(1.0, max(0.0, float(similarity)))
