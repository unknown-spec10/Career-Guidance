from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv
from pathlib import Path
from urllib.parse import quote_plus
import os

# In production (Render), OS env vars are already set — do NOT let .env override them.
# In local dev, .env is not present in the container so this only runs locally.
_env_file = Path(__file__).resolve().parents[2] / ".env"
if not os.environ.get("RENDER"):
    # Local development should always pick fresh values from .env instead of stale
    # process/user environment variables that may linger across sessions.
    load_dotenv(dotenv_path=_env_file, override=True)


def _get_repo_root() -> Path:
    """Get the repository root directory (project root)."""
    return Path(__file__).resolve().parents[2]


def _resolve_storage_path(path: str) -> str:
    """Resolve storage path relative to repo root if relative; absolute paths pass through unchanged."""
    p = Path(path)
    if p.is_absolute():
        return str(p)
    return str((_get_repo_root() / p).resolve())

class Settings(BaseSettings):
    # Pydantic-settings: only read from OS environment, never from .env files.
    # This ensures Render's injected env vars always win over any baked-in .env.
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    @field_validator(
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "OPENCODE_API_KEY",
        "GROQ_API_KEY",
        "GOOGLE_API_KEY",
        "GOOGLE_SEARCH_API_KEY",
        "SECRET_KEY",
        "ADMIN_PASSWORD",
        "GMAIL_APP_PASSWORD",
        "YOUTUBE_DATA_API_KEY",
        "PG_PASSWORD",
        mode="before",
        check_fields=False,  # the demo fork does not define every credential
    )
    @classmethod
    def _strip_credential_whitespace(cls, value):
        """Trim paste artefacts from credentials.

        Secrets created from a Windows clipboard routinely carry a trailing
        CR/LF, and Google then rejects the OAuth token exchange with
        "invalid_client: The provided client secret is invalid." — a message
        that points at the key rather than at the stray character.
        """
        return value.strip() if isinstance(value, str) else value

    # Prefer separate fields; fallback to PG_DSN if fully provided
    PG_HOST: str | None = None
    PG_PORT: int | None = None
    PG_USER: str | None = None
    PG_PASSWORD: str | None = None
    PG_DB: str | None = None
    # PostgreSQL DSN (optional if PG_* fields are provided)
    PG_DSN: str | None = None
    # Support for standard DATABASE_URL (Render/Supabase style)
    DATABASE_URL: str | None = None
    FILE_STORAGE_PATH: str = "./data/raw_files"
    
    # Storage Integration (local, gcs)
    STORAGE_BACKEND: str = "local"  # "local" or "gcs"
    
    # GCP Storage Integration
    GCS_BUCKET_NAME: str = "mine-career-guidance-bucket"
    GCS_PROJECT_ID: str | None = None

    # Capability-based model selection (model-agnostic)
    # Callers ask for a capability ("chat", "explanation", "stt"); the provider
    # adapter registry in core/llm_router.py resolves these slots to concrete
    # providers/models. Swapping models requires only env changes, no code edits.
    # An empty *_NAME means "use the provider default" (GROQ_STT_MODEL,
    # OPENCODE_CHAT_MODEL below), so
    # existing deployments behave exactly as before until the slots are set.
    # Cutover defaults (Oct 2026): ALL chat/explanation workloads route to
    # opencode (DeepSeek). There is NO fallback: each capability resolves to a
    # single provider and a failure raises (callers own their recovery:
    # interview question bank, evaluator error path, learning-path template,
    # RAG error return, offline explanation).
    # STT stays on Groq Whisper (MODEL_STT_* untouched).
    # ============================================================================
    MODEL_CHAT_PRIMARY_PROVIDER: str = "opencode"
    MODEL_CHAT_PRIMARY_NAME: str = "deepseek-v4.1-flash"
    # Explanation order defaults to opencode too (was gemini -> groq).
    MODEL_EXPLAIN_PRIMARY_PROVIDER: str = "opencode"
    MODEL_EXPLAIN_PRIMARY_NAME: str = "deepseek-v4.1-flash"
    MODEL_STT_PROVIDER: str = "groq"
    MODEL_STT_NAME: str = ""

    # Hard ceiling on outbound LLM calls per process per day (0 = unlimited).
    # Exceeding it raises LLMCallBudgetExceeded instead of silently spending:
    # a runaway loop or a long dev session can no longer drain the account.
    LLM_MAX_CALLS_PER_DAY: int = 0

    # ============================================================================
    # OPENCODE PROVIDER (OpenAI-compatible, e.g. OpenCode Zen)
    # Registered in core/llm_router.py as the `opencode` adapter. Selectable via
    # the MODEL_* slots above with zero code changes, e.g.
    # MODEL_CHAT_PRIMARY_PROVIDER=opencode.
    # ============================================================================
    OPENCODE_API_BASE_URL: str = "https://opencode.ai/zen/v1"
    OPENCODE_API_KEY: str = ""
    OPENCODE_CHAT_MODEL: str = "deepseek-v4.1-flash"
    # The OpenCode Go gateway models are reasoning models: with long prompts
    # they can spend the whole max_tokens budget on reasoning_content and
    # return empty content (the adapter rejects that empty response). When
    # true, the adapter sends "reasoning_effort": "none" so the gateway skips
    # reasoning entirely. Defaults to False, which leaves the request body
    # byte-identical to the historical payload.
    OPENCODE_DISABLE_REASONING: bool = False

    # Removed (Oct 2026 cutover): GEMINI_* keys, legacy Groq chat-model keys,
    # GROQ_TTS_*, NVIDIA_NIM_*, OPENROUTER_*, GOOGLE_EMBEDDING_ENABLED,
    # EMBEDDING_TIMEOUT_SECONDS (dead Google embedding path + unused providers).
    GROQ_STT_MODEL: str = "whisper-large-v3"
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
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

    # Admin seeding from environment (plaintext in env, hashed at seeding, never logged)
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""

    # Runtime environment: "development" | "production".
    # In production a strong SECRET_KEY (>= 32 chars) is REQUIRED at startup.
    APP_ENV: str = "development"
    
    # Skill taxonomy JSON file paths
    # Default: written alongside skill_taxonomy_builder.py inside the resume sub-package
    SKILL_TAXONOMY_PATH: str = str(
        Path(__file__).resolve().parent / "resume" / "skill_taxonomy.json"
    )
    SKILL_TAXONOMY_METADATA_PATH: str = str(
        Path(__file__).resolve().parent / "resume" / "skill_taxonomy_metadata.json"
    )

    # ============================================================================
    # SKILL NORMALIZATION THRESHOLDS (two-pass redesign)
    # Configurable via .env so they can be tuned without code changes.
    # ============================================================================
    # Pass 1: rapidfuzz WRatio threshold (0-100 scale)
    SKILL_FUZZY_THRESHOLD: float = 82.0
    # Pass 2: pgvector cosine similarity threshold (0.0-1.0 scale)
    SKILL_SEMANTIC_THRESHOLD: float = 0.80
    
    # ============================================================================
    # SEMANTIC SKILL MATCHING CONFIGURATION
    # Uses embeddings + taxonomy for intelligent skill normalization & matching
    # ============================================================================
    SEMANTIC_MATCHING_ENABLED: bool = True              # Feature toggle
    EMBEDDING_CACHE_MAX_ITEMS: int = 2000               # In-memory embedding cache cap
    SEMANTIC_SIMILARITY_THRESHOLD: float = 0.70         # Min confidence for canonical match
    
    # Google Search API for skill taxonomy builder
    GOOGLE_API_KEY: str | None = None
    GOOGLE_SEARCH_ENGINE_ID: str | None = None
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    BACKEND_URL: str = "http://localhost:8000"
    
    # Gmail SMTP for email verification
    GMAIL_USER: str | None = None
    GMAIL_APP_PASSWORD: str | None = None
    FRONTEND_URL: str = "http://localhost:5173"
    
    # Groq API for RAG Q&A system
    GROQ_API_KEY: str | None = None

    # YouTube Data API v3 (for Learning Path resource discovery) — single key.
    YOUTUBE_DATA_API_KEY: str = ""
    
    # CORS Origins - configurable for cloud deployments
    # In development: localhost:3000 and localhost:5173
    # In production: add your frontend domain, Cloud Run domain, etc.
    # Format: comma-separated list
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # Email verification codes (blank = code defaults: 6 digits / 30 minutes).
    VERIFICATION_CODE_LENGTH: int = 6
    VERIFICATION_CODE_TTL_MINUTES: int = 30
    # Password-reset codes are higher-risk (6 digits, account takeover): shorter
    # validity than email-verification codes.
    PASSWORD_RESET_CODE_TTL_MINUTES: int = 10

    # ============================================================================
    # RECOMMENDATIONS
    # Former live-weight dicts (SEMANTIC_MATCHING_CONFIG,
    # JOB_RECOMMENDATION_WEIGHTS, legacy RECOMMENDATION_WEIGHTS) had zero code
    # readers — live scoring in recommendation/aggregator.py uses inline
    # literals — and were deleted in the constants.py merge. Only
    # MAX_RECOMMENDATIONS is read from the environment.
    # ============================================================================
    MAX_RECOMMENDATIONS: int = 10           # Maximum recommendations to return
    
    # RAG System Configuration
    RAG_PRELOAD_ON_STARTUP: bool = False    # Pre-initialize RAG on startup (vs lazy init on first query)

    VECTOR_RETRIEVAL_TOP_K: int = 200
    VECTOR_RETRIEVAL_MIN_CANDIDATES: int = 20

    # Async parsing pipeline
    ASYNC_PARSE_ENABLED: bool = True

