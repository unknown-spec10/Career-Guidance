#!/usr/bin/env python3
"""
Database seeding script - populates all tables with realistic sample data.
Creates applicants, parsed resumes, colleges, jobs, and recommendations.
"""

import sys
import random
import json
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent.parent))

from resume_pipeline.config import settings
from resume_pipeline.db import (
    SessionLocal, Applicant, Upload, LLMParsedRecord, EmbeddingsIndex,
    College, CollegeEligibility, CollegeProgram, CollegeMetadata, CollegeApplicabilityLog,
    Employer, Job, JobMetadata, JobRecommendation,
    CanonicalSkill, AuditLog, HumanReview
)
import pymysql

# Sample data pools
FIRST_NAMES = [
    "Raj", "Priya", "Amit", "Neha", "Arjun", "Sneha", "Vikram", "Ananya",
    "Rohan", "Ishita", "Aditya", "Kavya", "Karan", "Divya", "Rahul", "Pooja",
    "Siddharth", "Riya", "Varun", "Nisha", "Aryan", "Shruti", "Harsh", "Megha"
]

LAST_NAMES = [
    "Kumar", "Sharma", "Singh", "Patel", "Gupta", "Reddy", "Iyer", "Verma",
    "Agarwal", "Joshi", "Mehta", "Nair", "Malhotra", "Pandey", "Rao", "Shah"
]

COLLEGES = [
    "Indian Institute of Technology Delhi",
    "Indian Institute of Technology Bombay",
    "Indian Institute of Technology Madras",
    "Indian Institute of Technology Kanpur",
    "BITS Pilani",
    "National Institute of Technology Trichy",
    "Delhi Technological University",
    "University of Mumbai",
    "Anna University",
    "Vellore Institute of Technology"
]

DEGREES = [
    "B.Tech in Computer Science Engineering",
    "B.Tech in Electronics and Communication",
    "B.Tech in Mechanical Engineering",
    "B.E. in Computer Science",
    "B.Tech in Information Technology",
    "B.Sc in Computer Science"
]

SKILLS_POOL = [
    "Python", "Java", "JavaScript", "C++", "React", "Node.js",
    "Machine Learning", "Deep Learning", "Data Analysis", "SQL",
    "MongoDB", "AWS", "Docker", "Kubernetes", "Git", "TypeScript",
    "Django", "Flask", "Spring Boot", "Angular", "Vue.js"
]

LOCATIONS = ["Delhi", "Mumbai", "Bangalore", "Chennai", "Hyderabad", "Pune", "Kolkata"]

COMPANIES = [
    "Google", "Microsoft", "Amazon", "Flipkart", "Paytm", "Swiggy",
    "Zomato", "Infosys", "TCS", "Wipro", "Accenture", "Cognizant"
]

JOB_TITLES = [
    "Software Engineer", "Data Scientist", "Full Stack Developer",
    "Backend Developer", "Frontend Developer", "ML Engineer",
    "DevOps Engineer", "Product Manager", "Data Analyst"
]

PROJECT_NAMES = [
    "E-commerce Platform", "Stock Price Predictor", "Chatbot System",
    "Weather Forecasting App", "Task Management Tool", "Social Media Analytics",
    "Food Delivery App", "Healthcare Management System", "Blockchain Wallet"
]

def generate_email(first_name, last_name, domain="gmail.com"):
    """Generate realistic email address"""
    return f"{first_name.lower()}.{last_name.lower()}@{domain}"

def generate_phone():
    """Generate Indian phone number"""
    return f"+91-{random.randint(70, 99)}{random.randint(10000000, 99999999)}"

def generate_cgpa():
    """Generate realistic CGPA"""
    return round(random.uniform(7.0, 9.8), 2)

def generate_skills(count=None):
    """Generate random skills"""
    if count is None:
        count = random.randint(5, 12)
    skills = random.sample(SKILLS_POOL, count)
    return [{"name": skill, "skill_id": f"skill_{i+1:03d}"} for i, skill in enumerate(skills)]

def generate_projects():
    """Generate project data"""
    count = random.randint(2, 4)
    projects = []
    for _ in range(count):
        project = {
            "name": random.choice(PROJECT_NAMES),
            "description": "Built a scalable application using modern technologies",
            "technologies": random.sample(SKILLS_POOL, random.randint(3, 5))
        }
        projects.append(project)
    return projects

def generate_experience():
    """Generate work experience"""
    if random.random() < 0.6:  # 60% have experience
        count = random.randint(1, 2)
        experiences = []
        for _ in range(count):
            exp = {
                "title": random.choice(JOB_TITLES),
                "company": random.choice(COMPANIES),
                "duration": f"{random.randint(6, 24)} months",
                "description": "Worked on backend development and cloud infrastructure"
            }
            experiences.append(exp)
        return experiences
    return []

