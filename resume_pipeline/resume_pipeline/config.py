from pydantic_settings import BaseSettings
from dotenv import load_dotenv
from pathlib import Path
from urllib.parse import quote_plus

# Load .env from workspace root if present
load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env")

class Settings(BaseSettings):
    # Prefer separate fields; fallback to PG_DSN if fully provided
    PG_HOST: str | None = None
    PG_PORT: int | None = None
    PG_USER: str | None = None
    PG_PASSWORD: str | None = None
    PG_DB: str | None = None
    # Demo/test mode: use in-memory SQLite by default (no persistence)
    # For production, set PG_DSN or the individual PG_* fields above
    PG_DSN: str | None = None
    FILE_STORAGE_PATH: str = "./data/raw_files"
    GEMINI_API_KEY: str = ""
    GEMINI_API_URL: str = "https://generativelanguage.googleapis.com/v1beta"
    GEMINI_SMALL_MODEL: str = "gemini-2.5-flash"
    GEMINI_LARGE_MODEL: str = "gemini-2.5-flash"
    GEMINI_MOCK_MODE: bool = False
    EMBEDDING_MODEL: str = "embedding-gecko-001"
    MAX_PARSE_TOKENS: int = 12000
    
    # Parsing thresholds
    LLM_CONFIDENCE_THRESHOLD: float = 0.7
    CGPA_MISMATCH_THRESHOLD: float = 0.2
    MAX_SUMMARY_SENTENCES: int = 10
    MAX_UNKNOWN_SKILLS: int = 5
    LONG_DOC_WORD_THRESHOLD: int = 2000
    
    # API server
    API_HOST: str = "localhost"
    API_PORT: int = 8000
    
    # JWT Authentication
    SECRET_KEY: str = "change-this-secret-key-in-production-use-openssl-rand-hex-32"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # Skill taxonomy (optional JSON file path)
    SKILL_TAXONOMY_PATH: str | None = None
    SKILL_TAXONOMY_METADATA_PATH: str | None = None
    
    # ============================================================================
    # SEMANTIC SKILL MATCHING CONFIGURATION
    # Uses embeddings + taxonomy for intelligent skill normalization & matching
    # ============================================================================
    SEMANTIC_MATCHING_ENABLED: bool = True              # Feature toggle
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"     # Lightweight, fast local model
    SEMANTIC_SIMILARITY_THRESHOLD: float = 0.70         # Min confidence for canonical match
    RELATED_SKILL_WEIGHT: float = 0.60                  # Weight for related skill matches
    EXACT_MATCH_WEIGHT: float = 1.0                     # Weight for exact matches
    SEMANTIC_MATCH_WEIGHT: float = 0.85                 # Weight for embedding-based matches
    CATEGORY_MATCH_WEIGHT: float = 0.40                 # Weight for same-category matches
    
    # Google Search API for skill taxonomy builder
    GOOGLE_API_KEY: str | None = None
    GOOGLE_SEARCH_ENGINE_ID: str | None = None
    
    # Gmail SMTP for email verification
    GMAIL_USER: str | None = None
    GMAIL_APP_PASSWORD: str | None = None
    FRONTEND_URL: str = "http://localhost:5173"
    
    # Groq API for RAG Q&A system
    GROQ_API_KEY: str | None = None
    
    # CORS Origins - configurable for cloud deployments
    # In development: localhost:3000 and localhost:5173
    # In production: add your frontend domain, Cloud Run domain, etc.
    # Format: comma-separated list
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # Email verification mode: "link" or "code"
    EMAIL_VERIFICATION_MODE: str = "code"
    VERIFICATION_CODE_LENGTH: int = 6
    VERIFICATION_CODE_TTL_MINUTES: int = 30

    # ============================================================================
    # COLLEGE RECOMMENDATION WEIGHTS (Academic-focused)
    # Sum should equal 1.0 for normalized scoring
    # ============================================================================
    COLLEGE_REC_CGPA_WEIGHT: float = 0.25           # 25% - Academic performance
    COLLEGE_REC_JEE_RANK_WEIGHT: float = 0.20       # 20% - Entrance exam performance
    COLLEGE_REC_ACADEMIC_WEIGHT: float = 0.15      # 15% - Academic achievements
    COLLEGE_REC_SKILLS_WEIGHT: float = 0.15         # 15% - Relevant skills
    COLLEGE_REC_PROJECTS_WEIGHT: float = 0.10       # 10% - Academic projects
    COLLEGE_REC_INTERVIEW_WEIGHT: float = 0.10      # 10% - Interview performance
    COLLEGE_REC_CERTIFICATIONS_WEIGHT: float = 0.05 # 5% - Certifications
    
    # ============================================================================
    # JOB RECOMMENDATION WEIGHTS (Skills & Experience-focused)
    # Sum should equal 1.0 for normalized scoring
    # ============================================================================
    JOB_REC_SKILLS_WEIGHT: float = 0.35             # 35% - Technical skills match
    JOB_REC_EXPERIENCE_WEIGHT: float = 0.20         # 20% - Work experience
    JOB_REC_CERTIFICATIONS_WEIGHT: float = 0.10     # 10% - Industry certifications
    JOB_REC_LOCATION_WEIGHT: float = 0.10           # 10% - Location preference
    JOB_REC_INTERVIEW_WEIGHT: float = 0.08          # 8% - Interview performance
    JOB_REC_PROJECTS_WEIGHT: float = 0.05           # 5% - Project experience
    JOB_REC_WORK_TYPE_WEIGHT: float = 0.05          # 5% - Work type preference
    JOB_REC_SALARY_WEIGHT: float = 0.05             # 5% - Salary alignment
    JOB_REC_EDUCATION_WEIGHT: float = 0.02          # 2% - Education requirements
    
    # Legacy weights (backward compatibility)
    RECOMMENDATION_SKILLS_WEIGHT: float = 0.40
    RECOMMENDATION_EDUCATION_WEIGHT: float = 0.25
    RECOMMENDATION_EXPERIENCE_WEIGHT: float = 0.20
    RECOMMENDATION_INTERVIEW_WEIGHT: float = 0.15
    
    # Recommendation thresholds
    MIN_RECOMMENDATION_SCORE: float = 0.25  # 25% minimum match score
    MIN_COLLEGE_REC_SCORE: float = 0.25     # College-specific minimum
    MIN_JOB_REC_SCORE: float = 0.10         # Job-specific minimum (lowered to 10% for testing)
    MAX_RECOMMENDATIONS: int = 10           # Maximum recommendations to return
    
    # RAG System Configuration
    RAG_PRELOAD_ON_STARTUP: bool = False    # Pre-initialize RAG on startup (vs lazy init on first query)
    RAG_ENABLE_FILE_WATCHER: bool = True    # Enable automatic doc reloading when files change
    RAG_FILE_WATCHER_DEBOUNCE: float = 2.0  # Debounce file changes for N seconds

