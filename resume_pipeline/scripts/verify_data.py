#!/usr/bin/env python3
"""
Verify database seeding - display sample records from all tables
"""

import sys
from pathlib import Path
import pymysql
import json

sys.path.insert(0, str(Path(__file__).parent.parent))

from resume_pipeline.config import settings

def main():
    conn = pymysql.connect(
        host=settings.MYSQL_HOST or 'localhost',
        port=settings.MYSQL_PORT or 3306,
        user=settings.MYSQL_USER or 'root',
        password=settings.MYSQL_PASSWORD or '',
        database=settings.MYSQL_DB or 'resumes'
    )
    cursor = conn.cursor()
    
    print('\n' + '='*60)
    print('SAMPLE APPLICANTS')
    print('='*60)
    cursor.execute('SELECT applicant_id, meta_json FROM applicants LIMIT 5')
    for app_id, meta in cursor.fetchall():
        meta_dict = json.loads(meta) if meta else {}
        jee = meta_dict.get('jee_rank', 'N/A')
        loc = meta_dict.get('location', 'N/A')
        print(f'  {app_id}: JEE Rank: {jee}, Location: {loc}')
    
    print('\n' + '='*60)
    print('SAMPLE PARSED RESUMES')
    print('='*60)
    cursor.execute('SELECT id, applicant_id, flags FROM resume_parsed LIMIT 5')
    for id, app_id, flags in cursor.fetchall():
        flags_list = json.loads(flags) if flags else []
        flags_str = ', '.join(flags_list) if flags_list else 'None'
        print(f'  ID: {id}, Applicant: {app_id}, Flags: {flags_str}')
    
    print('\n' + '='*60)
    print('TOP COLLEGES BY RANKING')
    print('='*60)
    cursor.execute('SELECT name, location, ranking, cutoff_jee FROM colleges ORDER BY ranking LIMIT 5')
    for name, loc, rank, cutoff in cursor.fetchall():
        print(f'  #{rank}. {name} ({loc}) - JEE Cutoff: {cutoff}')
    
    print('\n' + '='*60)
    print('RECENT JOB POSTINGS')
    print('='*60)
    cursor.execute('SELECT title, company, location, salary_range FROM jobs LIMIT 5')
    for title, company, loc, salary in cursor.fetchall():
        print(f'  {title} at {company} ({loc}) - {salary}')
    
    print('\n' + '='*60)
    print('SAMPLE RECOMMENDATIONS')
    print('='*60)
    cursor.execute('''
        SELECT r.applicant_id, r.recommendation_type, r.match_score,
               CASE 
                 WHEN r.recommendation_type = "college" THEN c.name
                 WHEN r.recommendation_type = "job" THEN CONCAT(j.title, " at ", j.company)
               END as entity_name
        FROM recommendations r
        LEFT JOIN colleges c ON r.recommendation_type = "college" AND r.entity_id = c.id
        LEFT JOIN jobs j ON r.recommendation_type = "job" AND r.entity_id = j.id
        LIMIT 10
    ''')
    for app_id, rec_type, score, entity in cursor.fetchall():
        print(f'  Applicant {app_id} → {entity} ({rec_type}, Match: {score}%)')
    
    print('\n' + '='*60)
    print('DETAILED APPLICANT SAMPLE')
    print('='*60)
    cursor.execute('''
        SELECT a.applicant_id, r.normalized
        FROM applicants a
        JOIN resume_parsed r ON a.id = r.applicant_id
        LIMIT 2
    ''')
    for app_id, normalized in cursor.fetchall():
        data = json.loads(normalized) if normalized else {}
        print(f'\n  Applicant: {app_id}')
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
    
    conn.close()
    print('\n' + '='*60)
    print('✅ DATABASE VERIFICATION COMPLETE')
    print('='*60 + '\n')

if __name__ == "__main__":
    main()
