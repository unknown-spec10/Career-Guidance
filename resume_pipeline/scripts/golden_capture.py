"""Capture golden full-ranking output BEFORE the retrieval+ranking refactor.

Uses the current engine's run_pipeline_for_applicant_job with embeddings
forced unavailable (deterministic TF-IDF + structured path, no network).
Output: tests/golden_recommendations.json — per-applicant ranked job order.
"""
import datetime
import json
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from resume_pipeline.recommendation.engine import run_pipeline_for_applicant_job
from resume_pipeline.recommendation.scorers.tfidf_scorer import TfidfScorer
from resume_pipeline.recommendation.scorers.semantic_scorer import SemanticScorer
from resume_pipeline.recommendation.scorers.personalization_scorer import PersonalizationScorer
from resume_pipeline.recommendation.scorers.temporal_scorer import TemporalScorer
from resume_pipeline.recommendation.scorers.document_scorer import DocumentScorer
from resume_pipeline.recommendation.embedder import GeminiEmbeddingUnavailable
from resume_pipeline.db import Applicant, LLMParsedRecord


class MockJob:
    def __init__(self, id, title, description, required_skills, location_city=None,
                 location_state=None, work_type="on-site", min_experience_years=0.0,
                 min_cgpa=None, created_at=None, applications=None, optional_skills=None,
                 employer_id=1):
        self.id = id
        self.title = title
        self.description = description
        self.required_skills = required_skills
        self.location_city = location_city
        self.location_state = location_state
        self.work_type = work_type
        self.min_experience_years = min_experience_years
        self.min_cgpa = min_cgpa
        self.created_at = created_at or datetime.datetime.utcnow()
        self.applications = applications or []
        self.optional_skills = optional_skills or []
        self.status = "approved"
        self.expires_at = None
        self.employer_id = employer_id
        self.meta = MagicMock()
        self.meta.tags = [title.split()[0].lower()]


JOBS = [
    MockJob(1, "Python Backend Developer", "Build REST APIs with Python Django PostgreSQL",
            [{"name": "Python"}, {"name": "Django"}, {"name": "PostgreSQL"}],
            "Bengaluru", "Karnataka", "on-site", 2.0),
    MockJob(2, "Frontend React Engineer", "React javascript css responsive UI work",
            [{"name": "React"}, {"name": "JavaScript"}, {"name": "CSS"}],
            "Mumbai", "Maharashtra", "hybrid", 1.0),
    MockJob(3, "ML Engineer", "Machine learning Python TensorFlow model training",
            [{"name": "Python"}, {"name": "Machine Learning"}, {"name": "TensorFlow"}],
            "Bengaluru", "Karnataka", "remote", 3.0),
    MockJob(4, "Java Spring Developer", "Java Spring Boot microservices backend",
            [{"name": "Java"}, {"name": "Spring"}, {"name": "SQL"}],
            "Delhi", "Delhi", "on-site", 2.0),
    MockJob(5, "Data Analyst", "SQL Excel dashboards Python pandas reporting",
            [{"name": "SQL"}, {"name": "Python"}, {"name": "Excel"}],
            "Chennai", "Tamil Nadu", "remote", 0.0),
    MockJob(6, "DevOps Engineer", "AWS Docker Kubernetes CI CD pipelines",
            [{"name": "AWS"}, {"name": "Docker"}, {"name": "Kubernetes"}],
            "Hyderabad", "Telangana", "hybrid", 2.0),
    MockJob(7, "Django Intern", "Learn Django REST Python internship",
            [{"name": "Python"}, {"name": "Django"}],
            "Kolkata", "West Bengal", "remote", 0.0),
    MockJob(8, "Full Stack Developer", "Python React PostgreSQL full stack web apps",
            [{"name": "Python"}, {"name": "React"}, {"name": "PostgreSQL"}],
            "Bengaluru", "Karnataka", "on-site", 1.0),
]

