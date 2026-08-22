"""Widen activity_type enum with 'refund' and 'bonus_credits'.

Revision ID: 0003_widen_activity_type
Revises: 0002_widen_job_rec_status
Create Date: 2026-08-22

CreditService.refund_credits() writes activity_type='refund' and the premium
upgrade endpoint writes activity_type='bonus_credits', but the legacy PG enum
did not include either value — both operations would crash on PostgreSQL.
Additive, idempotent widening of the enum in place.
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "0003_widen_activity_type"
down_revision: Union[str, None] = "0002_widen_job_rec_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_VALUES = ("refund", "bonus_credits")


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    type_exists = bind.execute(
        text("SELECT 1 FROM pg_type WHERE typname = 'activity_type'")
    ).scalar()
    if not type_exists:
        # Fresh database: 0001 already created the widened enum via the ORM.
        return

    existing = {
        row[0]
        for row in bind.execute(
            text("SELECT e.enumlabel FROM pg_enum e "
                 "JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'activity_type'")
        ).fetchall()
    }
    for value in NEW_VALUES:
        if value not in existing:
            bind.execute(text(f"ALTER TYPE activity_type ADD VALUE '{value}'"))


def downgrade() -> None:
    # PostgreSQL cannot remove enum values; purely additive change.
    pass
