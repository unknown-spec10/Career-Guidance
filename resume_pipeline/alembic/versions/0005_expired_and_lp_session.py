"""Widen job_status enum with 'expired' + add LearningPath.source_session_id type fix.

Revision ID: 0005_expired_and_lp_session
Revises: 0004_answer_eval_attempts
Create Date: 2026-08-22

Two additive changes:
1. job_status enum gains 'expired' (job expiry sweeper transitions approved
   jobs whose expires_at has passed).
2. learning_paths.source_session_id becomes String(36): v2 interview session
   ids are UUIDs and never fit the legacy Integer column. Existing integer
   values are cast to text (lossless); NULLs are unaffected.
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "0005_expired_and_lp_session"
down_revision: Union[str, None] = "0004_answer_eval_attempts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    # --- 1. widen job_status enum -----------------------------------------
    type_exists = bind.execute(
        text("SELECT 1 FROM pg_type WHERE typname = 'job_status'")
    ).scalar()
    if type_exists:
        existing = {
            row[0] for row in bind.execute(
                text("SELECT e.enumlabel FROM pg_enum e "
                     "JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'job_status'")
            ).fetchall()
        }
        if 'expired' not in existing:
            bind.execute(text("ALTER TYPE job_status ADD VALUE 'expired'"))

    # --- 2. learning_paths.source_session_id Integer -> String(36) --------
    col = bind.execute(
        text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name = 'learning_paths' AND column_name = 'source_session_id'"
        )
    ).scalar()
    if col == 'integer':
        bind.execute(text(
            "ALTER TABLE learning_paths "
            "ALTER COLUMN source_session_id TYPE VARCHAR(36) "
            "USING source_session_id::text"
        ))


def downgrade() -> None:
    # Enum values cannot be removed; the column type change is not reversed
    # because casting UUID strings back to integers would truncate/lose data.
    pass

