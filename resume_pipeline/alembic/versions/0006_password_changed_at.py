"""Add users.password_changed_at for JWT revocation after credential change.

Revision ID: 0006_password_changed_at
Revises: 0005_expired_and_lp_session
Create Date: 2026-08-22

Auth tokens now embed an `iat` claim; tokens issued before the most recent
password change/reset are rejected, revoking stolen sessions.
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "0006_password_changed_at"
down_revision: Union[str, None] = "0005_expired_and_lp_session"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP NULL"
        ))
    else:
        inspector = text("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        if bind.execute(inspector).scalar():
            # PRAGMA table_info rows: (cid, name, type, notnull, dflt_value, pk)
            columns = {
                row[1] for row in bind.execute(text("PRAGMA table_info(users)")).fetchall()
            }
            if "password_changed_at" not in columns:
                bind.execute(text(
                    "ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP NULL"
                ))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS password_changed_at"))
