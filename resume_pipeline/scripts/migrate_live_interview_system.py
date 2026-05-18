#!/usr/bin/env python3
"""Create/upgrade Live Interview storage objects.

This migration is idempotent and safe to run multiple times.
"""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent.parent))

from resume_pipeline.db import engine  # noqa: E402


DDL_STATEMENTS = [
    # Enum type used by interview_live_sessions.status
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE t.typname = 'live_session_status' AND n.nspname = current_schema()
        ) THEN
            CREATE TYPE live_session_status AS ENUM ('created', 'active', 'paused', 'completed', 'failed');
        END IF;
    END
    $$;
    """,
    # Main table
    """
    CREATE TABLE IF NOT EXISTS interview_live_sessions (
        id SERIAL PRIMARY KEY,
        applicant_id INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
        session_type VARCHAR(64) DEFAULT 'technical',
        difficulty_level VARCHAR(32) DEFAULT 'medium',
        status live_session_status DEFAULT 'created',
        started_at TIMESTAMP DEFAULT NOW(),
        ends_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        duration_seconds INTEGER NULL,
        credits_used INTEGER DEFAULT 0,
        user_transcript TEXT NULL,
        model_transcript TEXT NULL,
        notes JSONB NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    )
    """,
    # Add/upgrade columns for pre-existing partial tables
    "ALTER TABLE interview_live_sessions ADD COLUMN IF NOT EXISTS session_type VARCHAR(64) DEFAULT 'technical'",
    "ALTER TABLE interview_live_sessions ADD COLUMN IF NOT EXISTS difficulty_level VARCHAR(32) DEFAULT 'medium'",
    "ALTER TABLE interview_live_sessions ADD COLUMN IF NOT EXISTS status live_session_status DEFAULT 'created'",
    "ALTER TABLE interview_live_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE interview_live_sessions ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP NULL",
    "ALTER TABLE interview_live_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL",
    "ALTER TABLE interview_live_sessions ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NULL",
    "ALTER TABLE interview_live_sessions ADD COLUMN IF NOT EXISTS credits_used INTEGER DEFAULT 0",
    "ALTER TABLE interview_live_sessions ADD COLUMN IF NOT EXISTS user_transcript TEXT NULL",
    "ALTER TABLE interview_live_sessions ADD COLUMN IF NOT EXISTS model_transcript TEXT NULL",
    "ALTER TABLE interview_live_sessions ADD COLUMN IF NOT EXISTS notes JSONB NULL",
    "ALTER TABLE interview_live_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE interview_live_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
    # Indexes
    "CREATE INDEX IF NOT EXISTS idx_live_sessions_applicant_id ON interview_live_sessions(applicant_id)",
    "CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON interview_live_sessions(status)",
    "CREATE INDEX IF NOT EXISTS idx_live_sessions_started_at ON interview_live_sessions(started_at)",
    "CREATE INDEX IF NOT EXISTS idx_live_sessions_session_type ON interview_live_sessions(session_type)",
]


VERIFY_SQL = """
SELECT
    EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_name = 'interview_live_sessions'
    ) AS has_table,
    EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'live_session_status' AND n.nspname = current_schema()
    ) AS has_enum
"""


def main() -> None:
    print("Starting live interview migration...")

    with engine.begin() as conn:
        for stmt in DDL_STATEMENTS:
            conn.execute(text(stmt))

        result = conn.execute(text(VERIFY_SQL)).mappings().first()

    has_table = bool(result["has_table"]) if result else False
    has_enum = bool(result["has_enum"]) if result else False

    if not has_table or not has_enum:
        raise RuntimeError(
            f"Migration verification failed: has_table={has_table}, has_enum={has_enum}"
        )

    print("Live interview migration complete: table and enum verified.")


if __name__ == "__main__":
    main()
