#!/usr/bin/env python3
"""Quick verification script for the student + recruiter data model."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from resume_pipeline.db import (  # noqa: E402
    Applicant,
    Employer,
    Job,
    JobApplication,
    JobRecommendation,
    SessionLocal,
    User,
)


def main():
    db = SessionLocal()
    try:
        print("COUNTS")
        print(f"Users: {db.query(User).count()}")
        print(f"Students: {db.query(Applicant).count()}")
        print(f"Recruiters: {db.query(Employer).count()}")
        print(f"Jobs: {db.query(Job).count()}")
        print(f"Job Recommendations: {db.query(JobRecommendation).count()}")
        print(f"Job Applications: {db.query(JobApplication).count()}")

        print("\nSAMPLE JOBS")
        for job in db.query(Job).limit(5).all():
            print(f"- {job.title} | {job.location_city} | status={job.status}")

        print("\nSAMPLE RECOMMENDATIONS")
        for rec in db.query(JobRecommendation).limit(5).all():
            print(f"- applicant={rec.applicant_id} job={rec.job_id} score={rec.score}")
    finally:
        db.close()


if __name__ == "__main__":
    main()