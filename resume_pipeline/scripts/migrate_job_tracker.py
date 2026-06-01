#!/usr/bin/env python3
"""Create/upgrade job tracker objects.

This script is idempotent and safe to run multiple times.
"""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent.parent))

from resume_pipeline.db import engine


def main() -> None:
    print("Starting database migration for job tracker...")
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE job_recommendations ADD COLUMN IF NOT EXISTS is_saved BOOLEAN DEFAULT FALSE;"))
            print("OK: ALTER TABLE job_recommendations ADD COLUMN IF NOT EXISTS is_saved BOOLEAN DEFAULT FALSE;")
        except Exception as exc:
            print(f"ERROR: -> {exc}")

    print("Job tracker database migration complete.")


if __name__ == "__main__":
    main()