# ── AI Input Limits ───────────────────────────────────────────────
AI_INPUT_CONFIG = {
    # Max characters sent to any LLM for resume structuring
    # ~3000 chars ≈ 750 tokens ≈ roughly 1.5 pages — enough for all key info
    "resume_max_chars": 3000,

    # Max characters for job matching / recommendation prompts
    # Job descriptions are shorter, 1500 chars is plenty
    "recommendation_max_chars": 1500,

    # Max characters for interview evaluation
    "interview_answer_max_chars": 1000,

    # If resume exceeds limit, take first N chars (top of resume)
    # and last N chars (summary/skills usually at bottom too)
    "resume_truncation_strategy": "top_and_tail",  # or "top_only"
}

# ============================================================================
# NON-ENV APPLICATION CONSTANTS (moved from constants.py — single source of
# truth lives here now; constants.py is deleted, import from this module).
# These are tuned code sets, NOT environment-driven: they are intentionally
# plain module constants rather than Settings fields, so .env/compose
# changes cannot silently alter scoring, state machines, or credit costs.
# Env-tunable thresholds live on Settings above
# (LLM_CONFIDENCE_THRESHOLD, CGPA_MISMATCH_THRESHOLD == 0.2,
# MAX_UNKNOWN_SKILLS, MAX_SUMMARY_SENTENCES, LONG_DOC_WORD_THRESHOLD).
# Deleted as dead/duplicate (zero code readers, verified by grep):
#   LLM_CONFIDENCE_THRESHOLD / MAX_UNKNOWN_SKILLS module copies (Settings wins),
#   CGPA_MISMATCH_THRESHOLD == 0.5 copy (Settings 0.2 wins; neither had a
#   Python reader — Settings wins via .env.example + compose wiring),
#   SEMANTIC_MATCHING_CONFIG / JOB_RECOMMENDATION_WEIGHTS /
#   RECOMMENDATION_WEIGHTS (zero readers; live scoring in
#   recommendation/aggregator.py uses inline literals).
# ============================================================================

