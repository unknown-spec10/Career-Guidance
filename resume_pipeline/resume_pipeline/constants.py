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

# Recommendation Scoring Weights
RECOMMENDATION_WEIGHTS = {
    'JEE_RANK_SCORE': 40.0,
    'CGPA_SCORE': 30.0,
    'SKILLS_SCORE': 30.0,
    'ACADEMIC_SCORE': 25.0,
    'EXPERIENCE_SCORE': 25.0,
    'MIN_JOB_RECOMMENDATION_SCORE': 40.0,
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
