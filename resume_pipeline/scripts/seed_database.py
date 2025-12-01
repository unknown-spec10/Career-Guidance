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
    College, CollegeEligibility, CollegeProgram, CollegeMetadata, CollegeApplicabilityLog, CollegeApplication,
    Employer, Job, JobMetadata, JobRecommendation, JobApplication,
    User, CanonicalSkill, AuditLog, HumanReview
)
from resume_pipeline.auth import get_password_hash
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
        
        # Create programs with detailed descriptions
        program_templates = {
            "Computer Science": {
                "description": """This comprehensive Computer Science program combines theoretical foundations with practical applications. Students will master core concepts in algorithms, data structures, software engineering, and systems design. The curriculum includes hands-on projects in web development, mobile applications, cloud computing, and emerging technologies like AI/ML. Our state-of-the-art labs and industry partnerships provide real-world experience through internships and collaborative projects. Graduates are well-prepared for careers in software development, systems architecture, cybersecurity, and research.""",
                "skills": ["Python", "Java", "Data Structures", "Algorithms", "Database Management"]
            },
            "Electronics": {
                "description": """The Electronics Engineering program offers an in-depth study of electronic circuits, embedded systems, signal processing, and communication technologies. Students gain expertise in VLSI design, IoT systems, and semiconductor devices through extensive laboratory work and industrial training. The curriculum emphasizes both analog and digital electronics, preparing graduates for roles in telecommunications, consumer electronics, automation, and research & development in cutting-edge technologies.""",
                "skills": ["Circuit Design", "Embedded Systems", "Signal Processing", "C", "MATLAB"]
            },
            "Mechanical": {
                "description": """Our Mechanical Engineering program provides a strong foundation in thermodynamics, fluid mechanics, materials science, and manufacturing processes. Students engage in hands-on projects involving CAD/CAM, robotics, and renewable energy systems. The curriculum integrates traditional mechanical principles with modern computational tools and Industry 4.0 technologies. Graduates pursue careers in automotive, aerospace, energy, manufacturing, and product design sectors.""",
                "skills": ["CAD", "Thermodynamics", "Manufacturing", "Materials Science", "Finite Element Analysis"]
            },
            "Data Science": {
                "description": """The Data Science program is designed to produce skilled professionals who can extract insights from complex datasets. Students learn statistical analysis, machine learning, big data technologies, and data visualization through project-based learning. The curriculum covers Python/R programming, deep learning frameworks, cloud-based analytics, and business intelligence tools. Industry collaborations provide exposure to real-world data challenges. Graduates are in high demand for roles in analytics, AI/ML engineering, business intelligence, and research.""",
                "skills": ["Python", "Machine Learning", "Statistics", "Data Analysis", "Deep Learning"]
            }
        }
        
        programs = ["Computer Science", "Electronics", "Mechanical", "Data Science"]
        for prog in random.sample(programs, k=random.randint(2, 4)):
            template = program_templates.get(prog, {"description": f"Comprehensive {prog} program", "skills": random.sample(SKILLS_POOL, k=3)})
            program = CollegeProgram(
                college_id=college.id,
                program_name=f"B.Tech in {prog}",
                duration_months=48,
                required_skills=template["skills"][:3],
                program_description=template["description"]
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
        
        # Create detailed job descriptions based on role
        job_templates = {
            "Full Stack Developer": {
                "description": """We are seeking a talented Full Stack Developer to join our engineering team and build innovative web applications. You will work on both front-end and back-end development, collaborating with cross-functional teams to deliver high-quality software solutions.

**Key Responsibilities:**
• Design, develop, and maintain scalable web applications using modern frameworks
• Build responsive user interfaces with React, Angular, or Vue.js
• Develop robust RESTful APIs and microservices
• Implement database solutions using SQL and NoSQL technologies
• Write clean, maintainable code with comprehensive test coverage
• Participate in code reviews and contribute to technical documentation
• Troubleshoot and debug complex issues in production environments

**Required Qualifications:**
• Bachelor's degree in Computer Science or related field
• Strong proficiency in JavaScript/TypeScript and Python or Java
• Experience with modern frontend frameworks (React, Angular, Vue)
• Solid understanding of backend technologies (Node.js, Django, Spring Boot)
• Knowledge of database design and SQL/NoSQL databases
• Familiarity with Git version control and CI/CD pipelines

**Preferred Qualifications:**
• Experience with cloud platforms (AWS, Azure, GCP)
• Knowledge of containerization (Docker, Kubernetes)
• Understanding of microservices architecture
• Contributions to open-source projects

**Benefits:**
• Competitive salary package with performance bonuses
• Flexible work arrangements (remote/hybrid options)
• Health insurance and wellness programs
• Professional development budget for courses and certifications
• Collaborative and innovative work culture""",
                "required": ["JavaScript", "React", "Node.js", "Python", "SQL"],
                "optional": ["AWS", "Docker", "TypeScript", "MongoDB"]
            },
            "Data Scientist": {
                "description": """Join our data science team to solve complex business problems using advanced analytics and machine learning. You will work with large datasets, build predictive models, and deliver actionable insights that drive strategic decisions.

**Key Responsibilities:**
• Develop and deploy machine learning models for business applications
• Analyze large datasets to identify patterns and trends
• Build data pipelines and automate analytical workflows
• Collaborate with stakeholders to understand business requirements
• Create compelling visualizations and presentations for executive audiences
• Implement A/B tests and statistical experiments
• Stay current with latest developments in ML/AI technologies

**Required Qualifications:**
• Master's degree in Statistics, Computer Science, or related field
• Strong programming skills in Python and R
• Experience with ML frameworks (scikit-learn, TensorFlow, PyTorch)
• Solid understanding of statistics and experimental design
• Proficiency in SQL and data manipulation
• Excellent communication and presentation skills

**Preferred Qualifications:**
• PhD in quantitative field preferred
• Experience with big data tools (Spark, Hadoop)
• Knowledge of deep learning and NLP
• Publications or conference presentations

**Benefits:**
• Competitive compensation with equity options
• Flexible working hours and remote work options
• Access to cutting-edge computing resources and datasets
• Conference attendance and research collaboration opportunities
• Mentorship from industry-leading data scientists""",
                "required": ["Python", "Machine Learning", "Statistics", "SQL", "Data Analysis"],
                "optional": ["Deep Learning", "TensorFlow", "Spark", "NLP"]
            },
            "Backend Developer": {
                "description": """We are looking for an experienced Backend Developer to design and implement scalable server-side applications. You will work on building robust APIs, optimizing database performance, and ensuring system reliability.

**Key Responsibilities:**
• Design and develop RESTful APIs and microservices
• Optimize database queries and implement caching strategies
• Build scalable and fault-tolerant backend systems
• Implement security best practices and authentication mechanisms
• Monitor system performance and troubleshoot production issues
• Write comprehensive unit and integration tests
• Collaborate with frontend developers and DevOps teams

**Required Qualifications:**
• Bachelor's degree in Computer Science or equivalent experience
• 2+ years of experience in backend development
• Proficiency in Java, Python, or Go
• Strong knowledge of relational databases (PostgreSQL, MySQL)
• Experience with API design and web services
• Understanding of software design patterns and principles

**Preferred Qualifications:**
• Experience with message queues (RabbitMQ, Kafka)
• Knowledge of caching systems (Redis, Memcached)
• Familiarity with cloud infrastructure (AWS, GCP)
• Understanding of containerization and orchestration

**Benefits:**
• Competitive salary with annual increments
• Work-from-home flexibility
• Learning and development budget
• Health and wellness benefits
• Stock options for long-term employees""",
                "required": ["Python", "Java", "SQL", "REST APIs", "Database Management"],
                "optional": ["Redis", "Kafka", "AWS", "Microservices"]
            },
            "DevOps Engineer": {
                "description": """Join our DevOps team to build and maintain scalable infrastructure and deployment pipelines. You will work on automating processes, improving system reliability, and enabling rapid software delivery.

**Key Responsibilities:**
• Design and implement CI/CD pipelines for automated deployments
• Manage cloud infrastructure across multiple environments
• Implement monitoring, logging, and alerting systems
• Automate infrastructure provisioning using IaC tools
• Ensure system security and compliance
• Optimize application performance and cost efficiency
• Respond to and resolve production incidents

**Required Qualifications:**
• Bachelor's degree in Computer Science or related field
• 2+ years of DevOps or Infrastructure experience
• Strong knowledge of Linux/Unix systems
• Experience with containerization (Docker, Kubernetes)
• Proficiency in scripting languages (Python, Bash, Shell)
• Familiarity with cloud platforms (AWS, Azure, GCP)

**Preferred Qualifications:**
• Experience with Terraform or CloudFormation
• Knowledge of monitoring tools (Prometheus, Grafana, ELK)
• Understanding of security best practices
• Relevant certifications (AWS, Kubernetes, etc.)

**Benefits:**
• Competitive compensation package
• Remote work opportunities
• Professional certification support
• Latest tools and technologies
• Collaborative team environment""",
                "required": ["Linux", "Docker", "Kubernetes", "CI/CD", "AWS"],
                "optional": ["Terraform", "Python", "Jenkins", "Monitoring"]
            },
            "Frontend Developer": {
                "description": """We are seeking a creative Frontend Developer to build beautiful and intuitive user interfaces. You will work closely with designers and backend teams to create seamless user experiences.

**Key Responsibilities:**
• Develop responsive web applications using modern frameworks
• Implement pixel-perfect designs from Figma/Sketch mockups
• Optimize application performance and loading times
• Write reusable and maintainable component libraries
• Implement accessibility standards (WCAG compliance)
• Collaborate with UX designers and product managers
• Conduct code reviews and mentor junior developers

**Required Qualifications:**
• Bachelor's degree in Computer Science or related field
• Strong proficiency in HTML5, CSS3, and JavaScript
• Experience with React, Vue.js, or Angular
• Knowledge of state management (Redux, MobX, Vuex)
• Understanding of responsive design principles
• Familiarity with build tools (Webpack, Vite)

**Preferred Qualifications:**
• Experience with TypeScript
• Knowledge of CSS preprocessors (SASS, LESS)
• Understanding of web performance optimization
• Contributions to UI component libraries

**Benefits:**
• Competitive salary and bonuses
• Flexible work schedule
• Modern development tools and setup
• Learning budget for courses
• Health insurance and wellness programs""",
                "required": ["JavaScript", "React", "HTML", "CSS", "TypeScript"],
                "optional": ["Vue.js", "Redux", "Webpack", "SASS"]
            },
            "ML Engineer": {
                "description": """Join our AI/ML team to build and deploy production-grade machine learning systems. You will work on cutting-edge problems in computer vision, NLP, and recommendation systems.

**Key Responsibilities:**
• Design and implement ML pipelines from research to production
• Train and optimize deep learning models
• Deploy ML models at scale using containerization
• Monitor model performance and implement retraining strategies
• Collaborate with data scientists to productionize research
• Build feature engineering pipelines
• Optimize inference latency and throughput

**Required Qualifications:**
• Master's degree in Computer Science, ML, or related field
• Strong programming skills in Python
• Experience with ML frameworks (TensorFlow, PyTorch, scikit-learn)
• Knowledge of MLOps practices and tools
• Understanding of distributed computing
• Solid software engineering fundamentals

**Preferred Qualifications:**
• PhD in ML or related field
• Experience with model serving frameworks (TFServing, TorchServe)
• Knowledge of GPU programming and optimization
• Publications in top-tier ML conferences

**Benefits:**
• Top-of-market compensation with equity
• Access to latest GPU infrastructure
• Conference and publication support
• Flexible work arrangements
• Collaborative research environment""",
                "required": ["Python", "Machine Learning", "Deep Learning", "TensorFlow", "MLOps"],
                "optional": ["PyTorch", "Kubernetes", "GPU Programming", "NLP"]
            }
        }
        
        # Get template or create generic one
        template = job_templates.get(title, {
            "description": f"""We are looking for a talented {title} to join our growing team. This is an exciting opportunity to work on challenging problems and make a real impact.

**Key Responsibilities:**
• Contribute to the design and development of our products
• Collaborate with cross-functional teams
• Write clean, maintainable code
• Participate in code reviews and team discussions

**Required Qualifications:**
• Bachelor's degree in relevant field
• Strong problem-solving skills
• Excellent communication abilities
• Team player with positive attitude

**Benefits:**
• Competitive compensation
• Flexible work arrangements
• Health benefits
• Learning opportunities""",
            "required": random.sample(SKILLS_POOL, 4),
            "optional": random.sample(SKILLS_POOL, 3)
        })
        
        # Build required skills with levels
        required_skills_list = template["required"][:random.randint(4, 6)]
        required_skills = [{"name": skill, "level": random.choice(["basic", "intermediate", "expert"])} for skill in required_skills_list]
        optional_skills_list = template["optional"][:random.randint(2, 4)]
        
        job = Job(
            employer_id=employers[company],
            title=title,
            description=template["description"],
            location_city=location,
            location_state="",
            work_type=work_type,
            min_experience_years=min_exp,
            min_cgpa=random.uniform(6.5, 8.0) if random.random() > 0.3 else None,
            required_skills=required_skills,
            optional_skills=optional_skills_list,
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

def create_users(db, count=20):
    """Create user accounts with different roles"""
    print(f"\n{'='*60}")
    print(f"Creating {count} user accounts...")
    print(f"{'='*60}\n")
    
    created_users = []
    
    # Create admin user
    admin_email = "admin@careerguide.com"
    existing_admin = db.query(User).filter(User.email == admin_email).first()
    if not existing_admin:
        admin = User(
            email=admin_email,
            password_hash=get_password_hash("admin123"),
            role='admin',
            name="System Administrator",
            is_active=True,
            is_verified=True
        )
        db.add(admin)
        created_users.append(("admin", admin_email))
        print(f"✓ Created admin user: {admin_email}")
    
    # Create student users
    for i in range(count // 2):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        email = generate_email(first_name, last_name)
        
        existing = db.query(User).filter(User.email == email).first()
        if not existing:
            user = User(
                email=email,
                password_hash=get_password_hash("password123"),
                role='student',
                name=f"{first_name} {last_name}",
                phone=generate_phone(),
                is_active=True,
                is_verified=random.choice([True, False])
            )
            db.add(user)
            created_users.append(("student", email))
    
    # Create employer users
    for company in random.sample(COMPANIES, min(5, len(COMPANIES))):
        email = f"hr@{company.lower().replace(' ', '')}.com"
        existing = db.query(User).filter(User.email == email).first()
        if not existing:
            user = User(
                email=email,
                password_hash=get_password_hash("employer123"),
                role='employer',
                name=f"{company} HR",
                is_active=True,
                is_verified=True
            )
            db.add(user)
            created_users.append(("employer", email))
    
    # Create college users
    for i in range(3):
        email = f"admission.office{i+1}@college.edu"
        existing = db.query(User).filter(User.email == email).first()
        if not existing:
            user = User(
                email=email,
                password_hash=get_password_hash("college123"),
                role='college',
                name=f"College Admission Office {i+1}",
                is_active=True,
                is_verified=True
            )
            db.add(user)
            created_users.append(("college", email))
    
    db.commit()
    print(f"\n✓ Created {len(created_users)} user accounts")
    for role, email in created_users[:10]:  # Show first 10
        print(f"  - {role}: {email}")
    if len(created_users) > 10:
        print(f"  ... and {len(created_users) - 10} more")
    print()
    
    return created_users


def create_applications(db):
    """Create sample job and college applications"""
    print(f"\n{'='*60}")
    print(f"Creating sample applications...")
    print(f"{'='*60}\n")
    
    applicants = db.query(Applicant).limit(30).all()
    colleges = db.query(College).all()
    jobs = db.query(Job).filter(Job.status == 'approved').all()
    programs = db.query(CollegeProgram).filter(CollegeProgram.status == 'approved').all()
    
    college_apps = 0
    job_apps = 0
    
    # Create college applications
    for applicant in random.sample(applicants, min(15, len(applicants))):
        num_apps = random.randint(1, 3)
        for college in random.sample(colleges, min(num_apps, len(colleges))):
            # Find programs for this college
            college_programs = [p for p in programs if p.college_id == college.id]
            program = random.choice(college_programs) if college_programs else None
            
            existing = db.query(CollegeApplication).filter(
                CollegeApplication.applicant_id == applicant.id,
                CollegeApplication.college_id == college.id
            ).first()
            
            if not existing:
                app = CollegeApplication(
                    applicant_id=applicant.id,
                    college_id=college.id,
                    program_id=program.id if program else None,
                    statement_of_purpose=f"I am passionate about pursuing {program.program_name if program else 'this program'} at your esteemed institution.",
                    twelfth_percentage=random.uniform(75, 95),
                    twelfth_board=random.choice(["CBSE", "ICSE", "State Board"]),
                    status=random.choice(['applied', 'under_review', 'shortlisted', 'accepted']),
                    applied_at=datetime.now() - timedelta(days=random.randint(1, 60))
                )
                db.add(app)
                college_apps += 1
    
    # Create job applications
    for applicant in random.sample(applicants, min(20, len(applicants))):
        num_apps = random.randint(1, 4)
        for job in random.sample(jobs, min(num_apps, len(jobs))):
            existing = db.query(JobApplication).filter(
                JobApplication.applicant_id == applicant.id,
                JobApplication.job_id == job.id
            ).first()
            
            if not existing:
                app = JobApplication(
                    applicant_id=applicant.id,
                    job_id=job.id,
                    cover_letter=f"I am excited to apply for the {job.title} position. My skills align well with your requirements.",
                    status=random.choice(['applied', 'under_review', 'interviewing', 'offered', 'rejected']),
                    applied_at=datetime.now() - timedelta(days=random.randint(1, 45))
                )
                db.add(app)
                job_apps += 1
    
    db.commit()
    print(f"✓ Created {college_apps} college applications")
    print(f"✓ Created {job_apps} job applications\n")
    
    return college_apps + job_apps


def create_audit_logs(db, count=50):
    """Create audit logs for tracking"""
    print(f"\n{'='*60}")
    print(f"Creating {count} audit logs...")
    print(f"{'='*60}\n")
    
    entities = [
        ('applicant', [a.id for a in db.query(Applicant).limit(20).all()]),
        ('job', [j.id for j in db.query(Job).limit(15).all()]),
        ('college', [c.id for c in db.query(College).limit(10).all()])
    ]
    
    actions = ['created', 'updated', 'parsed', 'recommended', 'viewed', 'applied']
    
    for i in range(count):
        entity_type, entity_ids = random.choice(entities)
        if entity_ids:
            log = AuditLog(
                entity_type=entity_type,
                entity_id=random.choice(entity_ids),
                action=random.choice(actions),
                payload={
                    "user_agent": "Mozilla/5.0",
                    "ip": f"192.168.{random.randint(1,255)}.{random.randint(1,255)}",
                    "timestamp": (datetime.now() - timedelta(days=random.randint(0, 30))).isoformat()
                },
                created_at=datetime.now() - timedelta(days=random.randint(0, 30))
            )
            db.add(log)
    
    db.commit()
    print(f"✓ Created {count} audit log entries\n")
    return count


def create_human_reviews(db, count=10):
    """Create human review records"""
    print(f"\n{'='*60}")
    print(f"Creating {count} human review records...")
    print(f"{'='*60}\n")
    
    applicants = db.query(Applicant).limit(15).all()
    admin_users = db.query(User).filter(User.role == 'admin').all()
    
    if not admin_users:
        print("⚠ No admin users found, skipping human reviews\n")
        return 0
    
    fields = ['cgpa', 'skills', 'education', 'jee_rank', 'experience']
    
    for i in range(count):
        if applicants:
            applicant = random.choice(applicants)
            field = random.choice(fields)
            review = HumanReview(
                applicant_id=applicant.id,
                field=field,
                original_value=f"Original {field} value",
                corrected_value=f"Corrected {field} value",
                reviewer_id=random.choice(admin_users).id if admin_users else None,
                reason="Manually verified and corrected based on document review",
                created_at=datetime.now() - timedelta(days=random.randint(1, 20))
            )
            db.add(review)
    
    db.commit()
    print(f"✓ Created {count} human review records\n")
    return count


def populate_canonical_skills(db):
    """Populate canonical skills table"""
    print(f"\n{'='*60}")
    print(f"Populating canonical skills...")
    print(f"{'='*60}\n")
    
    skill_categories = {
        "Python": ("programming", 95.0, "high"),
        "Java": ("programming", 92.0, "high"),
        "JavaScript": ("programming", 94.0, "high"),
        "TypeScript": ("programming", 88.0, "high"),
        "C++": ("programming", 85.0, "medium"),
        "Machine Learning": ("ai-ml", 98.0, "high"),
        "Deep Learning": ("ai-ml", 96.0, "high"),
        "NLP": ("ai-ml", 94.0, "high"),
        "Computer Vision": ("ai-ml", 90.0, "high"),
        "React": ("frontend", 93.0, "high"),
        "Angular": ("frontend", 85.0, "medium"),
        "Vue.js": ("frontend", 82.0, "medium"),
        "Node.js": ("backend", 91.0, "high"),
        "Django": ("backend", 87.0, "medium"),
        "Flask": ("backend", 84.0, "medium"),
        "Spring Boot": ("backend", 86.0, "medium"),
        "SQL": ("database", 90.0, "high"),
        "MongoDB": ("database", 88.0, "high"),
        "PostgreSQL": ("database", 87.0, "high"),
        "Redis": ("database", 80.0, "medium"),
        "Docker": ("devops", 92.0, "high"),
        "Kubernetes": ("devops", 90.0, "high"),
        "AWS": ("cloud", 95.0, "high"),
        "Azure": ("cloud", 88.0, "high"),
        "GCP": ("cloud", 87.0, "high"),
        "Git": ("tools", 98.0, "high"),
        "CI/CD": ("devops", 85.0, "medium"),
        "Microservices": ("architecture", 87.0, "high"),
        "REST API": ("backend", 90.0, "high"),
        "GraphQL": ("backend", 82.0, "medium"),
    }
    
    created_count = 0
    for skill_name, (category, score, demand) in skill_categories.items():
        existing = db.query(CanonicalSkill).filter(CanonicalSkill.name == skill_name).first()
        if not existing:
            skill = CanonicalSkill(
                name=skill_name,
                aliases=[skill_name.lower(), skill_name.replace(" ", "").lower()],
                category=category,
                market_score=score,
                demand_level=demand
            )
            db.add(skill)
            created_count += 1
    
    db.commit()
    print(f"✓ Created {created_count} canonical skills\n")
    return created_count


def display_summary(db):
    """Display database statistics"""
    print(f"\n{'='*60}")
    print("DATABASE SUMMARY")
    print(f"{'='*60}\n")
    
    print(f"👤 Users: {db.query(User).count()}")
    print(f"📊 Applicants: {db.query(Applicant).count()}")
    print(f"📤 Uploads: {db.query(Upload).count()}")
    print(f"📄 LLM Parsed Records: {db.query(LLMParsedRecord).count()}")
    print(f"🎓 Colleges: {db.query(College).count()}")
    print(f"📋 College Programs: {db.query(CollegeProgram).count()}")
    print(f"📝 College Applications: {db.query(CollegeApplication).count()}")
    print(f"🏢 Employers: {db.query(Employer).count()}")
    print(f"💼 Jobs: {db.query(Job).count()}")
    print(f"📨 Job Applications: {db.query(JobApplication).count()}")
    print(f"🎯 College Recommendations: {db.query(CollegeApplicabilityLog).count()}")
    print(f"💡 Job Recommendations: {db.query(JobRecommendation).count()}")
    print(f"🔧 Canonical Skills: {db.query(CanonicalSkill).count()}")
    print(f"📜 Audit Logs: {db.query(AuditLog).count()}")
    print(f"✏️  Human Reviews: {db.query(HumanReview).count()}")
    
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
    
    # Application stats
    college_apps_count = db.query(CollegeApplication).count()
    job_apps_count = db.query(JobApplication).count()
    print(f"College Applications: {college_apps_count}")
    print(f"Job Applications: {job_apps_count}")
    
    print(f"\n{'='*60}")
    print("✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!")
    print(f"{'='*60}\n")


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


def main():
    """Main seeding function"""
    print(f"\n{'='*60}")
    print("DATABASE SEEDING SCRIPT")
    print(f"{'='*60}\n")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    db = SessionLocal()
    
    try:
        # Step 1: Create applicants and parsed resumes (if needed)
        current_applicants = db.query(Applicant).count()
        if current_applicants < 50:
            applicants = create_applicants_and_resumes(db, count=50 - current_applicants)
        else:
            applicants = [{"id": a.id, "applicant_id": a.applicant_id, "name": a.display_name, 
                          "cgpa": 8.0, "skills_count": 10, "jee_rank": None} 
                         for a in db.query(Applicant).limit(50).all()]
            print(f"✓ Using existing {len(applicants)} applicants\n")
        
        # Step 2: Create colleges (if needed)
        current_colleges = db.query(College).count()
        if current_colleges < 10:
            create_colleges(db, count=10 - current_colleges)
        else:
            print(f"✓ Using existing {current_colleges} colleges\n")
        
        # Step 3: Create jobs (if needed)
        current_jobs = db.query(Job).count()
        if current_jobs < 40:
            create_jobs(db, count=40 - current_jobs)
        else:
            print(f"✓ Using existing {current_jobs} jobs\n")
        
        # Step 4: Create recommendations (if needed)
        current_recs = db.query(CollegeApplicabilityLog).count()
        if current_recs < 100:
            create_recommendations(db, applicants)
        else:
            print(f"✓ Using existing {current_recs} recommendations\n")
        
        # Step 5: Populate canonical skills
        populate_canonical_skills(db)
        
        # Step 6: Create applications
        create_applications(db)
        
        # Step 7: Create audit logs
        create_audit_logs(db, count=50)
        
        # Step 8: Create human reviews (requires admin users)
        admin_count = db.query(User).filter(User.role == 'admin').count()
        if admin_count > 0:
            create_human_reviews(db, count=10)
        else:
            print("⚠ Skipping human reviews (no admin users found)\n")
        
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
