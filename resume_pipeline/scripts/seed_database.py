#!/usr/bin/env python3
"""Seed the database with student, recruiter, and job sample data."""

import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from resume_pipeline.auth import get_password_hash
from resume_pipeline.db import (  # noqa: E402
    Applicant,
    Employer,
    Job,
    JobApplication,
    JobRecommendation,
    LLMParsedRecord,
    SessionLocal,
    Upload,
    User,
)


STUDENTS = [
    ("Aarav Sharma", "aarav.sharma@example.com", "Bangalore"),
    ("Diya Patel", "diya.patel@example.com", "Pune"),
    ("Rohan Gupta", "rohan.gupta@example.com", "Delhi"),
    ("Meera Nair", "meera.nair@example.com", "Chennai"),
]

RECRUITERS = [
    ("Google Hiring", "hiring@google.example", "Google", "Bangalore"),
    ("Microsoft Careers", "careers@microsoft.example", "Microsoft", "Hyderabad"),
    ("Amazon Talent", "talent@amazon.example", "Amazon", "Pune"),
]

SKILL_SETS = [
    ["Python", "FastAPI", "PostgreSQL", "Docker"],
    ["React", "JavaScript", "CSS", "Vite"],
    ["Java", "Spring Boot", "SQL", "AWS"],
    ["Machine Learning", "Python", "Pandas", "scikit-learn"],
]

JOB_TITLES = [
    "Backend Engineer",
    "Frontend Engineer",
    "Full Stack Developer",
    "Data Analyst",
    "Machine Learning Engineer",
]


def ensure_user(db, email: str, password: str, role: str, name: str) -> User:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return existing

    user = User(
        email=email,
        password_hash=get_password_hash(password),
        role=role,
        name=name,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def ensure_applicant(db, user: User, location_city: str) -> Applicant:
    applicant = db.query(Applicant).filter(Applicant.user_id == user.id).first()
    if applicant:
        return applicant

    applicant = Applicant(
        user_id=user.id,
        applicant_id=f"app_{user.id:04d}",
        display_name=user.name,
        location_city=location_city,
        location_state="",
        country="India",
        preferred_locations=[location_city, "Remote"],
    )
    db.add(applicant)
    db.commit()
    db.refresh(applicant)
    return applicant


def ensure_resume_artifacts(db, applicant: Applicant, skill_names):
    upload = db.query(Upload).filter(Upload.applicant_id == applicant.id).first()
    if not upload:
        db.add(
            Upload(
                applicant_id=applicant.id,
                file_name=f"{applicant.applicant_id}_resume.txt",
                file_type="resume",
                storage_path=f"./data/raw_files/{applicant.applicant_id}/resume.txt",
                file_hash=f"seed-{applicant.applicant_id}",
                ocr_used=False,
            )
        )

    parsed = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == applicant.id).first()
    normalized = {
        "personal": {"name": applicant.display_name, "location": applicant.location_city},
        "education": [{"degree": "B.Tech", "grade": round(random.uniform(7.0, 9.4), 2)}],
        "skills": [{"name": skill} for skill in skill_names],
        "projects": [
            {"name": "Portfolio Project", "technologies": skill_names[:3]},
            {"name": "API Service", "technologies": skill_names[-3:]},
        ],
        "experience": [],
        "certifications": [{"name": f"{skill_names[0]} Fundamentals"}],
    }

    if parsed:
        parsed.normalized = normalized  # type: ignore[assignment]
        parsed.raw_llm_output = normalized  # type: ignore[assignment]
        parsed.needs_review = False  # type: ignore[assignment]
    else:
        db.add(
            LLMParsedRecord(
                applicant_id=applicant.id,
                raw_llm_output=normalized,
                normalized=normalized,
                field_confidences={"skills": 0.95},
                llm_provenance={"provider": "seed", "model": "static"},
                needs_review=False,
            )
        )

    db.commit()


