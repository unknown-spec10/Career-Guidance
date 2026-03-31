#!/usr/bin/env python3
"""Refresh seeded recruiter/job content with richer descriptions."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from resume_pipeline.db import Job, SessionLocal  # noqa: E402


DESCRIPTION_SNIPPETS = {
    "Backend": "Build APIs, improve system reliability, and ship production-grade services.",
    "Frontend": "Design responsive interfaces, improve UX, and ship polished product flows.",
    "Full Stack": "Own features end to end across API, UI, and deployment workflows.",
    "Data": "Work with analytics pipelines, dashboards, and reporting workflows.",
    "Machine Learning": "Train, evaluate, and productionize ML workflows with measurable outcomes.",
}


def enrich_description(title: str) -> str:
    for key, value in DESCRIPTION_SNIPPETS.items():
        if key.lower() in title.lower():
            return value
    return "Collaborate with a product-minded engineering team on real user problems."


def main():
    db = SessionLocal()
    try:
        jobs = db.query(Job).all()
        for job in jobs:
            job.description = enrich_description(job.title or "")
        db.commit()
        print(f"Updated {len(jobs)} jobs")
    finally:
        db.close()


if __name__ == "__main__":
    main()