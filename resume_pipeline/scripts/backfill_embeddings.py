#!/usr/bin/env python3
"""Queue backfill embedding tasks for existing applicants and jobs."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from resume_pipeline.db import Applicant, Job, LLMParsedRecord, SessionLocal  # noqa: E402
from resume_pipeline.embedding_tasks import (  # noqa: E402
    generate_job_embedding_task,
    generate_resume_embedding_task,
)


def queue_jobs(limit: int, offset: int) -> int:
    db = SessionLocal()
    try:
        jobs = db.query(Job).filter(Job.status == 'approved').order_by(Job.id.asc()).offset(offset).limit(limit).all()
        for job in jobs:
            generate_job_embedding_task.delay(job.id)
        return len(jobs)
    finally:
        db.close()


def queue_applicants(limit: int, offset: int) -> int:
    db = SessionLocal()
    try:
        applicants = db.query(Applicant).join(
            LLMParsedRecord, Applicant.id == LLMParsedRecord.applicant_id
        ).order_by(Applicant.id.asc()).offset(offset).limit(limit).all()
        for applicant in applicants:
            generate_resume_embedding_task.delay(applicant.id)
        return len(applicants)
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill applicant/job embeddings by queueing Celery tasks")
    parser.add_argument("--limit", type=int, default=500)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--mode", choices=["all", "jobs", "applicants"], default="all")
    args = parser.parse_args()

    limit = max(1, min(args.limit, 5000))
    offset = max(0, args.offset)

    queued_jobs = 0
    queued_applicants = 0

    if args.mode in ("all", "jobs"):
        queued_jobs = queue_jobs(limit=limit, offset=offset)
    if args.mode in ("all", "applicants"):
        queued_applicants = queue_applicants(limit=limit, offset=offset)

    print(
        {
            "status": "queued",
            "mode": args.mode,
            "limit": limit,
            "offset": offset,
            "queued_jobs": queued_jobs,
            "queued_applicants": queued_applicants,
        }
    )


if __name__ == "__main__":
    main()
