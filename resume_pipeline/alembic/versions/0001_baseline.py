"""Baseline: create full schema from current SQLAlchemy metadata.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-08-22

SAFETY: this baseline is intentionally NON-destructive.

    Base.metadata.create_all(checkfirst=True)

- On a FRESH database it creates every table defined by the ORM models.
- On an EXISTING database it only creates tables that are missing; existing
  tables and their data are left completely untouched.

This replaces the legacy destructive workflow (`scripts/init_db.py` →
`DROP SCHEMA public CASCADE`). Never run that script against a real database.
"""
from typing import Sequence, Union

from alembic import op

from resume_pipeline.db import Base

revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # Embedding tables use pgvector's ``vector`` column type; the extension
        # must exist before create_all emits those columns. Supabase already has
        # it enabled, so IF NOT EXISTS is a no-op there; CI runs the pgvector
        # image (pgvector/pgvector:pg16) so the check exercises real DDL.
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    # checkfirst=True makes this an idempotent, data-preserving operation.
    Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    # Deliberately NOT implemented: downgrading the baseline would mean dropping
    # every table (data loss). Schema rollbacks must be written as explicit,
    # reviewed forward/backward migration pairs instead.
    raise RuntimeError(
        "Downgrade of the baseline migration is not supported because it would "
        "drop all tables (data loss). Restore from backup instead."
    )