def create_applicants_and_resumes(db, count=50):
    """Create applicants with parsed resumes"""
    print(f"\n{'='*60}")
    print(f"Creating {count} applicants with parsed resumes...")
    print(f"{'='*60}\n")
    
    created_applicants = []
    
    for i in range(count):
        # Generate personal info
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        full_name = f"{first_name} {last_name}"
        email = generate_email(first_name, last_name)
        phone = generate_phone()
        
        # Generate JEE rank (some may not have it)
        jee_rank = random.randint(500, 50000) if random.random() < 0.7 else None
        
        # Create applicant with new schema
        applicant_id = f"applicant_{i+1:04d}"
        location = random.choice(LOCATIONS)
        applicant = Applicant(
            applicant_id=applicant_id,
            display_name=full_name,
            location_city=location,
            location_state="",
            country="India",
            preferred_locations=random.sample(["IIT", "NIT", "IIIT", "BITS"], 2)
        )
        db.add(applicant)
        db.flush()  # Get the ID
        
        # Create Upload record
        upload = Upload(
            applicant_id=applicant.id,
            file_name=f"{applicant_id}_resume.pdf",
            file_type='resume',
            storage_path=f"./data/raw_files/{applicant_id}/",
            file_hash=f"hash_{applicant_id}_{random.randint(1000, 9999)}",
            ocr_used=False
        )
        db.add(upload)
        
        # Generate education data
        cgpa = generate_cgpa()
        year_start = random.randint(2019, 2021)
        year_end = year_start + 4
        
        education = [{
            "institution": random.choice(COLLEGES),
            "degree": random.choice(DEGREES),
            "cgpa": cgpa,
            "year_start": year_start,
            "year_end": year_end if random.random() < 0.6 else None  # Some still studying
        }]
        
        # Generate complete parsed data
        skills = generate_skills()
        projects = generate_projects()
        experience = generate_experience()
        
        parsed_data = {
            "applicant_id": applicant_id,
            "personal": {
                "name": full_name,
                "email": email,
                "phone": phone
            },
            "education": education,
            "skills": skills,
            "projects": projects,
            "experience": experience
        }
        
        # Determine confidence and flags
        llm_confidence = round(random.uniform(0.75, 0.98), 2)
        flags = []
        needs_review = False
        
        if llm_confidence < 0.8:
            flags.append("low_confidence")
            needs_review = True
        if jee_rank and jee_rank > 30000:
            flags.append("high_jee_rank")
        
        # Create LLMParsedRecord (new schema)
        llm_record = LLMParsedRecord(
            applicant_id=applicant.id,
            raw_llm_output={
                "model": "gemini-small",
                "confidence": llm_confidence,
                "parsed_at": datetime.now().isoformat()
            },
            normalized=parsed_data,
            field_confidences={
                "overall": llm_confidence,
                "personal": 0.95,
                "education": 0.90,
                "skills": 0.85
            },
            llm_provenance={
                "model_name": "gemini-1.5-flash",
                "tokens_used": random.randint(800, 1500),
                "response_time_ms": random.randint(300, 800),
                "timestamp": datetime.now().isoformat()
            },
            needs_review=needs_review
        )
        db.add(llm_record)
        
        created_applicants.append({
            "id": applicant.id,
            "applicant_id": applicant_id,
            "name": full_name,
            "cgpa": cgpa,
            "skills_count": len(skills),
            "jee_rank": jee_rank
        })
        
        if (i + 1) % 10 == 0:
            print(f"✓ Created {i + 1}/{count} applicants...")
    
    db.commit()
    print(f"\n✓ Successfully created {count} applicants with resumes!\n")
    return created_applicants

