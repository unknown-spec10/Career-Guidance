#!/usr/bin/env python3
"""
Database migration script to add source tracking and verification fields to college tables.
Uses SQLAlchemy with PostgreSQL. Since the project uses wipe+recreate (init_db.py),
this script is a historical one-off helper for incremental schema updates on existing DBs.
"""

import sys
import argparse
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from resume_pipeline.config import settings

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def migrate_postgres():
    """Add columns to PostgreSQL tables for source tracking and verification"""
    logger.info("Starting PostgreSQL schema migration...")

    if not settings.PG_DSN:
        raise RuntimeError("PG_DSN is not set")

    engine = create_engine(settings.PG_DSN)

    # Migration SQL statements (PostgreSQL-compatible)
    # Note: PostgreSQL does not support AFTER <col>; new columns are always appended.
    # Note: ON UPDATE is handled by SQLAlchemy's Python-side onupdate= instead.
    migrations = [
        # College table additions
        "ALTER TABLE colleges ADD COLUMN IF NOT EXISTS collection_status VARCHAR(20) DEFAULT 'draft'",
        "ALTER TABLE colleges ADD COLUMN IF NOT EXISTS submitted_by INT",
        "ALTER TABLE colleges ADD COLUMN IF NOT EXISTS submitted_date TIMESTAMP",
        "ALTER TABLE colleges ADD COLUMN IF NOT EXISTS approved_by INT",
        "ALTER TABLE colleges ADD COLUMN IF NOT EXISTS approved_date TIMESTAMP",
        "ALTER TABLE colleges ADD COLUMN IF NOT EXISTS rejection_reason TEXT",
        "ALTER TABLE colleges ADD COLUMN IF NOT EXISTS data_sources JSON",
        "ALTER TABLE colleges ADD COLUMN IF NOT EXISTS data_freshness_flag VARCHAR(50)",
        "ALTER TABLE colleges ADD COLUMN IF NOT EXISTS last_verification_date TIMESTAMP",
        "CREATE INDEX IF NOT EXISTS idx_collection_status ON colleges(collection_status)",

        # CollegeEligibility table additions
        "ALTER TABLE college_eligibility ADD COLUMN IF NOT EXISTS min_jee_rank_source VARCHAR(512)",
        "ALTER TABLE college_eligibility ADD COLUMN IF NOT EXISTS min_cgpa_source VARCHAR(512)",
        "ALTER TABLE college_eligibility ADD COLUMN IF NOT EXISTS seats_source VARCHAR(512)",
        "ALTER TABLE college_eligibility ADD COLUMN IF NOT EXISTS eligible_degrees_source VARCHAR(512)",
        "ALTER TABLE college_eligibility ADD COLUMN IF NOT EXISTS min_jee_rank_verified BOOLEAN DEFAULT FALSE",
        "ALTER TABLE college_eligibility ADD COLUMN IF NOT EXISTS min_cgpa_verified BOOLEAN DEFAULT FALSE",
        "ALTER TABLE college_eligibility ADD COLUMN IF NOT EXISTS seats_verified BOOLEAN DEFAULT FALSE",
        "ALTER TABLE college_eligibility ADD COLUMN IF NOT EXISTS eligible_degrees_verified BOOLEAN DEFAULT FALSE",
        "ALTER TABLE college_eligibility ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE college_eligibility ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",

        # CollegeProgram table additions
        "ALTER TABLE college_programs ADD COLUMN IF NOT EXISTS program_description_source VARCHAR(512)",
        "ALTER TABLE college_programs ADD COLUMN IF NOT EXISTS duration_months_source VARCHAR(512)",
        "ALTER TABLE college_programs ADD COLUMN IF NOT EXISTS required_skills_source VARCHAR(512)",
        "ALTER TABLE college_programs ADD COLUMN IF NOT EXISTS program_description_verified BOOLEAN DEFAULT FALSE",
        "ALTER TABLE college_programs ADD COLUMN IF NOT EXISTS duration_months_verified BOOLEAN DEFAULT FALSE",
        "ALTER TABLE college_programs ADD COLUMN IF NOT EXISTS required_skills_verified BOOLEAN DEFAULT FALSE",

        # CollegeMetadata table additions
        "ALTER TABLE college_metadata ADD COLUMN IF NOT EXISTS canonical_skills_source VARCHAR(512)",
        "ALTER TABLE college_metadata ADD COLUMN IF NOT EXISTS popularity_score_source VARCHAR(512)",
        "ALTER TABLE college_metadata ADD COLUMN IF NOT EXISTS canonical_skills_verified BOOLEAN DEFAULT FALSE",
        "ALTER TABLE college_metadata ADD COLUMN IF NOT EXISTS popularity_score_verified BOOLEAN DEFAULT FALSE",
    ]

    success_count = 0
    fail_count = 0
    with engine.begin() as conn:
        for i, sql in enumerate(migrations, 1):
            try:
                conn.execute(text(sql))
                logger.info(f"✓ Migration {i}/{len(migrations)} applied")
                success_count += 1
            except Exception as e:
                logger.warning(f"✗ Migration {i}/{len(migrations)} failed: {e}")
                fail_count += 1

    if fail_count == 0:
        logger.info("✅ PostgreSQL migration completed successfully!")
    else:
        logger.warning(f"⚠️ Migration completed with {fail_count} failure(s) — check logs above")

    return fail_count == 0


def main():
    parser = argparse.ArgumentParser(description="Migrate college schema for source tracking")
    parser.add_argument('--env', choices=['postgres'], default='postgres',
                        help='Database backend to migrate (only postgres is supported)')

    args = parser.parse_args()
    success = migrate_postgres()
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