# ── Parse pipeline: confidence weights (redesign v2.0) ──────────────────────
# Weighted average of per-section heuristic scores.
# Weights reflect importance to downstream recommendation quality.
CONFIDENCE_WEIGHTS = {
    'contact':   0.10,
    'education': 0.35,   # Highest: CGPA feeds recommendation scoring directly
    'experience': 0.25,
    'skills':    0.20,
    'projects':  0.05,
    'extras':    0.05,
}

# ── Parse status: state machine outcomes ────────────────────────────────────
PARSE_STATUS_PROCESSING    = 'processing'     # Background task running
PARSE_STATUS_ACCEPTED      = 'accepted'       # AUTO_ACCEPT ≥ 0.85
PARSE_STATUS_PENDING_REVIEW = 'pending_review' # NEEDS_REVIEW 0.60–0.84
PARSE_STATUS_FAILED        = 'failed'         # RE_PARSE exhausted

PARSE_AUTO_ACCEPT_THRESHOLD = 0.85
PARSE_REVIEW_THRESHOLD      = 0.60
SECTION_RETRY_THRESHOLD     = 0.70   # Retry individual section if below this

# ── File type router: detection heuristics ──────────────────────────────────
ROUTER_THRESHOLDS = {
    'min_chars_per_page': 200,      # Below this → Type C (scanned)
    'whitespace_ratio_limit': 0.40,  # Above this → Type B (designed/columnar)
}

# ── Validation / pagination ─────────────────────────────────────────────────
MAX_RESUME_TEXT_WORDS = 2000  # Maximum words before summarization

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 100

# ── Interview & assessment configuration ────────────────────────────────────
INTERVIEW_CONFIG = {
    'SESSION_DURATION_SECONDS': 1800,  # 30 minutes for full interview
    'MICRO_SESSION_DURATION_SECONDS': 300,  # 5 minutes for micro-session
    'SCORE_FRESHNESS_MONTHS': 6,  # Prompt retake after 6 months
    'MCQ_COUNT_RANGE': (10, 10),  # 10 MCQ questions per session
    'SHORT_ANSWER_COUNT_RANGE': (0, 0),  # 0 short answer questions (focus on MCQ)
    'MIN_PASSING_SCORE': 40.0,  # Minimum score to pass
    'DIFFICULTY_ADJUSTMENT_THRESHOLD': 70.0,  # Increase difficulty if score > 70
    'MAX_SESSIONS_PER_DAY': 10,  # Max any interview sessions per day
}

