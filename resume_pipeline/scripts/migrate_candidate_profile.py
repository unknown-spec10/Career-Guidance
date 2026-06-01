import sys
import pathlib

# Ensure parent directory is in python path
p = pathlib.Path(__file__).resolve().parents[1]
if str(p) not in sys.path:
    sys.path.insert(0, str(p))

from sqlalchemy import create_engine, text
from resume_pipeline.config import settings

def run_migration():
    if not settings.PG_DSN:
        print("Error: PG_DSN is not configured.")
        return
        
    print(f"Connecting to database to apply schema migration...")
    engine = create_engine(settings.PG_DSN)
    
    with engine.connect() as conn:
        print("Adding column 'candidate_profile' to 'applicants' table (if not exists)...")
        conn.execute(text("""
            ALTER TABLE applicants 
            ADD COLUMN IF NOT EXISTS candidate_profile JSON;
        """))
        conn.commit()
        print("Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
