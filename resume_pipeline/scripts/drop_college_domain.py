#!/usr/bin/env python3
"""Drop the legacy college domain from PostgreSQL and normalize roles."""

import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent.parent))

from resume_pipeline.db import engine  # noqa: E402


STATEMENTS = [
    "DROP TABLE IF EXISTS college_applications CASCADE",
    "DROP TABLE IF EXISTS college_applicability_logs CASCADE",
    "DROP TABLE IF EXISTS college_metadata CASCADE",
    "DROP TABLE IF EXISTS college_programs CASCADE",
    "DROP TABLE IF EXISTS college_eligibility CASCADE",
    "DROP TABLE IF EXISTS colleges CASCADE",
    "DELETE FROM users WHERE role::text = 'college'",
    "ALTER TABLE users ALTER COLUMN role DROP DEFAULT",
    "ALTER TABLE users ALTER COLUMN role TYPE text USING role::text",
    "DROP TYPE IF EXISTS collection_status CASCADE",
    "DROP TYPE IF EXISTS program_status CASCADE",
    "DROP TYPE IF EXISTS college_rec_status CASCADE",
    "DROP TYPE IF EXISTS college_app_status CASCADE",
    "DROP TYPE IF EXISTS user_role CASCADE",
    "CREATE TYPE user_role AS ENUM ('student', 'employer', 'admin')",
    "ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role",
    "ALTER TABLE users ALTER COLUMN role SET DEFAULT 'student'",
]


def main():
    with engine.begin() as connection:
        for statement in STATEMENTS:
            print(f"Executing: {statement}")
            connection.execute(text(statement))
    print("College domain removed successfully")


if __name__ == "__main__":
    main()