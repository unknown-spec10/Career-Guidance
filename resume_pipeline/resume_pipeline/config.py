from pydantic_settings import BaseSettings
from dotenv import load_dotenv
from pathlib import Path
from urllib.parse import quote_plus

# Load .env from workspace root if present
load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env")

class Settings(BaseSettings):
    # Prefer separate fields; fallback to MYSQL_DSN if fully provided
    MYSQL_HOST: str | None = None
    MYSQL_PORT: int | None = None
    MYSQL_USER: str | None = None
    MYSQL_PASSWORD: str | None = None
    MYSQL_DB: str | None = None
    MYSQL_DSN: str | None = None
    FILE_STORAGE_PATH: str = "./data/raw_files"
    GEMINI_API_KEY: str = ""
    GEMINI_API_URL: str = "https://api.gemini.example/v1"
    GEMINI_SMALL_MODEL: str = "gemini-small-multimodal"
    GEMINI_LARGE_MODEL: str = "gemini-large-multimodal"
    GEMINI_MOCK_MODE: bool = False
    EMBEDDING_MODEL: str = "gen-embedding-mini"
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
    
    # Google Search API for skill taxonomy builder
    GOOGLE_API_KEY: str | None = None
    GOOGLE_SEARCH_ENGINE_ID: str | None = None
    
    # Gmail SMTP for email verification
    GMAIL_USER: str | None = None
    GMAIL_APP_PASSWORD: str | None = None
    FRONTEND_URL: str = "http://localhost:5173"

    # Email verification mode: "link" or "code"
    EMAIL_VERIFICATION_MODE: str = "code"
    VERIFICATION_CODE_LENGTH: int = 6
    VERIFICATION_CODE_TTL_MINUTES: int = 30

settings = Settings()

# Build DSN from parts if MYSQL_DSN not explicitly set
if not settings.MYSQL_DSN:
    host = settings.MYSQL_HOST or "localhost"
    port = settings.MYSQL_PORT or 3306
    user = settings.MYSQL_USER or "root"
    pwd_raw = settings.MYSQL_PASSWORD or ""
    pwd = quote_plus(pwd_raw)
    dbname = settings.MYSQL_DB or "resumes"
    settings.MYSQL_DSN = f"mysql+pymysql://{user}:{pwd}@{host}:{port}/{dbname}"