def create_colleges(db, count=30):
    """Create college records with new schema"""
    print(f"\n{'='*60}")
    print(f"Creating {count} colleges...")
    print(f"{'='*60}\n")
    
    colleges_data = [
        ("IIT Delhi", "Delhi", "Delhi", 2, 2000, 8.5),
        ("IIT Bombay", "Mumbai", "Maharashtra", 1, 1500, 8.7),
        ("IIT Madras", "Chennai", "Tamil Nadu", 3, 2500, 8.4),
        ("IIT Kanpur", "Kanpur", "Uttar Pradesh", 4, 3000, 8.3),
        ("IIT Kharagpur", "Kharagpur", "West Bengal", 5, 3500, 8.2),
        ("BITS Pilani", "Pilani", "Rajasthan", 8, 5000, 8.0),
        ("NIT Trichy", "Trichy", "Tamil Nadu", 10, 6000, 7.8),
        ("NIT Warangal", "Warangal", "Telangana", 12, 7000, 7.7),
        ("IIIT Hyderabad", "Hyderabad", "Telangana", 6, 4000, 8.1),
        ("DTU Delhi", "Delhi", "Delhi", 15, 8000, 7.5),
    ]
    
    created_count = 0
    for name, city, state, ranking, cutoff, cgpa in colleges_data:
        # Create college
        slug = name.lower().replace(' ', '-')
        college = College(
            name=name,
            slug=slug,
            location_city=city,
            location_state=state,
            country="India",
            description=f"Premier engineering institution with excellent placement record",
            website=f"https://{slug}.ac.in"
        )
        db.add(college)
        db.flush()
        
        # Create eligibility
        eligibility = CollegeEligibility(
            college_id=college.id,
            min_jee_rank=cutoff,
            min_cgpa=cgpa,
            eligible_degrees=["B.Tech", "B.E.", "B.Sc"],
            seats=random.randint(100, 500)
        )
        db.add(eligibility)
        
        # Create programs
        programs = ["Computer Science", "Electronics", "Mechanical", "Data Science"]
        for prog in random.sample(programs, k=random.randint(2, 4)):
            program = CollegeProgram(
                college_id=college.id,
                program_name=f"B.Tech in {prog}",
                duration_months=48,
                required_skills=random.sample(SKILLS_POOL, k=3),
                program_description=f"Comprehensive {prog} program"
            )
            db.add(program)
        
        # Create metadata
        metadata = CollegeMetadata(
            college_id=college.id,
            canonical_skills=random.sample(SKILLS_POOL, k=5),
            popularity_score=float(100 - ranking)
        )
        db.add(metadata)
        
        created_count += 1
        print(f"✓ Created college: {name} (Ranking: {ranking})")
    
    db.commit()
    print(f"\n✓ Successfully created {created_count} colleges!\n")
    return created_count

def create_jobs(db, count=40):
    """Create job records with new schema"""
    print(f"\n{'='*60}")
    print(f"Creating {count} jobs...")
    print(f"{'='*60}\n")
    
    # First, create or get employers
    employers = {}
    for company in COMPANIES:
        employer = Employer(
            company_name=company,
            website=f"https://{company.lower().replace(' ', '')}.com",
            location_city=random.choice(LOCATIONS),
            location_state=""
        )
        db.add(employer)
        db.flush()
        employers[company] = employer.id
    
    created_count = 0
    for i in range(count):
        title = random.choice(JOB_TITLES)
        company = random.choice(COMPANIES)
        location = random.choice(LOCATIONS)
        work_type = random.choice(['remote', 'on-site', 'hybrid'])
        min_exp = random.uniform(0, 5)
        
        # Create job
        skills_list = random.sample(SKILLS_POOL, random.randint(4, 8))
        required_skills = [{"name": skill, "level": random.choice(["basic", "intermediate", "expert"])} for skill in skills_list]
        
        job = Job(
            employer_id=employers[company],
            title=title,
            description=f"We are looking for a talented {title} to join our team",
            location_city=location,
            location_state="",
            work_type=work_type,
            min_experience_years=min_exp,
            min_cgpa=random.uniform(6.5, 8.0) if random.random() > 0.3 else None,
            required_skills=required_skills,
            optional_skills=random.sample(SKILLS_POOL, random.randint(2, 4)),
            expires_at=datetime.now() + timedelta(days=random.randint(30, 90))
        )
        db.add(job)
        db.flush()
        
        # Create job metadata
        metadata = JobMetadata(
            job_id=job.id,
            tags=random.sample(["ml", "backend", "frontend", "devops", "data"], k=2),
            popularity=random.uniform(50, 100)
        )
        db.add(metadata)
        
        created_count += 1
        if (created_count) % 10 == 0:
            print(f"✓ Created {created_count}/{count} jobs...")
    
    db.commit()
    print(f"\n✓ Successfully created {created_count} jobs!\n")
    return created_count

def populate_canonical_skills(db):
    """Populate canonical skills table"""
    print(f"\n{'='*60}")
    print(f"Populating canonical skills...")
    print(f"{'='*60}\n")
    
    skill_categories = {
        "Python": "programming", "Java": "programming", "JavaScript": "programming",
        "Machine Learning": "ai-ml", "Deep Learning": "ai-ml", "NLP": "ai-ml",
        "React": "frontend", "Node.js": "backend", "Django": "backend",
        "SQL": "database", "MongoDB": "database", "PostgreSQL": "database",
        "Docker": "devops", "Kubernetes": "devops", "AWS": "cloud"
    }
    
    created_count = 0
    for skill_name, category in skill_categories.items():
        skill = CanonicalSkill(
            name=skill_name,
            aliases=[skill_name.lower(), skill_name.upper()],
            category=category,
            market_score=random.uniform(60, 100),
            demand_level=random.choice(['high', 'medium', 'low'])
        )
        db.add(skill)
        created_count += 1
    
    db.commit()
    print(f"✓ Created {created_count} canonical skills\n")
    return created_count


