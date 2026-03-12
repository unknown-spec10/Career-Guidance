"""One-off migration to add job_id to learning_paths.

- Adds nullable column job_id with FK to jobs(id) ON DELETE SET NULL
- Adds index on job_id
- Idempotent: skips if column already present
"""
from sqlalchemy import create_engine, text
from resume_pipeline.config import settings


def column_exists(conn) -> bool:
    result = conn.execute(
        text(
            """
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'learning_paths'
              AND column_name = 'job_id'
            """
        )
    )
    return bool(result.scalar())


def index_exists(conn, index_name: str) -> bool:
    result = conn.execute(
        text(
            """
            SELECT COUNT(*)
            FROM pg_indexes
            WHERE schemaname = current_schema()
              AND tablename = 'learning_paths'
              AND indexname = :index_name
            """
        ),
        {"index_name": index_name},
    )
    return bool(result.scalar())


def fk_exists(conn, constraint_name: str) -> bool:
    result = conn.execute(
        text(
            """
            SELECT COUNT(*)
            FROM information_schema.table_constraints
            WHERE table_schema = current_schema()
              AND table_name = 'learning_paths'
              AND constraint_type = 'FOREIGN KEY'
              AND constraint_name = :constraint_name
            """
        ),
        {"constraint_name": constraint_name},
    )
    return bool(result.scalar())


def main():
    if not settings.PG_DSN:
        raise RuntimeError("PG_DSN is not set")
    engine = create_engine(settings.PG_DSN)
    print(f"Connecting to DB: {settings.PG_DSN}")

    with engine.begin() as conn:
        if column_exists(conn):
            print("job_id column already exists on learning_paths; nothing to do.")
            return

        print("Adding job_id column to learning_paths ...")
        conn.execute(text("ALTER TABLE learning_paths ADD COLUMN job_id INT NULL"))

        if not index_exists(conn, "idx_learning_paths_job_id"):
            print("Creating index idx_learning_paths_job_id ...")
            conn.execute(text("CREATE INDEX idx_learning_paths_job_id ON learning_paths(job_id)"))
        else:
            print("Index idx_learning_paths_job_id already exists; skipping.")

        fk_name = "fk_learning_paths_job_id"
        if not fk_exists(conn, fk_name):
            print("Creating foreign key fk_learning_paths_job_id ...")
            conn.execute(
                text(
                    "ALTER TABLE learning_paths "
                    "ADD CONSTRAINT fk_learning_paths_job_id "
                    "FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL"
                )
            )
        else:
            print("Foreign key fk_learning_paths_job_id already exists; skipping.")

        print("Migration completed.")


if __name__ == "__main__":
    main()