settings = Settings()

# ============================================================================
# Environment auto-detection
# Supabase hosts always contain "supabase.co" in PG_HOST.
# This controls:
#   1. Whether SSL is added to the DSN
#   2. Whether startup skips CREATE DATABASE (Supabase manages the DB)
# ============================================================================
_pg_host = settings.PG_HOST or ""
IS_SUPABASE: bool = "supabase.co" in _pg_host

# Build DSN from parts if PG_DSN not explicitly set
if not settings.PG_DSN:
    if settings.PG_HOST:
        host = settings.PG_HOST
        port = settings.PG_PORT or 5432
        user = settings.PG_USER or "postgres"
        pwd_raw = settings.PG_PASSWORD or ""
        pwd = quote_plus(pwd_raw)
        dbname = settings.PG_DB or "resumes"

        if IS_SUPABASE:
            # Supabase requires SSL and disables prepared-statement caching
            # (pgbouncer-compatible even in session-pooler mode)
            settings.PG_DSN = (
                f"postgresql+psycopg2://{user}:{pwd}@{host}:{port}/{dbname}"
                f"?sslmode=require&options=-c%20statement_timeout%3D30000"
            )
        else:
            settings.PG_DSN = (
                f"postgresql+psycopg2://{user}:{pwd}@{host}:{port}/{dbname}"
            )
    else:
        # Demo/test: in-memory SQLite for zero-cost demos
        settings.PG_DSN = "sqlite:///:memory:"
        IS_SUPABASE = False
else:
    # If an explicit PG_DSN was provided, still detect Supabase from it
    IS_SUPABASE = "supabase.co" in settings.PG_DSN