def create_recommendations(db, applicants):
    """Create recommendation mappings with new schema"""
    print(f"\n{'='*60}")
    print(f"Creating recommendations for applicants...")
    print(f"{'='*60}\n")
    
    # Get college and job IDs
    college_ids = [c.id for c in db.query(College).all()]
    job_ids = [j.id for j in db.query(Job).all()]
    
    total_college_recs = 0
    total_job_recs = 0
    
    for applicant in applicants:
        # Recommend 3-5 colleges
        num_colleges = random.randint(3, 5)
        for college_id in random.sample(college_ids, min(num_colleges, len(college_ids))):
            match_score = round(random.uniform(70, 95), 2)
            
            log = CollegeApplicabilityLog(
                applicant_id=applicant['id'],
                college_id=college_id,
                recommend_score=match_score,
                explain={
                    "cgpa_match": applicant['cgpa'],
                    "skills_count": applicant['skills_count'],
                    "reasoning": f"Strong match based on CGPA {applicant['cgpa']} and {applicant['skills_count']} skills"
                },
                status='recommended'
            )
            db.add(log)
            total_college_recs += 1
        
        # Recommend 4-6 jobs
        num_jobs = random.randint(4, 6)
        for job_id in random.sample(job_ids, min(num_jobs, len(job_ids))):
            match_score = round(random.uniform(65, 92), 2)
            
            recommendation = JobRecommendation(
                applicant_id=applicant['id'],
                job_id=job_id,
                score=match_score,
                scoring_breakdown={
                    "skill_match": round(random.uniform(60, 95), 2),
                    "academic_score": round(random.uniform(70, 90), 2),
                    "experience_score": round(random.uniform(50, 80), 2)
                },
                explain=f"Skills alignment with {applicant['skills_count']} matching competencies",
                status='recommended'
            )
            db.add(recommendation)
            total_job_recs += 1
    
    db.commit()
    print(f"✓ Created {total_college_recs} college recommendations")
    print(f"✓ Created {total_job_recs} job recommendations\n")
    return total_college_recs + total_job_recs

def display_summary(db):
    """Display database statistics"""
    print(f"\n{'='*60}")
    print("DATABASE SUMMARY")
    print(f"{'='*60}\n")
    
    print(f"📊 Applicants: {db.query(Applicant).count()}")
    print(f"📤 Uploads: {db.query(Upload).count()}")
    print(f"📄 LLM Parsed Records: {db.query(LLMParsedRecord).count()}")
    print(f"🎓 Colleges: {db.query(College).count()}")
    print(f"📋 College Programs: {db.query(CollegeProgram).count()}")
    print(f"🏢 Employers: {db.query(Employer).count()}")
    print(f"💼 Jobs: {db.query(Job).count()}")
    print(f"🎯 College Recommendations: {db.query(CollegeApplicabilityLog).count()}")
    print(f"💡 Job Recommendations: {db.query(JobRecommendation).count()}")
    print(f"🔧 Canonical Skills: {db.query(CanonicalSkill).count()}")
    
    print(f"\n{'='*60}")
    print("RECOMMENDATION STATISTICS")
    print(f"{'='*60}\n")
    
    # College stats
    college_avg = db.query(CollegeApplicabilityLog.recommend_score).all()
    if college_avg:
        avg_score = sum([s[0] for s in college_avg if s[0]]) / len(college_avg)
        print(f"College Recommendations: {len(college_avg)} (Avg Match: {avg_score:.2f}%)")
    
    # Job stats
    job_avg = db.query(JobRecommendation.score).all()
    if job_avg:
        avg_score = sum([s[0] for s in job_avg if s[0]]) / len(job_avg)
        print(f"Job Recommendations: {len(job_avg)} (Avg Match: {avg_score:.2f}%)")
    
    print(f"\n{'='*60}")
    print("✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!")
    print(f"{'='*60}\n")

def main():
    """Main seeding function"""
    print(f"\n{'='*60}")
    print("DATABASE SEEDING SCRIPT")
    print(f"{'='*60}\n")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    db = SessionLocal()
    
    try:
        # Step 1: Create applicants and parsed resumes
        applicants = create_applicants_and_resumes(db, count=50)
        
        # Step 2: Create colleges
        create_colleges(db, count=10)
        
        # Step 3: Create jobs
        create_jobs(db, count=40)
        
        # Step 4: Create recommendations
        create_recommendations(db, applicants)
        
        # Step 5: Populate canonical skills
        populate_canonical_skills(db)
        
        # Display summary
        display_summary(db)
        
    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
