#!/usr/bin/env python3
"""Seed the database with comprehensive, diversified student, recruiter, and job sample data."""

import random
import sys
import logging
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from resume_pipeline.auth import get_password_hash
from resume_pipeline.db import (  # noqa: E402
    Applicant,
    Employer,
    Job,
    JobApplication,
    JobRecommendation,
    LLMParsedRecord,
    SessionLocal,
    Upload,
    User,
    JobEmbedding,
    JobEmbeddingsCache,
    JobMetadata,
    UserFeedback,
    LearningPath,
    ApplicantEmbedding,
    EmbeddingsIndex,
    HumanReview,
    InterviewAnswer,
    InterviewQuestion,
    InterviewSession,
    SkillAssessment,
    CreditTransaction,
    CreditUsageStats,
    CreditAccount,
    init_db
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_database")

# Candidates (Gmail addresses, standard password 12345678)
STUDENTS = [
    ("Aarav Sharma", "aarav.sharma@gmail.com", "Bangalore"),
    ("Diya Patel", "diya.patel@gmail.com", "Pune"),
    ("Rohan Gupta", "rohan.gupta@gmail.com", "Delhi"),
    ("Meera Nair", "meera.nair@gmail.com", "Chennai"),
]

# Recruiters (Gmail addresses, standard password 12345678)
RECRUITERS = [
    ("Google Hiring", "hiring@google.gmail.com", "Google", "Bangalore"),
    ("Microsoft Careers", "careers@microsoft.gmail.com", "Microsoft", "Hyderabad"),
    ("Amazon Talent", "talent@amazon.gmail.com", "Amazon", "Pune"),
    ("Meta Recruiting", "recruiting@meta.gmail.com", "Meta", "Mumbai"),
    ("Netflix Talent", "jobs@netflix.gmail.com", "Netflix", "Remote"),
    ("Apple Careers", "careers@apple.gmail.com", "Apple", "Hyderabad"),
    ("Uber Engineering", "talent@uber.gmail.com", "Uber", "Bangalore"),
    ("Razorpay HR", "hr@razorpay.gmail.com", "Razorpay", "Bangalore"),
    ("Flipkart Careers", "careers@flipkart.gmail.com", "Flipkart", "Bangalore"),
]

# Rich skill mappings for students
STUDENT_SKILLS = {
    "Aarav Sharma": ["Python", "FastAPI", "Django", "PostgreSQL", "Redis", "Celery", "Docker", "Kubernetes", "AWS", "REST APIs", "Git"],
    "Diya Patel": ["React", "Next.js", "JavaScript", "TypeScript", "Tailwind CSS", "HTML5", "CSS3", "Redux Toolkit", "Vite", "Figma"],
    "Rohan Gupta": ["Java", "Spring Boot", "Hibernate", "PostgreSQL", "SQL", "AWS", "Jenkins", "Docker", "Git", "microservices"],
    "Meera Nair": ["Python", "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "Pandas", "NumPy", "scikit-learn", "SQL", "Tableau", "LLMs", "RAG"],
}

# The massive 115 diversified jobs catalog
JOB_DEFS = [
    # --- Backend (25 roles) ---
    {
        "title": "Senior Backend Engineer (FastAPI)",
        "domain": "Backend",
        "product_area": "High-throughput API Gateway",
        "required_skills": [("Python", "advanced"), ("FastAPI", "advanced"), ("PostgreSQL", "intermediate")],
        "optional_skills": [("Redis", "intermediate"), ("Docker", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "Backend Developer (Django)",
        "domain": "Backend",
        "product_area": "Core Application Services",
        "required_skills": [("Python", "intermediate"), ("Django", "intermediate"), ("REST APIs", "intermediate")],
        "optional_skills": [("PostgreSQL", "basic"), ("Celery", "basic")],
        "min_experience_years": 2, "min_cgpa": 6.5, "work_type": "remote"
    },
    {
        "title": "Distributed Systems Engineer (Go)",
        "domain": "Backend",
        "product_area": "Real-time Messaging Pipeline",
        "required_skills": [("Go", "advanced"), ("gRPC", "intermediate"), ("Kafka", "intermediate")],
        "optional_skills": [("Docker", "intermediate"), ("Kubernetes", "basic")],
        "min_experience_years": 5, "min_cgpa": 7.5, "work_type": "on-site"
    },
    {
        "title": "Backend Architect (Java / Spring)",
        "domain": "Backend",
        "product_area": "Enterprise Payment Processing",
        "required_skills": [("Java", "advanced"), ("Spring Boot", "advanced"), ("MySQL", "advanced")],
        "optional_skills": [("AWS", "intermediate"), ("Hibernate", "intermediate")],
        "min_experience_years": 7, "min_cgpa": 8.0, "work_type": "hybrid"
    },
    {
        "title": "Node.js Core API Developer",
        "domain": "Backend",
        "product_area": "Microservices Platform",
        "required_skills": [("Node.js", "advanced"), ("TypeScript", "intermediate"), ("Express", "advanced")],
        "optional_skills": [("MongoDB", "intermediate"), ("GraphQL", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "remote"
    },
    {
        "title": "Systems Software Engineer (Rust)",
        "domain": "Backend",
        "product_area": "Low-Latency Vector Engine",
        "required_skills": [("Rust", "advanced"), ("C++", "intermediate"), ("Systems Programming", "advanced")],
        "optional_skills": [("Docker", "basic"), ("WebAssembly", "basic")],
        "min_experience_years": 4, "min_cgpa": 8.5, "work_type": "hybrid"
    },
    {
        "title": "Junior Python Developer",
        "domain": "Backend",
        "product_area": "Internal Tooling & Scripting",
        "required_skills": [("Python", "basic"), ("SQL", "basic"), ("Git", "intermediate")],
        "optional_skills": [("Flask", "basic"), ("PostgreSQL", "basic")],
        "min_experience_years": 1, "min_cgpa": 6.0, "work_type": "hybrid"
    },
    {
        "title": "HFT C++ Engineer",
        "domain": "Backend",
        "product_area": "High-Frequency Trading Desk",
        "required_skills": [("C++", "advanced"), ("Multithreading", "advanced"), ("Linux", "intermediate")],
        "optional_skills": [("Python", "basic"), ("Network Programming", "basic")],
        "min_experience_years": 5, "min_cgpa": 8.5, "work_type": "on-site"
    },
    {
        "title": "Ruby on Rails API Developer",
        "domain": "Backend",
        "product_area": "SaaS Subscription Engine",
        "required_skills": [("Ruby", "advanced"), ("Ruby on Rails", "advanced"), ("PostgreSQL", "intermediate")],
        "optional_skills": [("Redis", "basic"), ("Sidekiq", "basic")],
        "min_experience_years": 3, "min_cgpa": 6.5, "work_type": "remote"
    },
    {
        "title": "ASP.NET Core Engineer",
        "domain": "Backend",
        "product_area": "Public Sector APIs",
        "required_skills": [("C#", "intermediate"), ("ASP.NET Core", "intermediate"), ("SQL Server", "intermediate")],
        "optional_skills": [("Azure", "basic"), ("Entity Framework", "basic")],
        "min_experience_years": 2, "min_cgpa": 7.0, "work_type": "on-site"
    },
    {
        "title": "Scale Specialist (Go / Kubernetes)",
        "domain": "Backend",
        "product_area": "Core Platform Scale Team",
        "required_skills": [("Go", "advanced"), ("Kubernetes", "advanced"), ("Docker", "intermediate")],
        "optional_skills": [("Prometheus", "basic"), ("gRPC", "basic")],
        "min_experience_years": 5, "min_cgpa": 7.5, "work_type": "hybrid"
    },
    {
        "title": "Elixir / Phoenix Backend Developer",
        "domain": "Backend",
        "product_area": "Real-time Telemetry Service",
        "required_skills": [("Elixir", "intermediate"), ("Phoenix", "intermediate"), ("PostgreSQL", "intermediate")],
        "optional_skills": [("Docker", "basic"), ("Redis", "basic")],
        "min_experience_years": 3, "min_cgpa": 6.8, "work_type": "remote"
    },
    {
        "title": "Java Spring Microservices Developer",
        "domain": "Backend",
        "product_area": "Banking Service Integration",
        "required_skills": [("Java", "intermediate"), ("Spring Boot", "intermediate"), ("PostgreSQL", "basic")],
        "optional_skills": [("Docker", "basic"), ("AWS", "basic")],
        "min_experience_years": 2, "min_cgpa": 7.2, "work_type": "hybrid"
    },
    {
        "title": "Database Engineer (PostgreSQL DBA)",
        "domain": "Backend",
        "product_area": "Core Database Infrastructure",
        "required_skills": [("PostgreSQL", "advanced"), ("SQL", "advanced"), ("Performance Tuning", "advanced")],
        "optional_skills": [("Linux", "basic"), ("Python", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "Serverless Developer (AWS Lambda)",
        "domain": "Backend",
        "product_area": "Serverless Event Processing",
        "required_skills": [("Python", "intermediate"), ("AWS Lambda", "advanced"), ("Node.js", "basic")],
        "optional_skills": [("DynamoDB", "intermediate"), ("AWS SAM", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.5, "work_type": "remote"
    },
    {
        "title": "Scala Platform Engineer",
        "domain": "Backend",
        "product_area": "Data Processing Core Pipelines",
        "required_skills": [("Scala", "advanced"), ("Spark", "intermediate"), ("Java", "basic")],
        "optional_skills": [("Kubernetes", "basic"), ("Hadoop", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.8, "work_type": "hybrid"
    },
    {
        "title": "PHP / Laravel Developer",
        "domain": "Backend",
        "product_area": "Corporate Portal Management",
        "required_skills": [("PHP", "advanced"), ("Laravel", "advanced"), ("MySQL", "intermediate")],
        "optional_skills": [("Vue.js", "basic"), ("Git", "basic")],
        "min_experience_years": 3, "min_cgpa": 6.5, "work_type": "hybrid"
    },
    {
        "title": "Graph Database Engineer (Neo4j)",
        "domain": "Backend",
        "product_area": "Social Recommendation Graph",
        "required_skills": [("Neo4j", "advanced"), ("Python", "intermediate"), ("Cypher Query", "advanced")],
        "optional_skills": [("PostgreSQL", "basic"), ("AWS", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.5, "work_type": "remote"
    },
    {
        "title": "Firmware / Embedded C Developer",
        "domain": "Backend",
        "product_area": "Smart Home IoT Firmware",
        "required_skills": [("C", "advanced"), ("RTOS", "intermediate"), ("Microcontrollers", "advanced")],
        "optional_skills": [("C++", "basic"), ("Git", "basic")],
        "min_experience_years": 4, "min_cgpa": 8.0, "work_type": "on-site"
    },
    {
        "title": "Haskell Compiler Engineer",
        "domain": "Backend",
        "product_area": "Smart Contract Verification Tools",
        "required_skills": [("Haskell", "advanced"), ("Functional Programming", "advanced"), ("Compilers", "advanced")],
        "optional_skills": [("Rust", "basic"), ("Git", "basic")],
        "min_experience_years": 5, "min_cgpa": 8.8, "work_type": "remote"
    },
    {
        "title": "Node.js Integration Developer",
        "domain": "Backend",
        "product_area": "Third-party APIs Hub",
        "required_skills": [("Node.js", "intermediate"), ("Express", "intermediate"), ("REST APIs", "advanced")],
        "optional_skills": [("TypeScript", "basic"), ("MongoDB", "basic")],
        "min_experience_years": 2, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "Django Backend Engineer",
        "domain": "Backend",
        "product_area": "E-Commerce Backend Operations",
        "required_skills": [("Python", "advanced"), ("Django", "advanced"), ("PostgreSQL", "intermediate")],
        "optional_skills": [("Redis", "basic"), ("AWS", "basic")],
        "min_experience_years": 3, "min_cgpa": 6.8, "work_type": "hybrid"
    },
    {
        "title": "Rust Storage Developer",
        "domain": "Backend",
        "product_area": "High-speed Block Storage Interface",
        "required_skills": [("Rust", "advanced"), ("Linux Systems", "advanced"), ("C", "intermediate")],
        "optional_skills": [("Docker", "basic"), ("Bash", "basic")],
        "min_experience_years": 4, "min_cgpa": 8.0, "work_type": "on-site"
    },
    {
        "title": "FastAPI Web Services Engineer",
        "domain": "Backend",
        "product_area": "External Web Portal Backend",
        "required_skills": [("Python", "intermediate"), ("FastAPI", "intermediate"), ("SQLAlchemy", "intermediate")],
        "optional_skills": [("MySQL", "basic"), ("Docker", "basic")],
        "min_experience_years": 2, "min_cgpa": 7.2, "work_type": "remote"
    },
    {
        "title": "Go Microservices Developer",
        "domain": "Backend",
        "product_area": "Enterprise Identity Management",
        "required_skills": [("Go", "intermediate"), ("PostgreSQL", "intermediate"), ("Docker", "basic")],
        "optional_skills": [("gRPC", "basic"), ("Kubernetes", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "hybrid"
    },

    # --- Frontend (25 roles) ---
    {
        "title": "Senior Frontend Engineer (React)",
        "domain": "Frontend",
        "product_area": "Customer Dashboard Platform",
        "required_skills": [("React", "advanced"), ("TypeScript", "advanced"), ("JavaScript", "advanced")],
        "optional_skills": [("Tailwind CSS", "intermediate"), ("Vite", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "Frontend Developer (Next.js)",
        "domain": "Frontend",
        "product_area": "SEO Public Website",
        "required_skills": [("React", "intermediate"), ("Next.js", "advanced"), ("CSS", "intermediate")],
        "optional_skills": [("Tailwind CSS", "basic"), ("Vite", "basic")],
        "min_experience_years": 2, "min_cgpa": 6.8, "work_type": "remote"
    },
    {
        "title": "VueJS Frontend Developer",
        "domain": "Frontend",
        "product_area": "Analytic Monitoring Portal",
        "required_skills": [("Vue.js", "advanced"), ("JavaScript", "advanced"), ("CSS", "intermediate")],
        "optional_skills": [("Nuxt.js", "basic"), ("Tailwind CSS", "basic")],
        "min_experience_years": 3, "min_cgpa": 6.5, "work_type": "hybrid"
    },
    {
        "title": "Angular Specialist Developer",
        "domain": "Frontend",
        "product_area": "Legacy Enterprise Portals",
        "required_skills": [("Angular", "advanced"), ("TypeScript", "advanced"), ("RxJS", "advanced")],
        "optional_skills": [("Sass", "basic"), ("Docker", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.2, "work_type": "on-site"
    },
    {
        "title": "Svelte Frontend Architect",
        "domain": "Frontend",
        "product_area": "Ultra-light Performance Analytics",
        "required_skills": [("Svelte", "advanced"), ("JavaScript", "advanced"), ("TypeScript", "intermediate")],
        "optional_skills": [("Vite", "intermediate"), ("Tailwind CSS", "basic")],
        "min_experience_years": 5, "min_cgpa": 7.8, "work_type": "remote"
    },
    {
        "title": "Web UX Designer & React Engineer",
        "domain": "Frontend",
        "product_area": "Interactive User Portal",
        "required_skills": [("React", "intermediate"), ("JavaScript", "advanced"), ("Figma", "advanced")],
        "optional_skills": [("Tailwind CSS", "intermediate"), ("CSS", "advanced")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "WebGL 3D Interactive Developer",
        "domain": "Frontend",
        "product_area": "3D Product Visualizer",
        "required_skills": [("Three.js", "advanced"), ("WebGL", "advanced"), ("JavaScript", "advanced")],
        "optional_skills": [("React", "basic"), ("TypeScript", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.5, "work_type": "remote"
    },
    {
        "title": "Junior Frontend Developer (React)",
        "domain": "Frontend",
        "product_area": "Internal Admin UI Tools",
        "required_skills": [("React", "basic"), ("JavaScript", "intermediate"), ("HTML", "advanced")],
        "optional_skills": [("CSS", "intermediate"), ("Git", "basic")],
        "min_experience_years": 1, "min_cgpa": 6.0, "work_type": "hybrid"
    },
    {
        "title": "Frontend Optimization SRE",
        "domain": "Frontend",
        "product_area": "Web Performance Core Team",
        "required_skills": [("JavaScript", "advanced"), ("Webpack", "advanced"), ("Lighthouse", "advanced")],
        "optional_skills": [("React", "basic"), ("Node.js", "basic")],
        "min_experience_years": 4, "min_cgpa": 8.0, "work_type": "hybrid"
    },
    {
        "title": "HTML5 / CSS3 Responsive Developer",
        "domain": "Frontend",
        "product_area": "Email Templates & Static Content",
        "required_skills": [("HTML", "advanced"), ("CSS", "advanced"), ("Sass", "advanced")],
        "optional_skills": [("JavaScript", "basic"), ("Git", "basic")],
        "min_experience_years": 2, "min_cgpa": 6.2, "work_type": "remote"
    },
    {
        "title": "Next.js Static Site Expert",
        "domain": "Frontend",
        "product_area": "Corporate Blog & Careers Site",
        "required_skills": [("Next.js", "advanced"), ("React", "advanced"), ("Tailwind CSS", "advanced")],
        "optional_skills": [("TypeScript", "basic"), ("Vite", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "remote"
    },
    {
        "title": "E-Commerce React Specialist",
        "domain": "Frontend",
        "product_area": "Checkout & Cart Flows",
        "required_skills": [("React", "advanced"), ("JavaScript", "advanced"), ("Redux Toolkit", "intermediate")],
        "optional_skills": [("Tailwind CSS", "basic"), ("REST APIs", "basic")],
        "min_experience_years": 3, "min_cgpa": 6.8, "work_type": "hybrid"
    },
    {
        "title": "Mobile Web View Optimization Lead",
        "domain": "Frontend",
        "product_area": "App Webview Core System",
        "required_skills": [("JavaScript", "advanced"), ("CSS", "advanced"), ("Tailwind CSS", "advanced")],
        "optional_skills": [("React", "basic"), ("Vite", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.5, "work_type": "hybrid"
    },
    {
        "title": "Angular Core Architect",
        "domain": "Frontend",
        "product_area": "Enterprise Cloud Console",
        "required_skills": [("Angular", "advanced"), ("TypeScript", "advanced"), ("NgRx", "advanced")],
        "optional_skills": [("Docker", "basic"), ("CSS", "basic")],
        "min_experience_years": 6, "min_cgpa": 8.0, "work_type": "on-site"
    },
    {
        "title": "React Dashboard Specialist",
        "domain": "Frontend",
        "product_area": "Real-time Metrics UI",
        "required_skills": [("React", "intermediate"), ("JavaScript", "advanced"), ("ChartJS", "intermediate")],
        "optional_skills": [("Vite", "basic"), ("Tailwind CSS", "basic")],
        "min_experience_years": 2, "min_cgpa": 6.5, "work_type": "remote"
    },
    {
        "title": "TypeScript UI Engineer",
        "domain": "Frontend",
        "product_area": "Core Shared Component Library",
        "required_skills": [("TypeScript", "advanced"), ("React", "advanced"), ("Storybook", "intermediate")],
        "optional_skills": [("Webpack", "basic"), ("Tailwind CSS", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.2, "work_type": "hybrid"
    },
    {
        "title": "Nuxt / Vue Engineer",
        "domain": "Frontend",
        "product_area": "Marketing Public Landing Pages",
        "required_skills": [("Vue.js", "intermediate"), ("Nuxt.js", "advanced"), ("CSS", "intermediate")],
        "optional_skills": [("JavaScript", "basic"), ("Vite", "basic")],
        "min_experience_years": 2, "min_cgpa": 6.8, "work_type": "remote"
    },
    {
        "title": "React Native Developer",
        "domain": "Frontend",
        "product_area": "iOS & Android Customer App",
        "required_skills": [("React Native", "advanced"), ("React", "advanced"), ("TypeScript", "intermediate")],
        "optional_skills": [("Redux Toolkit", "basic"), ("iOS/Android Build Tools", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "Svelte Component Library Developer",
        "domain": "Frontend",
        "product_area": "Interactive Form Builders",
        "required_skills": [("Svelte", "advanced"), ("JavaScript", "advanced"), ("CSS", "advanced")],
        "optional_skills": [("Vite", "basic"), ("Storybook", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.2, "work_type": "remote"
    },
    {
        "title": "WebAccessibility UI Architect",
        "domain": "Frontend",
        "product_area": "Accessibility Compliance Systems",
        "required_skills": [("HTML", "advanced"), ("JavaScript", "advanced"), ("WAI-ARIA", "advanced")],
        "optional_skills": [("React", "basic"), ("CSS", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.5, "work_type": "hybrid"
    },
    {
        "title": "Next.js Web Developer",
        "domain": "Frontend",
        "product_area": "Public Knowledge Base",
        "required_skills": [("Next.js", "intermediate"), ("React", "intermediate"), ("CSS", "intermediate")],
        "optional_skills": [("TypeScript", "basic"), ("Tailwind CSS", "basic")],
        "min_experience_years": 2, "min_cgpa": 6.5, "work_type": "remote"
    },
    {
        "title": "Vue Admin Panel Developer",
        "domain": "Frontend",
        "product_area": "Internal Support Ticketing System",
        "required_skills": [("Vue.js", "intermediate"), ("JavaScript", "intermediate"), ("Tailwind CSS", "advanced")],
        "optional_skills": [("Nuxt.js", "basic"), ("Git", "basic")],
        "min_experience_years": 2, "min_cgpa": 6.8, "work_type": "hybrid"
    },
    {
        "title": "Senior Angular Developer",
        "domain": "Frontend",
        "product_area": "Enterprise HR Portal UI",
        "required_skills": [("Angular", "advanced"), ("TypeScript", "advanced"), ("Sass", "intermediate")],
        "optional_skills": [("Docker", "basic"), ("Git", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.0, "work_type": "on-site"
    },
    {
        "title": "Next.js Core Engineer",
        "domain": "Frontend",
        "product_area": "E-Commerce Public Frontends",
        "required_skills": [("Next.js", "advanced"), ("React", "advanced"), ("Tailwind CSS", "advanced")],
        "optional_skills": [("TypeScript", "basic"), ("Vite", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.2, "work_type": "hybrid"
    },
    {
        "title": "React Core Web Developer",
        "domain": "Frontend",
        "product_area": "Digital Payments Interface",
        "required_skills": [("React", "intermediate"), ("TypeScript", "intermediate"), ("Tailwind CSS", "advanced")],
        "optional_skills": [("JavaScript", "basic"), ("Vite", "basic")],
        "min_experience_years": 2, "min_cgpa": 7.0, "work_type": "remote"
    },

    # --- Full Stack (15 roles) ---
    {
        "title": "Full Stack Engineer (Python & React)",
        "domain": "Full Stack",
        "product_area": "Data Driven Insights Portal",
        "required_skills": [("Python", "advanced"), ("React", "advanced"), ("PostgreSQL", "intermediate")],
        "optional_skills": [("FastAPI", "basic"), ("Tailwind CSS", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "MERN Stack Developer",
        "domain": "Full Stack",
        "product_area": "Collaborative Task Manager",
        "required_skills": [("MongoDB", "intermediate"), ("Express", "intermediate"), ("React", "advanced"), ("Node.js", "advanced")],
        "optional_skills": [("JavaScript", "advanced"), ("Tailwind CSS", "basic")],
        "min_experience_years": 2, "min_cgpa": 6.8, "work_type": "remote"
    },
    {
        "title": "Senior Full Stack Architect (Java & React)",
        "domain": "Full Stack",
        "product_area": "Banking Dashboard Portal",
        "required_skills": [("Java", "advanced"), ("Spring Boot", "advanced"), ("React", "advanced")],
        "optional_skills": [("TypeScript", "basic"), ("PostgreSQL", "basic")],
        "min_experience_years": 6, "min_cgpa": 8.0, "work_type": "hybrid"
    },
    {
        "title": "Full Stack Rails Developer",
        "domain": "Full Stack",
        "product_area": "SaaS Platform Management",
        "required_skills": [("Ruby", "advanced"), ("Ruby on Rails", "advanced"), ("JavaScript", "intermediate")],
        "optional_skills": [("Hotwire", "basic"), ("Tailwind CSS", "basic")],
        "min_experience_years": 3, "min_cgpa": 6.5, "work_type": "remote"
    },
    {
        "title": "Laravel & Vue Full Stack Engineer",
        "domain": "Full Stack",
        "product_area": "Client CRM Dashboards",
        "required_skills": [("PHP", "advanced"), ("Laravel", "advanced"), ("Vue.js", "advanced")],
        "optional_skills": [("MySQL", "basic"), ("CSS", "basic")],
        "min_experience_years": 3, "min_cgpa": 6.8, "work_type": "hybrid"
    },
    {
        "title": "Next.js & Django Full Stack Developer",
        "domain": "Full Stack",
        "product_area": "Content Management Engines",
        "required_skills": [("Python", "intermediate"), ("Django", "intermediate"), ("Next.js", "advanced"), ("React", "advanced")],
        "optional_skills": [("PostgreSQL", "basic"), ("Tailwind CSS", "basic")],
        "min_experience_years": 2, "min_cgpa": 7.0, "work_type": "remote"
    },
    {
        "title": "Java & Angular Enterprise Developer",
        "domain": "Full Stack",
        "product_area": "Corporate Logistics Systems",
        "required_skills": [("Java", "advanced"), ("Spring Boot", "advanced"), ("Angular", "advanced")],
        "optional_skills": [("TypeScript", "basic"), ("SQL", "basic")],
        "min_experience_years": 5, "min_cgpa": 7.5, "work_type": "on-site"
    },
    {
        "title": "Go & React Full Stack Engineer",
        "domain": "Full Stack",
        "product_area": "Metrics Real-time Collection Dashboard",
        "required_skills": [("Go", "advanced"), ("React", "advanced"), ("TypeScript", "intermediate")],
        "optional_skills": [("Docker", "basic"), ("gRPC", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.8, "work_type": "hybrid"
    },
    {
        "title": "FastAPI & Vue Full Stack Engineer",
        "domain": "Full Stack",
        "product_area": "Marketing Lead Management",
        "required_skills": [("Python", "intermediate"), ("FastAPI", "intermediate"), ("Vue.js", "intermediate")],
        "optional_skills": [("Tailwind CSS", "basic"), ("PostgreSQL", "basic")],
        "min_experience_years": 2, "min_cgpa": 6.5, "work_type": "remote"
    },
    {
        "title": "Node.js & React Full Stack Developer",
        "domain": "Full Stack",
        "product_area": "Digital Payments Systems",
        "required_skills": [("Node.js", "advanced"), ("React", "advanced"), ("PostgreSQL", "intermediate")],
        "optional_skills": [("TypeScript", "basic"), ("Docker", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "Full Stack Engineer (Django & Vue)",
        "domain": "Full Stack",
        "product_area": "Analytics Gathering Platform",
        "required_skills": [("Python", "advanced"), ("Django", "advanced"), ("Vue.js", "intermediate")],
        "optional_skills": [("MySQL", "basic"), ("CSS", "basic")],
        "min_experience_years": 3, "min_cgpa": 6.8, "work_type": "remote"
    },
    {
        "title": "MERN Stack Engineer",
        "domain": "Full Stack",
        "product_area": "Product Feedback Forum",
        "required_skills": [("Node.js", "intermediate"), ("React", "advanced"), ("MongoDB", "basic"), ("Express", "basic")],
        "optional_skills": [("JavaScript", "basic"), ("Tailwind CSS", "basic")],
        "min_experience_years": 2, "min_cgpa": 7.0, "work_type": "remote"
    },
    {
        "title": "Full Stack Rails Developer",
        "domain": "Full Stack",
        "product_area": "Enterprise Booking Engines",
        "required_skills": [("Ruby on Rails", "advanced"), ("React", "intermediate"), ("PostgreSQL", "intermediate")],
        "optional_skills": [("Ruby", "basic"), ("Tailwind CSS", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "FastAPI & React Full Stack Developer",
        "domain": "Full Stack",
        "product_area": "Survey Creation Suite",
        "required_skills": [("Python", "intermediate"), ("FastAPI", "intermediate"), ("React", "intermediate")],
        "optional_skills": [("Tailwind CSS", "basic"), ("PostgreSQL", "basic")],
        "min_experience_years": 2, "min_cgpa": 7.2, "work_type": "remote"
    },
    {
        "title": "Full Stack Java Spring & Vue Developer",
        "domain": "Full Stack",
        "product_area": "Corporate Payroll Management",
        "required_skills": [("Java", "advanced"), ("Spring Boot", "advanced"), ("Vue.js", "intermediate")],
        "optional_skills": [("MySQL", "basic"), ("Docker", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.5, "work_type": "on-site"
    },

    # --- Machine Learning & AI (15 roles) ---
    {
        "title": "Machine Learning Engineer (MLOps)",
        "domain": "Machine Learning",
        "product_area": "Production AI Pipelines",
        "required_skills": [("Python", "advanced"), ("PyTorch", "intermediate"), ("Docker", "advanced")],
        "optional_skills": [("Kubernetes", "basic"), ("MLflow", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.5, "work_type": "hybrid"
    },
    {
        "title": "NLP Data Scientist",
        "domain": "Machine Learning",
        "product_area": "Semantic Search Engine",
        "required_skills": [("Python", "advanced"), ("HuggingFace", "advanced"), ("Transformers", "advanced")],
        "optional_skills": [("PyTorch", "basic"), ("SQL", "basic")],
        "min_experience_years": 4, "min_cgpa": 8.0, "work_type": "remote"
    },
    {
        "title": "Computer Vision Researcher",
        "domain": "Machine Learning",
        "product_area": "Smart Security Cameras",
        "required_skills": [("Python", "advanced"), ("OpenCV", "advanced"), ("PyTorch", "advanced")],
        "optional_skills": [("Deep Learning", "basic"), ("C++", "basic")],
        "min_experience_years": 5, "min_cgpa": 8.5, "work_type": "on-site"
    },
    {
        "title": "AI Product Engineer (LLMs)",
        "domain": "Machine Learning",
        "product_area": "Intelligent Chat Copilot",
        "required_skills": [("Python", "advanced"), ("LangChain", "advanced"), ("Vector Databases", "advanced")],
        "optional_skills": [("FastAPI", "basic"), ("React", "basic")],
        "min_experience_years": 2, "min_cgpa": 7.5, "work_type": "remote"
    },
    {
        "title": "Data Scientist (Python)",
        "domain": "Machine Learning",
        "product_area": "User Retention Analytics",
        "required_skills": [("Python", "advanced"), ("Pandas", "advanced"), ("scikit-learn", "advanced")],
        "optional_skills": [("SQL", "advanced"), ("Tableau", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "Deep Learning Specialist",
        "domain": "Machine Learning",
        "product_area": "Generative Media Engines",
        "required_skills": [("Python", "advanced"), ("TensorFlow", "advanced"), ("PyTorch", "advanced")],
        "optional_skills": [("Deep Learning", "advanced"), ("Linux", "basic")],
        "min_experience_years": 4, "min_cgpa": 8.0, "work_type": "remote"
    },
    {
        "title": "AI Agent Systems Developer",
        "domain": "Machine Learning",
        "product_area": "Autonomous Sales Agents",
        "required_skills": [("Python", "advanced"), ("LangChain", "advanced"), ("FastAPI", "intermediate")],
        "optional_skills": [("MongoDB", "basic"), ("Docker", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.5, "work_type": "hybrid"
    },
    {
        "title": "Data Scientist - Personalization",
        "domain": "Machine Learning",
        "product_area": "E-Commerce Recommendation Engine",
        "required_skills": [("Python", "advanced"), ("scikit-learn", "advanced"), ("SQL", "advanced")],
        "optional_skills": [("Pandas", "basic"), ("Redis", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.2, "work_type": "remote"
    },
    {
        "title": "ML Platform SRE",
        "domain": "Machine Learning",
        "product_area": "Core Cluster Resource Allocator",
        "required_skills": [("Python", "intermediate"), ("Docker", "advanced"), ("Kubernetes", "advanced")],
        "optional_skills": [("AWS", "basic"), ("PyTorch", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.8, "work_type": "hybrid"
    },
    {
        "title": "Speech Processing Engineer",
        "domain": "Machine Learning",
        "product_area": "Voice Commands Transcribing Engine",
        "required_skills": [("Python", "advanced"), ("Speech Recognition", "advanced"), ("PyTorch", "intermediate")],
        "optional_skills": [("HuggingFace", "basic"), ("C++", "basic")],
        "min_experience_years": 4, "min_cgpa": 8.0, "work_type": "remote"
    },
    {
        "title": "Recommendation Systems Engineer",
        "domain": "Machine Learning",
        "product_area": "Content Discovery Systems",
        "required_skills": [("Python", "advanced"), ("Pandas", "advanced"), ("scikit-learn", "advanced")],
        "optional_skills": [("SQL", "basic"), ("Docker", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "RAG Pipeline Engineer",
        "domain": "Machine Learning",
        "product_area": "Legal Document QA Copilot",
        "required_skills": [("Python", "advanced"), ("LangChain", "advanced"), ("PyTorch", "basic")],
        "optional_skills": [("FastAPI", "basic"), ("Vector Databases", "basic")],
        "min_experience_years": 2, "min_cgpa": 7.5, "work_type": "remote"
    },
    {
        "title": "LLM Fine-tuning Engineer",
        "domain": "Machine Learning",
        "product_area": "Specialized Domain Language Models",
        "required_skills": [("Python", "advanced"), ("HuggingFace", "advanced"), ("Transformers", "advanced")],
        "optional_skills": [("Deep Learning", "basic"), ("Docker", "basic")],
        "min_experience_years": 4, "min_cgpa": 8.2, "work_type": "hybrid"
    },
    {
        "title": "Reinforcement Learning Developer",
        "domain": "Machine Learning",
        "product_area": "Game AI Bot Platform",
        "required_skills": [("Python", "advanced"), ("PyTorch", "advanced"), ("Gym", "advanced")],
        "optional_skills": [("TensorFlow", "basic"), ("C++", "basic")],
        "min_experience_years": 4, "min_cgpa": 8.5, "work_type": "remote"
    },
    {
        "title": "AI Analytics Lead",
        "domain": "Machine Learning",
        "product_area": "AI Models Benchmarking & Testing",
        "required_skills": [("Python", "advanced"), ("Pandas", "advanced"), ("Tableau", "advanced")],
        "optional_skills": [("scikit-learn", "basic"), ("SQL", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.0, "work_type": "hybrid"
    },

    # --- DevOps, SRE, and Cloud (15 roles) ---
    {
        "title": "DevOps Engineer (AWS & Terraform)",
        "domain": "DevOps",
        "product_area": "Infrastructure Automation",
        "required_skills": [("AWS", "advanced"), ("Terraform", "advanced"), ("CI/CD", "advanced")],
        "optional_skills": [("Docker", "intermediate"), ("Bash", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "Site Reliability Engineer (SRE)",
        "domain": "DevOps",
        "product_area": "API Operations Scalability",
        "required_skills": [("Linux", "advanced"), ("Prometheus", "advanced"), ("Python", "intermediate")],
        "optional_skills": [("Docker", "basic"), ("Kubernetes", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.2, "work_type": "hybrid"
    },
    {
        "title": "Platform Engineer (Kubernetes)",
        "domain": "DevOps",
        "product_area": "Core Containers Cluster",
        "required_skills": [("Kubernetes", "advanced"), ("Docker", "advanced"), ("Go", "basic")],
        "optional_skills": [("Terraform", "basic"), ("Helm", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.5, "work_type": "on-site"
    },
    {
        "title": "Cloud Architect (Azure / DevOps)",
        "domain": "DevOps",
        "product_area": "Azure Cloud Deployments",
        "required_skills": [("Azure", "advanced"), ("CI/CD", "advanced"), ("Ansible", "advanced")],
        "optional_skills": [("Terraform", "basic"), ("Linux", "basic")],
        "min_experience_years": 5, "min_cgpa": 7.8, "work_type": "remote"
    },
    {
        "title": "DevSecOps Specialist",
        "domain": "DevOps",
        "product_area": "Secure Code Scanning pipelines",
        "required_skills": [("CI/CD", "advanced"), ("OWASP", "advanced"), ("Docker", "intermediate")],
        "optional_skills": [("AWS", "basic"), ("Kubernetes", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.5, "work_type": "hybrid"
    },
    {
        "title": "DevOps Automation Developer (Python)",
        "domain": "DevOps",
        "product_area": "Deployment Scripts Frameworks",
        "required_skills": [("Python", "advanced"), ("Bash", "advanced"), ("Git", "advanced")],
        "optional_skills": [("Docker", "basic"), ("AWS", "basic")],
        "min_experience_years": 2, "min_cgpa": 6.8, "work_type": "remote"
    },
    {
        "title": "Cloud Security SRE",
        "domain": "DevOps",
        "product_area": "Cloud IAM & Networking Security",
        "required_skills": [("AWS", "advanced"), ("Terraform", "intermediate"), ("OWASP", "advanced")],
        "optional_skills": [("Linux", "basic"), ("Kubernetes", "basic")],
        "min_experience_years": 4, "min_cgpa": 8.0, "work_type": "hybrid"
    },
    {
        "title": "Release Manager / Coordinator",
        "domain": "DevOps",
        "product_area": "Production Deployments Orchestrator",
        "required_skills": [("CI/CD", "advanced"), ("Git", "advanced"), ("Jenkins", "advanced")],
        "optional_skills": [("Docker", "basic"), ("AWS", "basic")],
        "min_experience_years": 3, "min_cgpa": 6.5, "work_type": "on-site"
    },
    {
        "title": "Azure SRE Specialist",
        "domain": "DevOps",
        "product_area": "Azure Telemetry & Logging Hub",
        "required_skills": [("Azure", "advanced"), ("Linux", "advanced"), ("Prometheus", "intermediate")],
        "optional_skills": [("Docker", "basic"), ("Kubernetes", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "remote"
    },
    {
        "title": "Systems Administrator (Linux)",
        "domain": "DevOps",
        "product_area": "Internal Server Infrastructure",
        "required_skills": [("Linux", "advanced"), ("Bash", "advanced"), ("Ansible", "intermediate")],
        "optional_skills": [("Docker", "basic"), ("Git", "basic")],
        "min_experience_years": 4, "min_cgpa": 6.5, "work_type": "on-site"
    },
    {
        "title": "CI/CD Pipeline SRE",
        "domain": "DevOps",
        "product_area": "Core Github Actions Workflows",
        "required_skills": [("CI/CD", "advanced"), ("Git", "advanced"), ("Docker", "intermediate")],
        "optional_skills": [("Terraform", "basic"), ("Python", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.2, "work_type": "remote"
    },
    {
        "title": "Terraform Infrastructure Engineer",
        "domain": "DevOps",
        "product_area": "Multi-cloud Core Clusters",
        "required_skills": [("Terraform", "advanced"), ("AWS", "intermediate"), ("Docker", "basic")],
        "optional_skills": [("Azure", "basic"), ("CI/CD", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "Docker Container Specialist",
        "domain": "DevOps",
        "product_area": "Developer Environments Packaging",
        "required_skills": [("Docker", "advanced"), ("Linux", "intermediate"), ("Bash", "intermediate")],
        "optional_skills": [("Kubernetes", "basic"), ("CI/CD", "basic")],
        "min_experience_years": 2, "min_cgpa": 6.8, "work_type": "remote"
    },
    {
        "title": "AWS Cloud SRE",
        "domain": "DevOps",
        "product_area": "Auto-scaling E-Commerce Pipelines",
        "required_skills": [("AWS", "advanced"), ("Prometheus", "intermediate"), ("CI/CD", "intermediate")],
        "optional_skills": [("Docker", "basic"), ("Terraform", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "Platform Infrastructure Lead",
        "domain": "DevOps",
        "product_area": "Enterprise Cloud Operations",
        "required_skills": [("Kubernetes", "advanced"), ("AWS", "advanced"), ("Terraform", "advanced")],
        "optional_skills": [("SRE Foundations", "basic"), ("Bash", "basic")],
        "min_experience_years": 6, "min_cgpa": 7.5, "work_type": "hybrid"
    },

    # --- Data & Analytics (10 roles) ---
    {
        "title": "Data Engineer (Spark / Scala)",
        "domain": "Data Engineering",
        "product_area": "Big Data Extraction Pipelines",
        "required_skills": [("Scala", "advanced"), ("Spark", "advanced"), ("Hadoop", "intermediate")],
        "optional_skills": [("Python", "basic"), ("SQL", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.5, "work_type": "hybrid"
    },
    {
        "title": "Data Warehouse Architect (Snowflake)",
        "domain": "Data Engineering",
        "product_area": "Enterprise Corporate Data Lake",
        "required_skills": [("Snowflake", "advanced"), ("dbt", "advanced"), ("SQL", "advanced")],
        "optional_skills": [("Python", "basic"), ("AWS", "basic")],
        "min_experience_years": 5, "min_cgpa": 7.8, "work_type": "remote"
    },
    {
        "title": "Data Engineer (Python)",
        "domain": "Data Engineering",
        "product_area": "Client Reporting Pipelines",
        "required_skills": [("Python", "advanced"), ("Pandas", "intermediate"), ("SQL", "advanced")],
        "optional_skills": [("Spark", "basic"), ("Docker", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "Business Intelligence Lead",
        "domain": "Data Engineering",
        "product_area": "Executive KPI Tableau Dashboards",
        "required_skills": [("SQL", "advanced"), ("Tableau", "advanced"), ("PowerBI", "advanced")],
        "optional_skills": [("Excel", "advanced"), ("Python", "basic")],
        "min_experience_years": 4, "min_cgpa": 6.8, "work_type": "hybrid"
    },
    {
        "title": "Big Data Platform Engineer",
        "domain": "Data Engineering",
        "product_area": "Core Clusters Data Management",
        "required_skills": [("Hadoop", "advanced"), ("Spark", "advanced"), ("Linux", "intermediate")],
        "optional_skills": [("Scala", "basic"), ("Kubernetes", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.5, "work_type": "on-site"
    },
    {
        "title": "Analytics Pipeline Engineer (dbt)",
        "domain": "Data Engineering",
        "product_area": "Transformed Relational Datasets Hub",
        "required_skills": [("SQL", "advanced"), ("dbt", "advanced"), ("Python", "intermediate")],
        "optional_skills": [("Snowflake", "basic"), ("Git", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.2, "work_type": "remote"
    },
    {
        "title": "Data Engineer (Java)",
        "domain": "Data Engineering",
        "product_area": "High-volume Data Senders",
        "required_skills": [("Java", "advanced"), ("Spark", "intermediate"), ("SQL", "advanced")],
        "optional_skills": [("Docker", "basic"), ("AWS", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "SQL Reporting Specialist",
        "domain": "Data Engineering",
        "product_area": "Custom Financial Queries",
        "required_skills": [("SQL", "advanced"), ("PostgreSQL", "advanced"), ("Excel", "advanced")],
        "optional_skills": [("Tableau", "basic"), ("Git", "basic")],
        "min_experience_years": 2, "min_cgpa": 6.5, "work_type": "remote"
    },
    {
        "title": "Data Lakes Coordinator",
        "domain": "Data Engineering",
        "product_area": "Raw AWS S3 Data Organization",
        "required_skills": [("AWS", "advanced"), ("Python", "intermediate"), ("SQL", "intermediate")],
        "optional_skills": [("Spark", "basic"), ("dbt", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "Spark Streaming Architect",
        "domain": "Data Engineering",
        "product_area": "Real-time Telemetry Data Lakes",
        "required_skills": [("Spark", "advanced"), ("Scala", "intermediate"), ("Kafka", "advanced")],
        "optional_skills": [("Kubernetes", "basic"), ("AWS", "basic")],
        "min_experience_years": 5, "min_cgpa": 8.0, "work_type": "remote"
    },

    # --- QA & SDET (5 roles) ---
    {
        "title": "QA Automation Engineer (Python)",
        "domain": "QA Automation",
        "product_area": "Core API Automation Suite",
        "required_skills": [("Python", "advanced"), ("PyTest", "advanced"), ("Selenium", "advanced")],
        "optional_skills": [("CI/CD", "basic"), ("Postman", "basic")],
        "min_experience_years": 3, "min_cgpa": 6.8, "work_type": "hybrid"
    },
    {
        "title": "SDET Lead (Java & Playwright)",
        "domain": "QA Automation",
        "product_area": "UI Regression Automated Framework",
        "required_skills": [("Java", "advanced"), ("Selenium", "advanced"), ("Playwright", "advanced")],
        "optional_skills": [("TypeScript", "basic"), ("CI/CD", "basic")],
        "min_experience_years": 5, "min_cgpa": 7.2, "work_type": "hybrid"
    },
    {
        "title": "API Testing Engineer",
        "domain": "QA Automation",
        "product_area": "Microservices Integrations Sandbox",
        "required_skills": [("Postman", "advanced"), ("Python", "intermediate"), ("SQL", "intermediate")],
        "optional_skills": [("CI/CD", "basic"), ("Git", "basic")],
        "min_experience_years": 2, "min_cgpa": 6.5, "work_type": "remote"
    },
    {
        "title": "Mobile App QA Engineer",
        "domain": "QA Automation",
        "product_area": "App Store App Compliance",
        "required_skills": [("Appium", "advanced"), ("Java", "intermediate"), ("JavaScript", "basic")],
        "optional_skills": [("Git", "basic"), ("Jira", "basic")],
        "min_experience_years": 3, "min_cgpa": 6.8, "work_type": "hybrid"
    },
    {
        "title": "QA CI/CD Integration Specialist",
        "domain": "QA Automation",
        "product_area": "Automated Testing Pipeline",
        "required_skills": [("CI/CD", "advanced"), ("Python", "intermediate"), ("Playwright", "advanced")],
        "optional_skills": [("Docker", "basic"), ("Git", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "remote"
    },

    # --- Product Management (5 roles) ---
    {
        "title": "Technical Product Manager (TPM)",
        "domain": "Product Management",
        "product_area": "Core Payments Infrastructure",
        "required_skills": [("Product Management", "advanced"), ("SQL", "intermediate"), ("System Architecture", "basic")],
        "optional_skills": [("Agile", "advanced"), ("Figma", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.0, "work_type": "hybrid"
    },
    {
        "title": "Product Owner - Developer Platforms",
        "domain": "Product Management",
        "product_area": "Internal Developer Tools APIs",
        "required_skills": [("Product Management", "advanced"), ("Agile", "advanced"), ("REST APIs", "basic")],
        "optional_skills": [("Jira", "advanced"), ("Git", "basic")],
        "min_experience_years": 3, "min_cgpa": 7.0, "work_type": "remote"
    },
    {
        "title": "AI Product Manager",
        "domain": "Product Management",
        "product_area": "Enterprise LLM Assistant Integration",
        "required_skills": [("Product Management", "advanced"), ("LLMs", "basic"), ("Agile", "advanced")],
        "optional_skills": [("Python", "basic"), ("Tableau", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.5, "work_type": "hybrid"
    },
    {
        "title": "Product PM - Analytics Suite",
        "domain": "Product Management",
        "product_area": "Customer Reporting Metrics Panel",
        "required_skills": [("Product Management", "advanced"), ("Tableau", "intermediate"), ("SQL", "basic")],
        "optional_skills": [("Agile", "advanced"), ("Figma", "basic")],
        "min_experience_years": 3, "min_cgpa": 6.8, "work_type": "remote"
    },
    {
        "title": "E-Commerce Product Manager",
        "domain": "Product Management",
        "product_area": "Shopping Cart & Loyalty Programs",
        "required_skills": [("Product Management", "advanced"), ("Agile", "advanced"), ("Figma", "basic")],
        "optional_skills": [("SQL", "basic"), ("Jira", "basic")],
        "min_experience_years": 4, "min_cgpa": 7.0, "work_type": "hybrid"
    }
]


def generate_job_description(title, domain, company, required_skills, product_area):
    skills_str = ", ".join([s[0] for s in required_skills])
    return f"""### Role Overview
We are looking for a highly skilled and motivated **{title}** to join our engineering division at {company}. In this role, you will be part of the **{product_area}** team, working on high-throughput services, scalable system designs, and user-facing experiences. You will leverage modern technologies including **{skills_str}** to build reliable, high-performance software.

### Key Responsibilities
- Architect, build, and maintain production-grade modules and systems within the **{product_area}** business unit.
- Write clean, testable, and documented code using industry best practices.
- Collaborate with product managers, UX designers, and other engineers to scope and execute major roadmap features.
- Optimize database queries, reduce API latency, and ensure system reliability and observability.
- Participate in code reviews, engineering design discussions, and mentor junior team members.

### Ideal Candidate Profile
- Solid understanding of **{domain}** engineering principles and modern software architectures.
- Professional experience writing clean and efficient code with **{skills_str}**.
- Proven ability to troubleshoot and solve complex distributed system problems.
- Strong communication and collaboration skills with a passion for continuous learning and mentoring.
"""


def clear_database(db):
    """Clean all database tables to guarantee a fresh slate seeding."""
    logger.info("Purging existing database tables...")
    
    # 1. Purge dependency relations
    db.query(JobRecommendation).delete()
    db.query(JobApplication).delete()
    db.query(UserFeedback).delete()
    
    # 2. Purge embeddings indexes
    db.query(JobEmbedding).delete()
    db.query(JobEmbeddingsCache).delete()
    db.query(JobMetadata).delete()
    db.query(ApplicantEmbedding).delete()
    db.query(EmbeddingsIndex).delete()

    # 3. Purge ancillary tables
    db.query(LearningPath).delete()
    db.query(HumanReview).delete()
    db.query(Upload).delete()
    db.query(LLMParsedRecord).delete()
    
    # 4. Purge mock interview tables
    db.query(InterviewAnswer).delete()
    db.query(InterviewQuestion).delete()
    db.query(InterviewSession).delete()
    db.query(SkillAssessment).delete()
    
    # 5. Purge credit system tables
    db.query(CreditTransaction).delete()
    db.query(CreditUsageStats).delete()
    db.query(CreditAccount).delete()
    
    # 6. Purge primary entities
    db.query(Job).delete()
    db.query(Applicant).delete()
    db.query(Employer).delete()
    db.query(User).delete()
    
    db.commit()
    logger.info("✓ Database purge completed successfully.")


def ensure_user(db, email: str, password_plain: str, role: str, name: str) -> User:
    user = User(
        email=email,
        password_hash=get_password_hash(password_plain),
        role=role,
        name=name,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def ensure_applicant(db, user: User, location_city: str) -> Applicant:
    applicant = Applicant(
        user_id=user.id,
        applicant_id=f"app_{user.id:04d}",
        display_name=user.name,
        location_city=location_city,
        location_state="",
        country="India",
        preferred_locations=[location_city, "Remote"],
    )
    db.add(applicant)
    db.commit()
    db.refresh(applicant)
    return applicant


def ensure_resume_artifacts(db, applicant: Applicant, skill_names):
    upload = Upload(
        applicant_id=applicant.id,
        file_name=f"{applicant.applicant_id}_resume.txt",
        file_type="resume",
        storage_path=f"./data/raw_files/{applicant.applicant_id}/resume.txt",
        file_hash=f"seed-{applicant.applicant_id}",
        ocr_used=False,
    )
    db.add(upload)

    # Rich normalized resume parsed data
    normalized = {
        "personal": {"name": applicant.display_name, "location": applicant.location_city},
        "education": [{"degree": "B.Tech", "grade": round(random.uniform(7.0, 9.4), 2)}],
        "skills": [{"name": skill} for skill in skill_names],
        "projects": [
            {"name": "Portfolio Project", "technologies": skill_names[:3]},
            {"name": "API Service", "technologies": skill_names[-3:]},
        ],
        "experience": [
            {
                "title": f"Junior {skill_names[0]} Engineer",
                "company": "Tech Solutions Ltd",
                "start_date": "2024",
                "end_date": "2025",
                "description": f"Worked with a team of developers to build web applications. Implemented core modules using {skill_names[0]} and {skill_names[1]}. Improved platform runtime efficiency by 20%."
            }
        ],
        "certifications": [{"name": f"{skill_names[0]} Fundamentals"}],
    }

    db.add(
        LLMParsedRecord(
            applicant_id=applicant.id,
            raw_llm_output=normalized,
            normalized=normalized,
            field_confidences={"skills": 0.95, "experience": 0.90},
            llm_provenance={"provider": "seed", "model": "static"},
            needs_review=False,
        )
    )
    
    # Initialize credit account with 60 credits
    db.add(
        CreditAccount(
            applicant_id=applicant.id,
            current_credits=60,
            total_earned=60,
            total_spent=0,
            last_refill_at=datetime.utcnow(),
            next_refill_at=datetime.utcnow() + timedelta(days=7),
            weekly_credit_limit=60,
            is_premium=False
        )
    )
    
    db.commit()


def ensure_employer(db, user: User, company_name: str, location_city: str) -> Employer:
    employer = Employer(
        user_id=user.id,
        company_name=company_name,
        website=f"https://{company_name.lower()}.gmail.com",
        location_city=location_city,
        location_state="",
        description=f"{company_name} Recruiting and HR Acquisition Team",
        is_verified=True,
    )
    db.add(employer)
    db.commit()
    db.refresh(employer)
    return employer


def seed_jobs(db, employers):
    logger.info(f"Seeding {len(JOB_DEFS)} diversified jobs across {len(employers)} recruiters...")
    created_jobs = []
    
    for i, job_def in enumerate(JOB_DEFS):
        employer = employers[i % len(employers)]
        
        # Structure the required/optional skills as a JSON array of dicts
        req_skills = [{"name": s[0], "level": s[1]} for s in job_def["required_skills"]]
        opt_skills = [{"name": s[0], "level": s[1]} for s in job_def["optional_skills"]]
        
        # Compose clean markdown JDs
        description = generate_job_description(
            title=job_def["title"],
            domain=job_def["domain"],
            company=employer.company_name,
            required_skills=job_def["required_skills"],
            product_area=job_def["product_area"]
        )
        
        # Create Job object
        job = Job(
            employer_id=employer.id,
            title=job_def["title"],
            description=description,
            location_city=employer.location_city,
            location_state="",
            work_type=job_def["work_type"],
            min_experience_years=float(job_def["min_experience_years"]),
            min_cgpa=float(job_def["min_cgpa"]),
            required_skills=req_skills,
            optional_skills=opt_skills,
            status="approved",
            expires_at=datetime.utcnow() + timedelta(days=60),
        )
        db.add(job)
        db.flush()
        created_jobs.append(job)
        
    db.commit()
    logger.info(f"✓ Successfully seeded {len(created_jobs)} jobs.")
    return created_jobs


def seed_applications_and_run_recommender(db, applicants, jobs):
    """Seed sample job applications and execute the recommendation engine scoring."""
    logger.info("Seeding job applications and running dynamic recommendations pipeline...")
    
    # 1. Let each applicant apply to 2 random jobs matching one of their core skills
    for applicant in applicants:
        # Get applicant skills
        skills_set = set(STUDENT_SKILLS[applicant.display_name])
        
        # Filter jobs that match at least one applicant skill
        matching_jobs = []
        for job in jobs:
            job_skills = [s["name"] for s in job.required_skills]
            if any(s in skills_set for s in job_skills):
                matching_jobs.append(job)
                
        if not matching_jobs:
            matching_jobs = jobs
            
        applied_jobs = random.sample(matching_jobs, min(2, len(matching_jobs)))
        
        for job in applied_jobs:
            db.add(
                JobApplication(
                    applicant_id=applicant.id,
                    job_id=job.id,
                    cover_letter=f"Hi Team, I am extremely interested in joining the {job.title} team. My background and skill set in modern engineering practices aligns perfectly with your requirements.",
                    status=random.choice(["applied", "under_review", "shortlisted"]),
                )
            )
            
            # Log corresponding user feedback click/apply
            db.add(
                UserFeedback(
                    applicant_id=applicant.id,
                    job_id=job.id,
                    action_type="apply"
                )
            )
            
    db.commit()
    logger.info("✓ Sample job applications seeded.")

    # 2. Run the dynamic recommendation engine for every applicant to backfill true scores!
    try:
        import resume_pipeline.recommendation.explainer as explainer
        import resume_pipeline.recommendation.engine as engine
        
        # Mock explanation generation to run lightning-fast during seeding
        def mock_generate_explanation(applicant, job, breakdown):
            req_skill_names = [s["name"] for s in job.required_skills or []]
            return f"Excellent match on required skills such as {', '.join(req_skill_names[:2])}.", "seed_mock"

        def mock_generate_employer_match_analysis(applicant, job, breakdown):
            req_skill_names = [s["name"] for s in job.required_skills or []]
            cand_skills = []
            if applicant.parsed_record and applicant.parsed_record.normalized:
                skills = applicant.parsed_record.normalized.get("skills", [])
                cand_skills = [s.get("name", "") if isinstance(s, dict) else str(s) for s in skills]
            missing_skills = [s for s in req_skill_names if s not in cand_skills]
            missing_str = ", ".join(missing_skills[:3]) if missing_skills else "None critical"
            return {
                "reasons": f"Strong technical alignment on core required technologies like {', '.join(req_skill_names[:3])}.",
                "gaps": f"Missing direct mention of: {missing_str} in resume." if missing_skills else "No major skill gaps identified."
            }

        # Dynamic mock injection for BOTH namespaces (explainer and engine modules)
        explainer.generate_explanation = mock_generate_explanation
        explainer.generate_employer_match_analysis = mock_generate_employer_match_analysis
        engine.generate_explanation = mock_generate_explanation
        engine.generate_employer_match_analysis = mock_generate_employer_match_analysis
        
        from resume_pipeline.recommendation.engine import compute_recommendations
        for applicant in applicants:
            logger.info(f"Recalculating dynamic recommendations for: {applicant.display_name}...")
            compute_recommendations(applicant.id, db)
        logger.info("✓ Dynamic recommendation calculations completed successfully.")
    except Exception as e:
        logger.error(f"Failed to run dynamic recommendation pipeline: {e}", exc_info=True)


def main():
    # Make sure all tables exist
    init_db()

    db = SessionLocal()
    try:
        # Clear all existing tables
        clear_database(db)
        
        # 1. Create Platform Admin (Gmail login, password: 12345678)
        admin = ensure_user(db, "admin@gmail.com", "12345678", "admin", "Platform Admin")
        logger.info(f"✓ Platform Admin created: {admin.email}")

        # 2. Create Students/Applicants
        applicants = []
        for name, email, city in STUDENTS:
            user = ensure_user(db, email, "12345678", "student", name)
            applicant = ensure_applicant(db, user, city)
            ensure_resume_artifacts(db, applicant, STUDENT_SKILLS[name])
            applicants.append(applicant)
        logger.info(f"✓ {len(applicants)} Students seeded.")

        # 3. Create Employers/Recruiters
        employers = []
        for name, email, company, city in RECRUITERS:
            user = ensure_user(db, email, "12345678", "employer", name)
            employers.append(ensure_employer(db, user, company, city))
        logger.info(f"✓ {len(employers)} Recruiters seeded.")

        # 4. Seed 115 diversified jobs
        jobs = seed_jobs(db, employers)

        # 5. Seed Applications and trigger dynamic recommendations backfill
        seed_applications_and_run_recommender(db, applicants, jobs)

        logger.info("\n================ SEED COMPLETE ================")
        logger.info(f"Students (Applicants): {db.query(Applicant).count()}")
        logger.info(f"Employers (Recruiters): {db.query(Employer).count()}")
        logger.info(f"Jobs (Approved): {db.query(Job).count()}")
        logger.info(f"Job Recommendations: {db.query(JobRecommendation).count()}")
        logger.info(f"Job Applications: {db.query(JobApplication).count()}")
        logger.info("===============================================")
    finally:
        db.close()


if __name__ == "__main__":
    main()