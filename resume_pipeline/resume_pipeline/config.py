from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv
from pathlib import Path
from urllib.parse import quote_plus
import os

# In production (Render), OS env vars are already set — do NOT let .env override them.
# In local dev, .env is not present in the container so this only runs locally.
_env_file = Path(__file__).resolve().parents[2] / ".env"
if not os.environ.get("RENDER"):
    load_dotenv(dotenv_path=_env_file, override=False)

class Settings(BaseSettings):
    # Pydantic-settings: only read from OS environment, never from .env files.
    # This ensures Render's injected env vars always win over any baked-in .env.
    model_config = SettingsConfigDict(env_file=None, extra="ignore")
    # Prefer separate fields; fallback to PG_DSN if fully provided
    PG_HOST: str | None = None
    PG_PORT: int | None = None
    PG_USER: str | None = None
    PG_PASSWORD: str | None = None
    PG_DB: str | None = None
    # PostgreSQL DSN (optional if PG_* fields are provided)
    PG_DSN: str | None = None
    FILE_STORAGE_PATH: str = "./data/raw_files"
    GEMINI_API_KEY: str = ""
    GEMINI_API_URL: str = "https://generativelanguage.googleapis.com/v1beta"
    GEMINI_SMALL_MODEL: str = "gemini-3-flash-preview"
    GEMINI_LARGE_MODEL: str = "gemini-3-pro-preview"
    GEMINI_MOCK_MODE: bool = False
    EMBEDDING_MODEL: str = "gemini-embedding-2-preview"
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
    
    # JWT Authentication (must come from environment in production)
    SECRET_KEY: str = ""
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
    GOOGLE_EMBEDDING_ENABLED: bool = True               # Primary embedding provider toggle
    EMBEDDING_TIMEOUT_SECONDS: int = 30                 # HTTP timeout for embedding API
    EMBEDDING_CACHE_MAX_ITEMS: int = 2000               # In-memory embedding cache cap
    EMBEDDING_FALLBACK_ENABLED: bool = True             # Allow MiniLM fallback on API failure
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
    MIN_JOB_REC_SCORE: float = 0.10         # Job-specific minimum (lowered to 10% for testing)
    MAX_RECOMMENDATIONS: int = 10           # Maximum recommendations to return
    
    # RAG System Configuration
    RAG_PRELOAD_ON_STARTUP: bool = False    # Pre-initialize RAG on startup (vs lazy init on first query)
    RAG_ENABLE_FILE_WATCHER: bool = True    # Enable automatic doc reloading when files change
    RAG_FILE_WATCHER_DEBOUNCE: float = 2.0  # Debounce file changes for N seconds

    # Async embedding pipeline (Celery + Redis)
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"
    CELERY_DEFAULT_QUEUE: str = "default"
    CELERY_EMBEDDINGS_QUEUE: str = "embeddings"
    CELERY_TASK_ALWAYS_EAGER: bool = False
    CELERY_TASK_SOFT_TIME_LIMIT_SECONDS: int = 120
    CELERY_TASK_TIME_LIMIT_SECONDS: int = 180
    EMBEDDING_TASK_MAX_RETRIES: int = 3
    EMBEDDING_TASK_RETRY_BACKOFF_SECONDS: int = 10
    USE_VECTOR_RETRIEVAL: bool = True
    VECTOR_RETRIEVAL_TOP_K: int = 200
    VECTOR_RETRIEVAL_MIN_CANDIDATES: int = 20

    # Async parsing pipeline
    ASYNC_PARSE_ENABLED: bool = True

settings = Settings()

# ============================================================================
# Environment auto-detection
# Supabase hosts always contain "supabase.co" in PG_HOST.
# This controls:
#   1. Whether SSL is added to the DSN
#   2. Whether startup skips CREATE DATABASE (Supabase manages the DB)
# ============================================================================
_pg_host = settings.PG_HOST or ""
IS_SUPABASE: bool = "supabase.co" in _pg_host or "supabase.com" in _pg_host

# SQLite is intentionally unsupported for this deployment profile.
if settings.PG_DSN and settings.PG_DSN.startswith("sqlite"):
    raise RuntimeError("SQLite DSN is not supported. Configure PostgreSQL via PG_DSN or PG_* variables.")

# Build DSN from parts if PG_DSN not explicitly set
if not settings.PG_DSN:
    missing_fields = []
    if not settings.PG_HOST:
        missing_fields.append("PG_HOST")
    if not settings.PG_USER:
        missing_fields.append("PG_USER")
    if not settings.PG_DB:
        missing_fields.append("PG_DB")

    if missing_fields:
        missing = ", ".join(missing_fields)
        raise RuntimeError(
            f"Missing PostgreSQL configuration: {missing}. "
            "Set PG_DSN or provide PG_HOST, PG_USER, and PG_DB."
        )

    host = settings.PG_HOST
    port = settings.PG_PORT or 5432
    user = settings.PG_USER
    pwd_raw = settings.PG_PASSWORD or ""
    pwd = quote_plus(pwd_raw)
    dbname = settings.PG_DB

    if IS_SUPABASE:
        # Supabase session pooler requires SSL + gssencmode=disable
        # gssencmode=disable prevents Kerberos negotiation which Supabase pooler rejects
        settings.PG_DSN = (
            f"postgresql+psycopg2://{user}:{pwd}@{host}:{port}/{dbname}"
            f"?sslmode=require&gssencmode=disable"
        )
    else:
        settings.PG_DSN = (
            f"postgresql+psycopg2://{user}:{pwd}@{host}:{port}/{dbname}"
        )
else:
    # If an explicit PG_DSN was provided, still detect Supabase from it
    IS_SUPABASE = "supabase.co" in settings.PG_DSN or "supabase.com" in settings.PG_DSN

