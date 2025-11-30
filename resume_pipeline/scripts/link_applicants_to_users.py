r"""
One-off script to associate existing Applicant records with User accounts by matching
parsed resume email to user.email. Run from project root with the virtualenv activated.

Usage (PowerShell):
    .\myenv\Scripts\Activate.ps1
    python resume_pipeline/scripts/link_applicants_to_users.py --user-id 3

This will:
 - Load the User with given id
 - Scan LLMParsedRecord.normalized for matching email (personal_info.email or personal.email)
 - If a matching parsed record is found, update the corresponding Applicant.user_id
 - Print summary of changes

Be careful and review matches before running in production.
"""

import argparse
from resume_pipeline.db import SessionLocal
from resume_pipeline.config import settings
from sqlalchemy import text


def find_and_link(user_id: int):
    db = SessionLocal()
    try:
        user = db.execute(text("SELECT id, email FROM users WHERE id = :id"), {"id": user_id}).fetchone()
        if not user:
            print(f"User id={user_id} not found")
            return
        # SQLAlchemy Row has a _mapping attribute for keyed access
        if hasattr(user, '_mapping'):
            user_email = user._mapping.get('email')
        elif isinstance(user, dict):
            user_email = user.get('email')
        else:
            # fallback to positional
            try:
                user_email = user[1]
            except Exception:
                user_email = None
        print(f"Looking for parsed applicants matching email: {user_email}")

        # Load all parsed records and inspect normalized JSON
        rows = db.execute(text("SELECT id, applicant_id, normalized FROM llm_parsed_records WHERE normalized IS NOT NULL")).fetchall()
        matches = []
        for r in rows:
            if hasattr(r, '_mapping'):
                pid = r._mapping.get('id')
                applicant_id = r._mapping.get('applicant_id')
                normalized = r._mapping.get('normalized')
            elif isinstance(r, dict):
                pid = r.get('id')
                applicant_id = r.get('applicant_id')
                normalized = r.get('normalized')
            else:
                pid = r[0]
                applicant_id = r[1]
                normalized = r[2]
            # normalized can be returned as Python dict or string depending on DB driver
            try:
                if isinstance(normalized, str):
                    import json
                    normalized_obj = json.loads(normalized)
                else:
                    normalized_obj = normalized
            except Exception:
                normalized_obj = None
            if not normalized_obj:
                continue
            # check both common keys
            personal = normalized_obj.get('personal') or normalized_obj.get('personal_info') or {}
            email = personal.get('email')
            if email and user_email and str(email).lower().strip() == str(user_email).lower().strip():
                matches.append((pid, applicant_id, email))

        if not matches:
            print('No matching parsed records found for this user.')
            return

        print(f"Found {len(matches)} parsed record(s) referencing this user's email:")
        for pid, applicant_id, email in matches:
            print(f" - parsed id={pid}, applicant_id={applicant_id}, email={email}")

        # Confirm and update applicants
        confirm = input('Proceed to link these applicant records to the user? (y/N): ').strip().lower()
        if confirm != 'y':
            print('Aborting - no changes made.')
            return

        for pid, applicant_id, email in matches:
            db.execute(text("UPDATE applicants SET user_id = :uid WHERE id = :aid"), {"uid": user_id, "aid": applicant_id})
        db.commit()
        print(f"Linked {len(matches)} applicant record(s) to user id={user_id}.")
    finally:
        db.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--user-id', type=int, required=True)
    args = parser.parse_args()
    find_and_link(args.user_id)
