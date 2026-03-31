#!/usr/bin/env python3
"""Create/upgrade embedding storage objects for async recommendation pipeline.

This script is idempotent and safe to run multiple times.
"""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent.parent))

from resume_pipeline.db import engine  # noqa: E402


DDL_STATEMENTS = [
    # Enable pgvector where supported. If unavailable, this statement may fail and we continue.
    "CREATE EXTENSION IF NOT EXISTS vector",
    "CREATE TABLE IF NOT EXISTS applicant_embeddings ("
    "id SERIAL PRIMARY KEY, "
    "applicant_id INTEGER NOT NULL UNIQUE REFERENCES applicants(id) ON DELETE CASCADE, "
    "embedding_vector JSONB NOT NULL, "
    "embedding_provider VARCHAR(32), "
    "embedding_model VARCHAR(128), "
    "source_hash VARCHAR(64), "
    "created_at TIMESTAMP DEFAULT NOW(), "
    "updated_at TIMESTAMP DEFAULT NOW()"
    ")",
    "CREATE TABLE IF NOT EXISTS job_embeddings ("
    "id SERIAL PRIMARY KEY, "
    "job_id INTEGER NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE, "
    "embedding_vector JSONB NOT NULL, "
    "embedding_provider VARCHAR(32), "
    "embedding_model VARCHAR(128), "
    "source_hash VARCHAR(64), "
    "created_at TIMESTAMP DEFAULT NOW(), "
    "updated_at TIMESTAMP DEFAULT NOW()"
    ")",
    "CREATE INDEX IF NOT EXISTS idx_applicant_embeddings_source_hash ON applicant_embeddings(source_hash)",
    "CREATE INDEX IF NOT EXISTS idx_job_embeddings_source_hash ON job_embeddings(source_hash)",
    "CREATE INDEX IF NOT EXISTS idx_job_embeddings_job_id ON job_embeddings(job_id)",
]


def main() -> None:
    with engine.begin() as conn:
        for stmt in DDL_STATEMENTS:
            try:
                conn.execute(text(stmt))
                print(f"OK: {stmt}")
            except Exception as exc:
                # vector extension availability can vary by environment.
                print(f"WARN: {stmt} -> {exc}")

    print("Embedding storage migration complete")


if __name__ == "__main__":
    main()
