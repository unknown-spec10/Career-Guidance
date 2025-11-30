import sys, pathlib
p = pathlib.Path(__file__).resolve().parents[1]
if str(p) not in sys.path:
    sys.path.insert(0, str(p))
from resume_pipeline.db import init_db, engine

if __name__ == "__main__":
    # Mask password in DSN output if not already masked
    url_str = str(engine.url)
    safe_url = url_str
    if '@' in url_str and '://' in url_str:
        try:
            prefix, rest = url_str.split('://', 1)
            auth, host = rest.split('@', 1)
            if ':' in auth:
                user, _pwd = auth.split(':', 1)
                safe_url = f"{prefix}://{user}:***@{host}"
        except Exception:
            pass
    print(f"Using DSN: {safe_url}")
    init_db()
    print("DB tables created (if not existing).")
