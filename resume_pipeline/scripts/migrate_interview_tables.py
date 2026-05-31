"""
Migration script: Drop old interview tables and recreate with v2 schema.

Run this ONCE against Supabase or local PostgreSQL.
It drops: interview_live_sessions, interview_answers, interview_questions, interview_sessions
Then recreates: interview_sessions, interview_questions, interview_answers (v2 UUID schema)

Usage (from resume_pipeline/ with venv active):
    python scripts/migrate_interview_tables.py

DANGER: All existing interview data will be permanently lost.
"""
import sys
import os

# Add parent to path so we can import the package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from resume_pipeline.db import engine, Base
from resume_pipeline.db import (
    InterviewSession,
    InterviewQuestion,
    InterviewAnswer,
)
from sqlalchemy import text, inspect

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def confirm(prompt: str) -> bool:
    answer = input(f"{prompt} [yes/no]: ").strip().lower()
    return answer == "yes"


def migrate():
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    print("\n" + "=" * 60)
    print("Interview System v2 — Database Migration")
    print("=" * 60)
    print("\nThis will DROP the following tables (ALL DATA LOST):")
    tables_to_drop = [
        "interview_live_sessions",
        "interview_answers",
        "interview_questions",
        "interview_sessions",
    ]
    for t in tables_to_drop:
        exists = "[OK] exists" if t in existing_tables else "[Not Found] (will skip)"
        print(f"  - {t}  {exists}")

    print("\nAnd recreate:")
    print("  - interview_sessions   (UUID PK, new schema)")
    print("  - interview_questions  (UUID PK, new schema)")
    print("  - interview_answers    (UUID PK, new schema)")
    print()

    if not confirm("Are you sure you want to proceed?"):
        print("Aborted.")
        sys.exit(0)

    with engine.begin() as conn:
        # Drop in FK-safe order
        for table in tables_to_drop:
            if table in existing_tables:
                logger.info("Dropping table: %s", table)
                conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
            else:
                logger.info("Table %s not found, skipping.", table)

        # Drop ENUMs that may conflict with new schema
        old_enums = [
            "interview_type",          # session_type enum
            "session_mode",
            "session_status",
            "difficulty_level",
            "question_type",
            "live_session_status",
        ]
        for enum_name in old_enums:
            try:
                conn.execute(text(f"DROP TYPE IF EXISTS {enum_name} CASCADE"))
                logger.info("Dropped ENUM: %s", enum_name)
            except Exception as e:
                logger.warning("Could not drop ENUM %s: %s", enum_name, e)

    logger.info("Old tables dropped. Creating v2 schema...")

    # Create only the interview tables (other tables already exist)
    interview_tables = [
        InterviewSession.__table__,
        InterviewQuestion.__table__,
        InterviewAnswer.__table__,
    ]
    Base.metadata.create_all(bind=engine, tables=interview_tables)
    logger.info("v2 interview tables created successfully.")

    print("\nMigration complete!")
    print("   New tables: interview_sessions, interview_questions, interview_answers")
    print("   Dropped: interview_live_sessions (live interview feature removed)")


if __name__ == "__main__":
    migrate()