APPLICANTS = [
    {"id": 901, "name": "Python Backend Dev",
     "skills": [{"name": "Python"}, {"name": "Django"}, {"name": "PostgreSQL"}],
     "location": "Bengaluru, Karnataka",
     "experience": [{"title": "Backend Intern"}, {"title": "API Developer"}],
     "education": [{"degree": "B.Tech", "field": "CSE", "cgpa": 8.5}]},
    {"id": 902, "name": "Frontend Dev",
     "skills": [{"name": "React"}, {"name": "JavaScript"}, {"name": "CSS"}],
     "location": "Mumbai, Maharashtra",
     "experience": [{"title": "UI Intern"}],
     "education": [{"degree": "B.Sc", "field": "IT", "cgpa": 7.8}]},
    {"id": 903, "name": "ML Aspirant",
     "skills": [{"name": "Python"}, {"name": "Machine Learning"}],
     "location": "Delhi, Delhi",
     "experience": [],
     "education": [{"degree": "M.Tech", "field": "AI", "cgpa": 9.0}]},
]


def make_applicant(spec):
    app = MagicMock(spec=Applicant)
    app.id = spec["id"]
    app.display_name = spec["name"]
    app.location_city = spec["location"].split(",")[0].strip()
    app.location_state = spec["location"].split(",")[1].strip()
    rec = MagicMock(spec=LLMParsedRecord)
    rec.normalized = {
        "personal": {"name": spec["name"], "location": spec["location"]},
        "skills": spec["skills"],
        "experience": spec["experience"],
        "education": spec["education"],
    }
    app.parsed_record = rec
    return app


class FailingEmbedder:
    """Embedder stub that always raises -> forces deterministic TF-IDF fallback."""

    def get_applicant_embedding(self, *a, **k):
        raise GeminiEmbeddingUnavailable("golden: embeddings disabled")

    def get_job_embedding(self, *a, **k):
        raise GeminiEmbeddingUnavailable("golden: embeddings disabled")

    def embed(self, *a, **k):
        raise GeminiEmbeddingUnavailable("golden: embeddings disabled")

    @staticmethod
    def cosine_similarity(v1, v2):
        return 0.0


def main():
    tfidf = TfidfScorer()
    tfidf.build_corpus(JOBS)
    embedder = FailingEmbedder()
    sem = SemanticScorer(embedder)
    doc = DocumentScorer(embedder)
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

    golden = {"generated_by": "golden_capture.py (pre-refactor full ranking)",
              "embedding_mode": "forced_fallback_tfidf_only",
              "applicants": []}
    for spec in APPLICANTS:
        applicant = make_applicant(spec)
        pers = PersonalizationScorer(mock_db)
        pers.preload_preferences = MagicMock()
        temp = TemporalScorer()
        scored = []
        for job in JOBS:
            breakdown = run_pipeline_for_applicant_job(
                applicant=applicant, job=job, db=mock_db,
                tfidf_scorer=tfidf, embedder=embedder,
                semantic_scorer=sem, personalization_scorer=pers,
                temporal_scorer=temp, document_scorer=doc,
                interview_score=None)
            scored.append({"job_id": job.id, "score": breakdown["final_score"],
                           "breakdown": breakdown})
        scored.sort(key=lambda x: x["score"], reverse=True)
        golden["applicants"].append({
            "applicant_id": spec["id"], "name": spec["name"],
            "ranked": [{"job_id": s["job_id"], "score": s["score"]} for s in scored],
            "full": scored,
        })

    out = Path(__file__).parent.parent / "tests" / "golden_recommendations.json"
    out.write_text(json.dumps(golden, indent=2))
    for a in golden["applicants"]:
        order = [(r["job_id"], r["score"]) for r in a["ranked"]]
        print(f"applicant {a['applicant_id']} ({a['name']}): {order}")
    print(f"saved -> {out}")


if __name__ == "__main__":
    main()