LIVE_INTERVIEW_CONFIG = {
    'SESSION_DURATION_SECONDS': 1800,  # 30 minutes
    'HEARTBEAT_SECONDS': 20,
    'START_ACTIVITY_TYPE': 'full_interview',  # Reuse existing credit policy
}

# Interview System v2 — configuration (provider-agnostic; models come from
# MODEL_CHAT_* slots resolved by core/llm_router.py)
INTERVIEW_CONFIG_V2 = {
    'RESERVE_POOL_SIZE': 3,           # Extra questions generated for adaptive difficulty
    'ADAPTIVE_CHECK_EVERY': 3,        # Check running score every N answered questions
    'ADAPTIVE_HIGH_THRESHOLD': 80,    # Swap in harder (reserve) question if score >= this %
    'ADAPTIVE_LOW_THRESHOLD': 40,     # Show hint if answer score below this % (0.0-100 scale)
    'WEAK_SKILL_THRESHOLD': 0.60,     # Skills with avg score below this go into study plan
    'POLLING_MAX_WAIT_SECONDS': 30,   # Frontend max polling window
    'SESSION_ACTIVE_HOURS': 24,       # Hours before an active session is considered stale
    # --- Scalability guards (audit 4.1-4.2; no behavior change under normal load) ---
    'MAX_CONCURRENT_EVALS': 8,        # Cap on concurrent background run_evaluation tasks
    'EVAL_BACKOFF_BASE_SECONDS': 1.0,  # Base for exp backoff+jitter on Groq 429/timeout
    'EVAL_BACKOFF_MAX_SECONDS': 8.0,  # Cap for a single backoff sleep (inside 3-retry budget)
    'SSE_STREAM_TIMEOUT_SECONDS': 120,  # Max lifetime of one hint/feedback/skill-gap stream
    'SSE_HEARTBEAT_INTERVAL_SECONDS': 15,  # Idle interval after which a `: ping` comment is sent
    'YOUTUBE_CACHE_TTL_DAYS': 7,      # TTL for cached search_youtube results
}

# Rate limiting & cost safeguards for mock interview system
INTERVIEW_LIMITS = {
    'SESSION_START_WINDOW_SECONDS': 300,  # 5 minutes
    'SESSION_START_MAX_DAILY': 3,         # 3 sessions per day
    'ANSWER_SUBMIT_WINDOW_SECONDS': 10,   # 10 seconds
    'ANSWER_SUBMIT_MAX_DAILY': 30,        # 30 answer evaluations per day
}

