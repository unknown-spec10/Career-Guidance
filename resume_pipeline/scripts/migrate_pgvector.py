"""
migrate_pgvector.py
-------------------
Priority 0 migration for the resume parse pipeline redesign.

Applies the following schema changes (idempotent — safe to run multiple times):
  1. Ensures the 'vector' PostgreSQL extension is enabled.
  2. Adds `embedding vector(768)` column to `canonical_skills` (if missing).
  3. Creates HNSW index on `canonical_skills.embedding` (if missing).
  4. Adds `unrecognized_skills JSONB` column to `llm_parsed_records` (if missing).
  5. Adds `parse_status VARCHAR(32)` column to `llm_parsed_records` (if missing).

Run from repo root (with venv active):
    python scripts/migrate_pgvector.py

Run from resume_pipeline/ directory:
    python -m scripts.migrate_pgvector
"""

import os
import sys
from pathlib import Path

# Ensure resume_pipeline package is importable when run as a script
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Load settings via the package (handles .env loading)
from resume_pipeline.config import settings

import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("migrate_pgvector")


def get_connection() -> psycopg2.extensions.connection:
    """Create a raw psycopg2 connection (DDL needs autocommit for some ops)."""
    return psycopg2.connect(
        host=settings.PG_HOST or "localhost",
        port=settings.PG_PORT or 5432,
        user=settings.PG_USER or "postgres",
        password=settings.PG_PASSWORD or "",
        dbname=settings.PG_DB or "resumes",
    )


def column_exists(cur: psycopg2.extensions.cursor, table: str, column: str) -> bool:
    cur.execute(
        """
        SELECT 1 FROM information_schema.columns
        WHERE table_name = %s AND column_name = %s
        """,
        (table, column),
    )
    return cur.fetchone() is not None


def index_exists(cur: psycopg2.extensions.cursor, index_name: str) -> bool:
    cur.execute(
        "SELECT 1 FROM pg_indexes WHERE indexname = %s",
        (index_name,),
    )
    return cur.fetchone() is not None


def extension_enabled(cur: psycopg2.extensions.cursor, extname: str) -> bool:
    cur.execute(
        "SELECT 1 FROM pg_extension WHERE extname = %s",
        (extname,),
    )
    return cur.fetchone() is not None


def run_migration() -> None:
    conn = get_connection()
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    # ------------------------------------------------------------------ #
    # Step 1: Enable pgvector extension
    # ------------------------------------------------------------------ #
    if not extension_enabled(cur, "vector"):
        logger.info("Enabling pgvector extension...")
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        logger.info("✓ pgvector extension enabled")
    else:
        logger.info("✓ pgvector extension already enabled (skipped)")

    # ------------------------------------------------------------------ #
    # Step 2: Add embedding column to canonical_skills
    # ------------------------------------------------------------------ #
    if not column_exists(cur, "canonical_skills", "embedding"):
        logger.info("Adding embedding Vector(768) to canonical_skills...")
        cur.execute("ALTER TABLE canonical_skills ADD COLUMN embedding vector(768);")
        logger.info("✓ canonical_skills.embedding added")
    else:
        logger.info("✓ canonical_skills.embedding already exists (skipped)")

    # ------------------------------------------------------------------ #
    # Step 3: Create HNSW index on canonical_skills.embedding
    # ------------------------------------------------------------------ #
    idx_name = "idx_canonical_skills_embedding_hnsw"
    if not index_exists(cur, idx_name):
        logger.info("Creating HNSW index on canonical_skills.embedding...")
        cur.execute(
            f"CREATE INDEX {idx_name} ON canonical_skills "
            "USING hnsw (embedding vector_cosine_ops);"
        )
        logger.info("✓ HNSW index created")
    else:
        logger.info("✓ HNSW index already exists (skipped)")

    # ------------------------------------------------------------------ #
    # Step 4: Add unrecognized_skills JSONB to llm_parsed_records
    # ------------------------------------------------------------------ #
    if not column_exists(cur, "llm_parsed_records", "unrecognized_skills"):
        logger.info("Adding unrecognized_skills JSONB to llm_parsed_records...")
        cur.execute(
            "ALTER TABLE llm_parsed_records "
            "ADD COLUMN unrecognized_skills JSONB DEFAULT '[]'::jsonb;"
        )
        logger.info("✓ llm_parsed_records.unrecognized_skills added")
    else:
        logger.info("✓ llm_parsed_records.unrecognized_skills already exists (skipped)")

    # ------------------------------------------------------------------ #
    # Step 5: Add parse_status VARCHAR to llm_parsed_records
    # ------------------------------------------------------------------ #
    if not column_exists(cur, "llm_parsed_records", "parse_status"):
        logger.info("Adding parse_status to llm_parsed_records...")
        cur.execute(
            "ALTER TABLE llm_parsed_records "
            "ADD COLUMN parse_status VARCHAR(32) DEFAULT 'accepted';"
        )
        logger.info("✓ llm_parsed_records.parse_status added")
    else:
        logger.info("✓ llm_parsed_records.parse_status already exists (skipped)")

    # ------------------------------------------------------------------ #
    # Step 6: Add per_section_confidence JSONB to llm_parsed_records
    # ------------------------------------------------------------------ #
    if not column_exists(cur, "llm_parsed_records", "per_section_confidence"):
        logger.info("Adding per_section_confidence JSONB to llm_parsed_records...")
        cur.execute(
            "ALTER TABLE llm_parsed_records "
            "ADD COLUMN per_section_confidence JSONB DEFAULT '{}'::jsonb;"
        )
        logger.info("✓ llm_parsed_records.per_section_confidence added")
    else:
        logger.info("✓ llm_parsed_records.per_section_confidence already exists (skipped)")

    cur.close()
    conn.close()

    logger.info("")
    logger.info("=" * 60)
    logger.info("Migration complete. Run seed_skill_embeddings.py next.")
    logger.info("=" * 60)


if __name__ == "__main__":
    run_migration()
