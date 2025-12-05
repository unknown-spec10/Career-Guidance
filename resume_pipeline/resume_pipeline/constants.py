"""
Application constants for consistent configuration
"""

# LLM Thresholds
LLM_CONFIDENCE_THRESHOLD = 0.7  # Minimum confidence score for LLM responses
MAX_UNKNOWN_SKILLS = 5  # Maximum allowed unknown skills before flagging

# Validation Thresholds
CGPA_MISMATCH_THRESHOLD = 0.5  # Maximum CGPA difference before overriding
MAX_RESUME_TEXT_WORDS = 2000  # Maximum words before summarization

# Pagination
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 100

# Recommendation Scoring Weights (adjusted for interview integration)
RECOMMENDATION_WEIGHTS = {
    'JEE_RANK_SCORE': 35.0,  # Reduced from 40
    'CGPA_SCORE': 25.0,  # Reduced from 30
    'SKILLS_SCORE': 25.0,  # Reduced from 30
    'INTERVIEW_SCORE': 15.0,  # NEW - based on mock interview performance
    'ACADEMIC_SCORE': 20.0,  # Reduced from 25
    'EXPERIENCE_SCORE': 20.0,  # Reduced from 25
    'ASSESSMENT_SCORE': 10.0,  # NEW - bonus for skill assessments
    'MIN_JOB_RECOMMENDATION_SCORE': 35.0,  # Reduced from 40
}

# Interview & Assessment Configuration
INTERVIEW_CONFIG = {
    'SESSION_DURATION_SECONDS': 1800,  # 30 minutes for full interview
    'MICRO_SESSION_DURATION_SECONDS': 300,  # 5 minutes for micro-session
    'SCORE_FRESHNESS_MONTHS': 6,  # Prompt retake after 6 months
    'MCQ_COUNT_RANGE': (5, 10),  # 5-10 MCQ questions per session
    'SHORT_ANSWER_COUNT_RANGE': (2, 5),  # 2-5 short answer questions
    'MIN_PASSING_SCORE': 40.0,  # Minimum score to pass
    'DIFFICULTY_ADJUSTMENT_THRESHOLD': 70.0,  # Increase difficulty if score > 70
    'MAX_SESSIONS_PER_DAY': 10,  # Max any interview sessions per day
}

# Credit-Based Quota System
CREDIT_CONFIG = {
    # Credit costs
    'FULL_MOCK_INTERVIEW_COST': 10,  # 1 full interview = 10 credits
    'MICRO_SESSION_COST': 1,  # 1 micro-session (1 question) = 1 credit
    'CODING_QUESTION_COST': 1,  # 1 Gemini coding question = 1 credit
    'PROJECT_IDEA_COST': 2,  # 1 project idea generation = 2 credits
    
    # Credit limits (free tier)
    'DEFAULT_WEEKLY_CREDITS': 60,  # 60 credits per week (4 full + 20 micro)
    'MAX_DAILY_CREDITS_USAGE': 30,  # Max 30 credits per day to prevent abuse
    'CREDITS_REFILL_DAYS': 7,  # Refill every 7 days from last refill
    
    # Session limits
    'MAX_FULL_INTERVIEWS_PER_WEEK': 4,  # 4 full interviews per week
    'MAX_MICRO_SESSIONS_PER_DAY': 10,  # 10 micro-sessions per day
    'MAX_CODING_QUESTIONS_PER_DAY': 10,  # 10 coding questions per day
    'MAX_PROJECT_IDEAS_PER_WEEK': 10,  # 10 project ideas per week
    
    # Token budgets (for optimization)
    'FULL_MOCK_TOKEN_BUDGET': 5000,  # Target 5k tokens per full interview
    'MICRO_SESSION_TOKEN_BUDGET': 800,  # Target 800 tokens per micro-session
    'CODING_QUESTION_TOKEN_BUDGET': 500,  # Target 500 tokens per coding question
    'PROJECT_IDEA_TOKEN_BUDGET': 1000,  # Target 1k tokens per project idea
}

# Interview Question Types
QUESTION_TYPES = ['mcq', 'short_answer', 'coding', 'theory', 'behavioral']

# Interview Categories
INTERVIEW_CATEGORIES = [
    'DSA', 'Python', 'Java', 'JavaScript', 'C++', 
    'DBMS', 'SQL', 'OS', 'OOP', 'System Design',
    'Machine Learning', 'Data Structures', 'Algorithms',
    'Networking', 'Cloud Computing', 'DevOps'
]

# Difficulty Levels
DIFFICULTY_LEVELS = ['easy', 'medium', 'hard']

# Proficiency Mapping (based on assessment scores)
PROFICIENCY_MAPPING = {
    (0, 40): 'beginner',
    (40, 60): 'intermediate',
    (60, 80): 'advanced',
    (80, 100): 'expert'
}

# Interview Score Multipliers for Recommendations
INTERVIEW_SCORE_MULTIPLIERS = {
    'excellent': 1.0,  # >= 80: Full 15 points
    'good': 0.67,  # 60-79: 10 points
    'average': 0.33,  # 40-59: 5 points
    'poor': 0.0,  # < 40: 0 points
}

# File Upload
MAX_FILE_SIZE_MB = 10
ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.doc', '.txt'}
ALLOWED_MIME_TYPES = {
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
}

# Database
DEFAULT_BATCH_SIZE = 100

# API Response Messages
API_MESSAGES = {
    'APPLICANT_NOT_FOUND': 'Applicant not found',
    'NO_PARSED_DATA': 'No parsed resume data found. Please parse resume first.',
    'INVALID_FILE_TYPE': 'Invalid file type. Supported: PDF, DOCX, DOC, TXT',
    'COLLEGE_NOT_FOUND': 'College not found',
    'JOB_NOT_FOUND': 'Job not found',
    'UPLOAD_SUCCESS': 'File uploaded successfully',
    'PARSE_SUCCESS': 'Resume parsed successfully',
}
