"""Add interview_answers.evaluation_attempts for evaluation retry recovery.

Revision ID: 0004_answer_eval_attempts
Revises: 0003_widen_activity_type
Create Date: 2026-08-22

Enables retry-on-poll recovery for failed/lost background evaluations:
the results endpoint re-schedules evaluations up to a bounded number of
attempts, then delivers partial results instead of polling forever.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004_answer_eval_attempts"
down_revision: Union[str, None] = "0003_widen_activity_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.execute(sa.text(
            "ALTER TABLE interview_answers "
            "ADD COLUMN IF NOT EXISTS evaluation_attempts INTEGER NOT NULL DEFAULT 0"
        ))
    else:
        # SQLite / dev databases
        inspector = sa.inspect(bind)
        columns = {c["name"] for c in inspector.get_columns("interview_answers")}
        if "evaluation_attempts" not in columns:
            op.add_column(
                "interview_answers",
                sa.Column("evaluation_attempts", sa.Integer(), nullable=False,
                          server_default="0"),
            )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.execute(sa.text(
            "ALTER TABLE interview_answers DROP COLUMN IF EXISTS evaluation_attempts"
        ))
    else:
        inspector = sa.inspect(bind)
        columns = {c["name"] for c in inspector.get_columns("interview_answers")}
        if "evaluation_attempts" in columns:
            op.drop_column("interview_answers", "evaluation_attempts")
