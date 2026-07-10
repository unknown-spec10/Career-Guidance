#!/usr/bin/env python3
"""Create/upgrade database columns for user profile pictures.

This script is idempotent and safe to run multiple times.
"""

from __future__ import annotations

import sys
from pathlib import Path
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent.parent))

from resume_pipeline.db import engine  # noqa: E402


DDL_STATEMENTS = [
    # Alter users table to add profile_picture_url
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR(512)",
]


def main() -> None:
    print("Starting database migration for user profile pictures...")
    with engine.begin() as conn:
        for stmt in DDL_STATEMENTS:
            try:
                conn.execute(text(stmt))
                print(f"OK: {stmt}")
            except Exception as exc:
                print(f"ERROR: {stmt} -> {exc}")

    print("Profile picture database migration complete.")


if __name__ == "__main__":
    main()