# ── Credit-based quota system ───────────────────────────────────────────────
CREDIT_CONFIG = {
    # Credit costs
    'FULL_MOCK_INTERVIEW_COST': 10,  # 1 full interview = 10 credits
    'LIVE_INTERVIEW_COST': 10,  # 1 live interview = 10 credits
    'MICRO_SESSION_COST': 1,  # 1 micro-session (1 question) = 1 credit
    'CODING_QUESTION_COST': 1,  # 1 coding question = 1 credit
    'PROJECT_IDEA_COST': 2,  # 1 project idea generation = 2 credits
    'LEARNING_PATH_GENERATION_COST': 10,  # 1 learning path generation = 10 credits
    'RECOMMENDATION_REFRESH_COST': 5,  # Refreshing recommendations within cooldown = 5 credits
    'RECOMMENDATION_REFRESH_COOLDOWN_HOURS': 24,  # Cooldown between free refreshes

    # Credit limits (free tier)
    'DEFAULT_WEEKLY_CREDITS': 60,  # 60 credits per week (4 full + 20 micro)
    'MAX_DAILY_CREDITS_USAGE': 20,  # Daily cap of 20 credits protects the 2 GB VM from burst LLM load; <= 0 disables the cap.
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

# ── Interview question types / categories / difficulty ──────────────────────
QUESTION_TYPES = ['mcq', 'short_answer', 'coding', 'theory', 'behavioral']

INTERVIEW_CATEGORIES = [
    'DSA', 'Python', 'Java', 'JavaScript', 'C++',
    'DBMS', 'SQL', 'OS', 'OOP', 'System Design',
    'Machine Learning', 'Data Structures', 'Algorithms',
    'Networking', 'Cloud Computing', 'DevOps'
]

DIFFICULTY_LEVELS = ['easy', 'medium', 'hard']

# Proficiency mapping (based on assessment scores)
PROFICIENCY_MAPPING = {
    (0, 40): 'beginner',
    (40, 60): 'intermediate',
    (60, 80): 'advanced',
    (80, 100): 'expert'
}

# Interview score multipliers for recommendations
INTERVIEW_SCORE_MULTIPLIERS = {
    'excellent': 1.0,  # >= 80: Full 15 points
    'good': 0.67,  # 60-79: 10 points
    'average': 0.33,  # 40-59: 5 points
    'poor': 0.0,  # < 40: 0 points
}

# ── File upload limits ──────────────────────────────────────────────────────
MAX_FILE_SIZE_MB = 10
ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.doc', '.txt'}
ALLOWED_MIME_TYPES = {
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
}

# ── Database ────────────────────────────────────────────────────────────────
DEFAULT_BATCH_SIZE = 100

# ── API response messages ───────────────────────────────────────────────────
API_MESSAGES = {
    'APPLICANT_NOT_FOUND': 'Applicant not found',
    'NO_PARSED_DATA': 'No parsed resume data found. Please parse resume first.',
    'INVALID_FILE_TYPE': 'Invalid file type. Supported: PDF, DOCX, DOC, TXT',
    'JOB_NOT_FOUND': 'Job not found',
    'UPLOAD_SUCCESS': 'File uploaded successfully',
    'PARSE_SUCCESS': 'Resume parsed successfully',
}

settings = Settings()

# Resolve FILE_STORAGE_PATH relative to repo root if relative
try:
    settings.FILE_STORAGE_PATH = _resolve_storage_path(settings.FILE_STORAGE_PATH)
except Exception:
    pass

# Naming fallbacks for backward compatibility with older/alternative env names
if not settings.GOOGLE_API_KEY and os.environ.get("GOOGLE_SEARCH_API_KEY"):
    settings.GOOGLE_API_KEY = os.environ.get("GOOGLE_SEARCH_API_KEY")

if not settings.GOOGLE_SEARCH_ENGINE_ID and os.environ.get("GOOGLE_CSE_ID"):
    settings.GOOGLE_SEARCH_ENGINE_ID = os.environ.get("GOOGLE_CSE_ID")

# If DATABASE_URL is set, prioritize it to populate PG_DSN
if settings.DATABASE_URL:
    settings.PG_DSN = settings.DATABASE_URL

# Normalize postgres:// or postgresql:// to postgresql+psycopg2:// in PG_DSN
if settings.PG_DSN:
    if settings.PG_DSN.startswith("postgres://"):
        settings.PG_DSN = settings.PG_DSN.replace("postgres://", "postgresql+psycopg2://", 1)
    elif settings.PG_DSN.startswith("postgresql://"):
        settings.PG_DSN = settings.PG_DSN.replace("postgresql://", "postgresql+psycopg2://", 1)

# ============================================================================
# Environment auto-detection
# Supabase hosts always contain "supabase.co" in PG_HOST or PG_DSN.
# This controls:
#   1. Whether SSL is added to the DSN
#   2. Whether startup skips CREATE DATABASE (Supabase manages the DB)
# ============================================================================
_pg_host = settings.PG_HOST or ""
_pg_dsn = settings.PG_DSN or ""
IS_SUPABASE: bool = (
    "supabase.co" in _pg_host or 
    "supabase.com" in _pg_host or 
    "supabase.co" in _pg_dsn or 
    "supabase.com" in _pg_dsn
)

# ============================================================================
# CI_SKIP_DB_VALIDATION: when set to 'true', skip all DB connection checks.
# This allows unit tests to import the package without a live PostgreSQL instance.
# NEVER set this in production — the app will fail to start with no DB.
# ============================================================================
_skip_db_validation: bool = os.environ.get("CI_SKIP_DB_VALIDATION", "").lower() in ("1", "true", "yes")

# SQLite is intentionally unsupported for this deployment profile.
if not _skip_db_validation:
    if settings.PG_DSN and settings.PG_DSN.startswith("sqlite"):
        raise RuntimeError("SQLite DSN is not supported. Configure PostgreSQL via PG_DSN or PG_* variables.")

# Build DSN from parts if PG_DSN not explicitly set
if not _skip_db_validation and not settings.PG_DSN:
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
elif not _skip_db_validation and settings.PG_DSN:
    # If an explicit PG_DSN was provided, still detect Supabase from it
    IS_SUPABASE = "supabase.co" in settings.PG_DSN or "supabase.com" in settings.PG_DSN

