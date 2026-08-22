"""Widen job_rec_status enum with application-tracking pipeline values.

Revision ID: 0002_widen_job_rec_status
Revises: 0001_baseline
Create Date: 2026-08-22

The recommendation-status endpoint (PATCH /api/job-recommendation/{id}/status) and
the frontend ApplicationTracker use the pipeline vocabulary:
    applied / interviewing / offered / accepted / rejected / withdrawn
but the legacy `job_rec_status` enum only defined recommended/viewed/dismissed,
so any tracking update raised a DB error on PostgreSQL. This migration widens
the enum in place. Idempotent: safe to run repeatedly.
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "0002_widen_job_rec_status"
down_revision: Union[str, None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_VALUES = (
    "applied",
    "interviewing",
    "offered",
    "accepted",
    "rejected",
    "withdrawn",
)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # SQLite dev/test databases don't enforce PG enums.
        return

    type_exists = bind.execute(
        text("SELECT 1 FROM pg_type WHERE typname = 'job_rec_status'")
    ).scalar()
    if not type_exists:
        # Fresh database where 0001 already created the widened enum via the ORM.
        return

    for value in NEW_VALUES:
        # IF NOT EXISTS makes each statement idempotent.
        bind.execute(
            text(f"ALTER TYPE job_rec_status ADD VALUE IF NOT EXISTS '{value}'")
        )


def downgrade() -> None:
    # PostgreSQL cannot remove enum values; downgrading would require a
    # table rebuild. Not needed for a purely additive change.
    pass