def ensure_employer(db, user: User, company_name: str, location_city: str) -> Employer:
    employer = db.query(Employer).filter(Employer.user_id == user.id).first()
    if employer:
        return employer

    employer = Employer(
        user_id=user.id,
        company_name=company_name,
        website=f"https://{company_name.lower()}.example.com",
        location_city=location_city,
        location_state="",
        description=f"{company_name} recruiting team",
        is_verified=True,
    )
    db.add(employer)
    db.commit()
    db.refresh(employer)
    return employer


def ensure_jobs(db, employers):
    created_jobs = []
    for index, employer in enumerate(employers):
        existing = db.query(Job).filter(Job.employer_id == employer.id).all()
        if existing:
            created_jobs.extend(existing)
            continue

        for offset in range(2):
            skills = SKILL_SETS[(index + offset) % len(SKILL_SETS)]
            job = Job(
                employer_id=employer.id,
                title=JOB_TITLES[(index + offset) % len(JOB_TITLES)],
                description=f"Work on production systems at {employer.company_name}.",
                location_city=employer.location_city,
                location_state="",
                work_type=random.choice(["remote", "hybrid", "on-site"]),
                min_experience_years=random.choice([0, 1, 2]),
                min_cgpa=round(random.uniform(6.5, 8.0), 1),
                required_skills=skills,
                optional_skills=skills[:2],
                status="approved",
                expires_at=datetime.utcnow() + timedelta(days=45),
            )
            db.add(job)
            db.flush()
            created_jobs.append(job)

    db.commit()
    return created_jobs


def seed_recommendations_and_applications(db, applicants, jobs):
    for applicant in applicants:
        sample_jobs = random.sample(jobs, min(3, len(jobs)))
        for rank, job in enumerate(sample_jobs, start=1):
            recommendation = db.query(JobRecommendation).filter(
                JobRecommendation.applicant_id == applicant.id,
                JobRecommendation.job_id == job.id,
            ).first()
            if not recommendation:
                db.add(
                    JobRecommendation(
                        applicant_id=applicant.id,
                        job_id=job.id,
                        score=82 - rank * 6,
                        scoring_breakdown={"skills_score": 0.82, "location_score": 0.75},
                        explain={"reason": "Seeded recommendation"},
                        status="recommended",
                    )
                )

        applied_job = sample_jobs[0] if sample_jobs else None
        if applied_job:
            application = db.query(JobApplication).filter(
                JobApplication.applicant_id == applicant.id,
                JobApplication.job_id == applied_job.id,
            ).first()
            if not application:
                db.add(
                    JobApplication(
                        applicant_id=applicant.id,
                        job_id=applied_job.id,
                        cover_letter="Interested in contributing to your engineering team.",
                        status=random.choice(["applied", "under_review", "shortlisted"]),
                    )
                )

    db.commit()


def main():
    db = SessionLocal()
    try:
        admin = ensure_user(db, "admin@example.com", "admin123", "admin", "Platform Admin")
        print(f"Admin ready: {admin.email}")

        applicants = []
        for index, (name, email, city) in enumerate(STUDENTS):
            user = ensure_user(db, email, "student123", "student", name)
            applicant = ensure_applicant(db, user, city)
            ensure_resume_artifacts(db, applicant, SKILL_SETS[index % len(SKILL_SETS)])
            applicants.append(applicant)

        employers = []
        for name, email, company, city in RECRUITERS:
            user = ensure_user(db, email, "recruiter123", "employer", name)
            employers.append(ensure_employer(db, user, company, city))

        jobs = ensure_jobs(db, employers)
        seed_recommendations_and_applications(db, applicants, jobs)

        print("Seed complete")
        print(f"Students: {len(applicants)}")
        print(f"Recruiters: {len(employers)}")
        print(f"Jobs: {db.query(Job).count()}")
        print(f"Job recommendations: {db.query(JobRecommendation).count()}")
        print(f"Job applications: {db.query(JobApplication).count()}")
    finally:
        db.close()


if __name__ == "__main__":
    main()