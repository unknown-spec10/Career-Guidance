"""
Update existing jobs and college programs with detailed, realistic content
"""
import sys
import random
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from resume_pipeline.db import SessionLocal, Job, CollegeProgram

def update_job_descriptions(db):
    """Update all jobs with detailed descriptions"""
    print(f"\n{'='*60}")
    print("Updating job descriptions...")
    print(f"{'='*60}\n")
    
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
    
    # Generic template for other job titles
    generic_template = """We are looking for a talented professional to join our growing team. This is an exciting opportunity to work on challenging problems and make a real impact.

**Key Responsibilities:**
• Contribute to the design and development of our products
• Collaborate with cross-functional teams
• Write clean, maintainable code
• Participate in code reviews and team discussions
• Stay current with industry trends and best practices

**Required Qualifications:**
• Bachelor's degree in relevant field
• Strong problem-solving and analytical skills
• Excellent communication abilities
• Team player with positive attitude
• Self-motivated with ability to work independently

**Preferred Qualifications:**
• Experience in related technologies
• Contributions to open-source projects
• Industry certifications

**Benefits:**
• Competitive compensation package
• Flexible work arrangements
• Health insurance and wellness programs
• Learning and development opportunities
• Collaborative work environment"""
    
    jobs = db.query(Job).all()
    updated = 0
    
    for job in jobs:
        template = job_templates.get(job.title)
        if template:
            job.description = template["description"]
        else:
            # Use generic template with job title
            job.description = f"""We are seeking a {job.title} to join our team and contribute to exciting projects.

{generic_template}"""
        
        updated += 1
        if updated % 10 == 0:
            print(f"✓ Updated {updated}/{len(jobs)} jobs...")
    
    db.commit()
    print(f"\n✓ Successfully updated {updated} job descriptions!\n")
    return updated


def update_program_descriptions(db):
    """Update all college programs with detailed descriptions"""
    print(f"\n{'='*60}")
    print("Updating program descriptions...")
    print(f"{'='*60}\n")
    
    program_templates = {
        "Computer Science": """This comprehensive Computer Science program combines theoretical foundations with practical applications. Students will master core concepts in algorithms, data structures, software engineering, and systems design. The curriculum includes hands-on projects in web development, mobile applications, cloud computing, and emerging technologies like AI/ML. Our state-of-the-art labs and industry partnerships provide real-world experience through internships and collaborative projects. Graduates are well-prepared for careers in software development, systems architecture, cybersecurity, and research.""",
        
        "Electronics": """The Electronics Engineering program offers an in-depth study of electronic circuits, embedded systems, signal processing, and communication technologies. Students gain expertise in VLSI design, IoT systems, and semiconductor devices through extensive laboratory work and industrial training. The curriculum emphasizes both analog and digital electronics, preparing graduates for roles in telecommunications, consumer electronics, automation, and research & development in cutting-edge technologies.""",
        
        "Mechanical": """Our Mechanical Engineering program provides a strong foundation in thermodynamics, fluid mechanics, materials science, and manufacturing processes. Students engage in hands-on projects involving CAD/CAM, robotics, and renewable energy systems. The curriculum integrates traditional mechanical principles with modern computational tools and Industry 4.0 technologies. Graduates pursue careers in automotive, aerospace, energy, manufacturing, and product design sectors.""",
        
        "Data Science": """The Data Science program is designed to produce skilled professionals who can extract insights from complex datasets. Students learn statistical analysis, machine learning, big data technologies, and data visualization through project-based learning. The curriculum covers Python/R programming, deep learning frameworks, cloud-based analytics, and business intelligence tools. Industry collaborations provide exposure to real-world data challenges. Graduates are in high demand for roles in analytics, AI/ML engineering, business intelligence, and research.""",
        
        "Electrical": """The Electrical Engineering program covers power systems, control systems, renewable energy, and electrical machines. Students develop expertise in power generation, transmission, distribution, and utilization. The curriculum includes practical training in smart grids, energy management, and sustainable technologies. Graduates find opportunities in power sector, electrical equipment manufacturing, automation industries, and research institutions.""",
        
        "Civil": """Our Civil Engineering program focuses on infrastructure development, structural design, and construction management. Students learn surveying, building design, transportation engineering, and environmental systems. The curriculum emphasizes sustainable construction practices, earthquake-resistant structures, and modern project management techniques. Graduates work in construction companies, government agencies, consulting firms, and infrastructure development projects.""",
        
        "Chemical": """The Chemical Engineering program provides comprehensive knowledge of chemical processes, reaction engineering, and process optimization. Students gain hands-on experience in process design, plant operations, and safety management. The curriculum covers petrochemicals, pharmaceuticals, food processing, and environmental engineering. Graduates pursue careers in chemical industries, oil refineries, pharmaceutical companies, and research laboratories."""
    }
    
    programs = db.query(CollegeProgram).all()
    updated = 0
    
    for program in programs:
        # Extract the major from program name (e.g., "B.Tech in Computer Science" -> "Computer Science")
        major = program.program_name.replace("B.Tech in ", "").replace("M.Tech in ", "").strip()
        
        # Find matching template
        description = None
        for key, template in program_templates.items():
            if key in major:
                description = template
                break
        
        if not description:
            # Generic fallback
            description = f"""The {program.program_name} is a comprehensive program designed to provide students with both theoretical knowledge and practical skills. The curriculum includes core subjects, laboratory sessions, industry internships, and project work. Students benefit from experienced faculty, modern facilities, and industry collaborations. Graduates are well-prepared for careers in their chosen field or for pursuing higher studies."""
        
        program.program_description = description
        updated += 1
    
    db.commit()
    print(f"✓ Successfully updated {updated} program descriptions!\n")
    return updated


def main():
    """Main update function"""
    print(f"\n{'='*60}")
    print("CONTENT UPDATE SCRIPT")
    print(f"{'='*60}\n")
    
    db = SessionLocal()
    
    try:
        # Update job descriptions
        jobs_updated = update_job_descriptions(db)
        
        # Update program descriptions
        programs_updated = update_program_descriptions(db)
        
        print(f"\n{'='*60}")
        print("UPDATE COMPLETE")
        print(f"{'='*60}")
        print(f"✓ Updated {jobs_updated} job descriptions")
        print(f"✓ Updated {programs_updated} program descriptions")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"\n❌ Error during update: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
