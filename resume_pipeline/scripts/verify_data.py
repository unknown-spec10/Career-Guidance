#!/usr/bin/env python3
"""
Verify database seeding - display sample records from all tables.
Uses SQLAlchemy (psycopg2) against the current schema.
"""

import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from resume_pipeline.config import settings


def main():
    if not settings.PG_DSN:
        raise RuntimeError("PG_DSN is not set")

    engine = create_engine(settings.PG_DSN)

    with engine.connect() as conn:
        print('\n' + '=' * 60)
        print('SAMPLE APPLICANTS')
        print('=' * 60)
        result = conn.execute(text(
            'SELECT id, applicant_id, display_name, location_city FROM applicants LIMIT 5'
        ))
        for row in result:
            print(f'  {row[1] or row[0]}: Name: {row[2]}, Location: {row[3]}')

        print('\n' + '=' * 60)
        print('SAMPLE PARSED RESUMES')
        print('=' * 60)
        result = conn.execute(text(
            'SELECT applicant_id, needs_review, created_at FROM llm_parsed_records LIMIT 5'
        ))
        for row in result:
            print(f'  Applicant ID: {row[0]}, Needs Review: {row[1]}, Created: {row[2]}')

        print('\n' + '=' * 60)
        print('TOP COLLEGES')
        print('=' * 60)
        result = conn.execute(text(
            'SELECT name, location_city, location_state FROM colleges ORDER BY id LIMIT 5'
        ))
        for row in result:
            print(f'  {row[0]} ({row[1]}, {row[2]})')

        print('\n' + '=' * 60)
        print('RECENT JOB POSTINGS')
        print('=' * 60)
        result = conn.execute(text(
            '''SELECT j.title, e.company_name, j.location_city, j.status
               FROM jobs j
               JOIN employers e ON j.employer_id = e.id
               LIMIT 5'''
        ))
        for row in result:
            print(f'  {row[0]} at {row[1]} ({row[2]}) — {row[3]}')

        print('\n' + '=' * 60)
        print('SAMPLE COLLEGE RECOMMENDATIONS')
        print('=' * 60)
        result = conn.execute(text(
            '''SELECT cal.applicant_id, c.name, cal.recommend_score, cal.status
               FROM college_applicability_logs cal
               JOIN colleges c ON cal.college_id = c.id
               ORDER BY cal.recommend_score DESC
               LIMIT 10'''
        ))
        for row in result:
            print(f'  Applicant {row[0]} → {row[1]} (Score: {row[2]:.2f}, Status: {row[3]})')

        print('\n' + '=' * 60)
        print('SAMPLE JOB RECOMMENDATIONS')
        print('=' * 60)
        result = conn.execute(text(
            '''SELECT jr.applicant_id, j.title, e.company_name, jr.score, jr.status
               FROM job_recommendations jr
               JOIN jobs j ON jr.job_id = j.id
               JOIN employers e ON j.employer_id = e.id
               ORDER BY jr.score DESC
               LIMIT 10'''
        ))
        for row in result:
            print(f'  Applicant {row[0]} → {row[1]} at {row[2]} (Score: {row[3]:.2f}, Status: {row[4]})')

        print('\n' + '=' * 60)
        print('DETAILED APPLICANT SAMPLE')
        print('=' * 60)
        result = conn.execute(text(
            '''SELECT a.applicant_id, r.normalized
               FROM applicants a
               JOIN llm_parsed_records r ON a.id = r.applicant_id
               LIMIT 2'''
        ))
        for row in result:
            data = row[1] if isinstance(row[1], dict) else (json.loads(row[1]) if row[1] else {})
            print(f'\n  Applicant: {row[0]}')
            if 'personal' in data:
                print(f"    Name: {data['personal'].get('name', 'N/A')}")
                print(f"    Email: {data['personal'].get('email', 'N/A')}")
            if 'education' in data and data['education']:
                edu = data['education'][0]
                print(f"    College: {edu.get('institution', 'N/A')}")
                print(f"    CGPA: {edu.get('cgpa', 'N/A')}")
            if 'skills' in data:
                print(f"    Skills: {len(data['skills'])} total")
                skills_str = ', '.join([s.get('name', '') for s in data['skills'][:5]])
                print(f"    Top Skills: {skills_str}")

    print('\n' + '=' * 60)
    print('✅ DATABASE VERIFICATION COMPLETE')
    print('=' * 60 + '\n')


if __name__ == "__main__":
    main()
