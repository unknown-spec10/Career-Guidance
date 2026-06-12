"""Quick check to verify learning_paths schema has job_id column."""
from sqlalchemy import create_engine, text
from resume_pipeline.config import settings

if not settings.PG_DSN:
    raise RuntimeError("PG_DSN is not set")

engine = create_engine(settings.PG_DSN)
with engine.connect() as conn:
    result = conn.execute(text("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'learning_paths'
        ORDER BY ordinal_position
    """))
    print('\nlearning_paths schema:')
    print(f"{'Column':<30} {'Type':<25} {'Nullable':<10} {'Default'}")
    print('-' * 80)
    for row in result:
        print(f"{row[0]:<30} {row[1]:<25} {row[2]:<10} {row[3] or ''}")
