#!/usr/bin/env python3
"""Create/upgrade recommendation storage objects for recommendation system redesign.

This script is idempotent and safe to run multiple times.
"""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent.parent))

from resume_pipeline.db import engine  # noqa: E402


DDL_STATEMENTS = [
    # Alter job_recommendations to add score_breakdown, explanation, computed_at, engine_version
    "ALTER TABLE job_recommendations ADD COLUMN IF NOT EXISTS score_breakdown JSONB",
    "ALTER TABLE job_recommendations ADD COLUMN IF NOT EXISTS explanation TEXT",
    "ALTER TABLE job_recommendations ADD COLUMN IF NOT EXISTS computed_at TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE job_recommendations ADD COLUMN IF NOT EXISTS engine_version VARCHAR(10) DEFAULT 'v2'",

    # Create user_feedback table
    "CREATE TABLE IF NOT EXISTS user_feedback ("
    "id SERIAL PRIMARY KEY, "
    "applicant_id INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE, "
    "job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, "
    "action_type VARCHAR(20) NOT NULL, "
    "timestamp TIMESTAMP DEFAULT NOW()"
    ")",
    "CREATE INDEX IF NOT EXISTS idx_feedback_applicant ON user_feedback(applicant_id)",

    # Create job_embeddings_cache table
    "CREATE TABLE IF NOT EXISTS job_embeddings_cache ("
    "job_id INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE, "
    "embedding JSONB NOT NULL, "
    "computed_at TIMESTAMP DEFAULT NOW()"
    ")",
]


def main() -> None:
    print("Starting database migration for redesigned recommendation system...")
    with engine.begin() as conn:
        for stmt in DDL_STATEMENTS:
            try:
                conn.execute(text(stmt))
                print(f"OK: {stmt}")
            except Exception as exc:
                print(f"ERROR: {stmt} -> {exc}")

    print("Recommendation system database migration complete.")


if __name__ == "__main__":
    main()
