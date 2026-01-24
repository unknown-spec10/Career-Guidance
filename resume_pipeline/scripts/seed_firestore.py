#!/usr/bin/env python3
"""
Seed Firestore database with sample data for cloud deployment.
"""
import os
import sys
from datetime import datetime, timedelta
import firebase_admin
from firebase_admin import firestore as fb_firestore

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def seed_firestore():
    """Populate Firestore with sample data."""
    # Initialize Firebase (will use GOOGLE_APPLICATION_CREDENTIALS env var)
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    
    db = fb_firestore.client()
    
    print("🌱 Seeding Firestore Database...")
    print("=" * 50)
    
    # 1. Seed Users
    print("\n📝 Seeding Users...")
    users = [
        {
            "email": "student@example.com",
            "password_hash": "$2b$12$9YQq7MZXmD0LT1L7Z3X5m.L8K4K4K4K4K4K4K4K4K4K4K4K4K4K",
            "role": "student",
            "name": "John Doe",
            "created_at": datetime.utcnow().isoformat(),
            "is_verified": True
        },
        {
            "email": "college@example.com",
            "password_hash": "$2b$12$9YQq7MZXmD0LT1L7Z3X5m.L8K4K4K4K4K4K4K4K4K4K4K4K4K4K",
            "role": "college",
            "name": "IIT Admin",
            "created_at": datetime.utcnow().isoformat(),
            "is_verified": True
        },
        {
            "email": "employer@example.com",
            "password_hash": "$2b$12$9YQq7MZXmD0LT1L7Z3X5m.L8K4K4K4K4K4K4K4K4K4K4K4K4K4K",
            "role": "employer",
            "name": "TCS Recruiter",
            "created_at": datetime.utcnow().isoformat(),
            "is_verified": True
        }
    ]
    
    user_ids = {}
    for user in users:
        doc_ref = db.collection('users').document()
        doc_ref.set(user)
        user_ids[user['email']] = doc_ref.id
        print(f"  ✓ Created user: {user['email']}")
    
    # 2. Seed Colleges
    print("\n🏫 Seeding Colleges...")
    colleges = [
        {
            "name": "Indian Institute of Technology Delhi",
            "location": "Delhi",
            "ranking": 1,
            "established_year": 1961,
            "description": "Leading engineering institution in India",
            "website": "https://www.iitd.ac.in",
            "contact_email": "admissions@iitd.ac.in"
        },
        {
            "name": "Indian Institute of Technology Bombay",
            "location": "Mumbai",
            "ranking": 2,
            "established_year": 1958,
            "description": "Premier engineering college in India",
            "website": "https://www.iitb.ac.in",
            "contact_email": "admissions@iitb.ac.in"
        },
        {
            "name": "Indian Institute of Technology Kanpur",
            "location": "Kanpur",
            "ranking": 3,
            "established_year": 1959,
            "description": "Excellence in engineering education",
            "website": "https://www.iitk.ac.in",
            "contact_email": "admissions@iitk.ac.in"
        }
    ]
    
    college_ids = {}
    for college in colleges:
        doc_ref = db.collection('colleges').document()
        doc_ref.set(college)
        college_ids[college['name']] = doc_ref.id
        print(f"  ✓ Created college: {college['name']}")
    
    # 3. Seed Jobs
    print("\n💼 Seeding Jobs...")
    jobs = [
        {
            "title": "Software Engineer",
            "company": "Google India",
            "location": "Bangalore",
            "salary_min": 15,
            "salary_max": 25,
            "currency": "LPA",
            "description": "Build scalable systems at Google",
            "requirements": ["Python", "C++", "DSA"],
            "employer_id": user_ids.get("employer@example.com"),
            "status": "approved",
            "posted_date": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(days=90)).isoformat()
        },
        {
            "title": "Data Scientist",
            "company": "Microsoft India",
            "location": "Delhi",
            "salary_min": 18,
            "salary_max": 28,
            "currency": "LPA",
            "description": "Work on AI/ML projects",
            "requirements": ["Python", "ML", "Statistics"],
            "employer_id": user_ids.get("employer@example.com"),
            "status": "approved",
            "posted_date": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(days=90)).isoformat()
        },
        {
            "title": "Cloud Engineer",
            "company": "Amazon Web Services",
            "location": "Hyderabad",
            "salary_min": 20,
            "salary_max": 30,
            "currency": "LPA",
            "description": "Design cloud infrastructure",
            "requirements": ["AWS", "Docker", "Kubernetes"],
            "employer_id": user_ids.get("employer@example.com"),
            "status": "approved",
            "posted_date": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(days=90)).isoformat()
        }
    ]
    
    job_ids = {}
    for idx, job in enumerate(jobs):
        doc_ref = db.collection('jobs').document()
        doc_ref.set(job)
        job_ids[job['title']] = doc_ref.id
        print(f"  ✓ Created job: {job['title']} at {job['company']}")
    
    # 4. Seed Applicants
    print("\n👤 Seeding Applicants...")
    student_user_id = user_ids.get("student@example.com")
    applicants = [
        {
            "user_id": student_user_id,
            "display_name": "John Doe",
            "location": "Delhi",
            "jee_rank": 500,
            "cgpa": 8.5,
            "skills": ["Python", "Java", "DSA"],
            "created_at": datetime.utcnow().isoformat()
        }
    ]
    
    applicant_ids = {}
    for applicant in applicants:
        doc_ref = db.collection('applicants').document()
        doc_ref.set(applicant)
        applicant_ids[applicant['display_name']] = doc_ref.id
        print(f"  ✓ Created applicant: {applicant['display_name']}")
    
    # 5. Seed College Recommendations
    print("\n🎓 Seeding College Recommendations...")
    if applicant_ids and college_ids:
        applicant_id = list(applicant_ids.values())[0]
        for college_name, college_id in college_ids.items():
            jee_score = min(100, (1000 - 500) / 10)
            cgpa_score = 85
            skills_score = 80
            base_score = (jee_score * 0.35 + cgpa_score * 0.25 + skills_score * 0.25 + 0 * 0.15)
            
            rec = {
                "applicant_id": applicant_id,
                "college_id": college_id,
                "college_name": college_name,
                "score": base_score,
                "status": "recommended",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            doc_ref = db.collection('college_recommendations').document()
            doc_ref.set(rec)
            print(f"  ✓ Created recommendation: {applicant_id[:8]}... → {college_name}")
    
    # 6. Seed Job Recommendations
    print("\n💼 Seeding Job Recommendations...")
    if applicant_ids and job_ids:
        applicant_id = list(applicant_ids.values())[0]
        for job_title, job_id in job_ids.items():
            score = 75
            rec = {
                "applicant_id": applicant_id,
                "job_id": job_id,
                "job_title": job_title,
                "score": score,
                "status": "recommended",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            doc_ref = db.collection('job_recommendations').document()
            doc_ref.set(rec)
            print(f"  ✓ Created recommendation: {applicant_id[:8]}... → {job_title}")
    
    # 7. Seed Credit Accounts
    print("\n💳 Seeding Credit Accounts...")
    if student_user_id:
        credit_account = {
            "user_id": student_user_id,
            "balance": 60,
            "total_earned": 60,
            "total_spent": 0,
            "last_refill": datetime.utcnow().isoformat(),
            "created_at": datetime.utcnow().isoformat()
        }
        doc_ref = db.collection('credit_accounts').document()
        doc_ref.set(credit_account)
        print(f"  ✓ Created credit account (balance: 60)")
    
    print("\n" + "=" * 50)
    print("✅ Firestore seeding completed successfully!")
    print("\nSeeded Data Summary:")
    print(f"  • Users: {len(users)}")
    print(f"  • Colleges: {len(colleges)}")
    print(f"  • Jobs: {len(jobs)}")
    print(f"  • Applicants: {len(applicants)}")
    print(f"  • College Recommendations: {len(colleges)}")
    print(f"  • Job Recommendations: {len(jobs)}")
    print(f"  • Credit Accounts: 1")

if __name__ == "__main__":
    try:
        seed_firestore()
    except Exception as e:
        print(f"❌ Error seeding Firestore: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
