"""Add security_attempts table for DB-backed code-attempt lockouts.

Revision ID: 0007_security_attempts
Revises: 0006_password_changed_at
Create Date: 2026-08-22

Verification/reset-code brute-force lockouts move from an in-process
defaultdict to a persistent table so they hold across multiple workers.
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "0007_security_attempts"
down_revision: Union[str, None] = "0006_password_changed_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.execute(text("""
            CREATE TABLE IF NOT EXISTS security_attempts (
                id SERIAL PRIMARY KEY,
                attempt_key VARCHAR(255) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT now()
            )
        """))
        bind.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_security_attempts_created_at "
            "ON security_attempts (created_at)"
        ))
        bind.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_security_attempts_key_time "
            "ON security_attempts (attempt_key, created_at)"
        ))
    # SQLite dev/test DBs get the table via Base.metadata.create_all.


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.execute(text("DROP TABLE IF EXISTS security_attempts"))
