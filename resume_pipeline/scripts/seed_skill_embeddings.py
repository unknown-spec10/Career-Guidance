"""
seed_skill_embeddings.py
------------------------
RETIRED (offline cutover Oct 2026): the cloud embedding path was removed and
skill embeddings are produced locally by MiniLM at runtime. This script is kept
as a no-op stub so old runbooks fail loudly instead of calling a dead API.

Do NOT use: embeddings are no longer seeded via any API.
"""

import sys
import argparse
import logging
from pathlib import Path

# Ensure package is importable when run as a script
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg2

from resume_pipeline.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("seed_skill_embeddings")


def get_connection() -> psycopg2.extensions.connection:
    return psycopg2.connect(
        host=settings.PG_HOST or "localhost",
        port=settings.PG_PORT or 5432,
        user=settings.PG_USER or "postgres",
        password=settings.PG_PASSWORD or "",
        dbname=settings.PG_DB or "resumes",
    )


def run_seed(batch_size: int = 50, force: bool = False, dry_run: bool = False) -> None:
    conn = get_connection()
    cur = conn.cursor()

    # Fetch skills needing embedding
    if force:
        cur.execute("SELECT id, name FROM canonical_skills ORDER BY id")
    else:
        cur.execute(
            "SELECT id, name FROM canonical_skills WHERE embedding IS NULL ORDER BY id"
        )

    skills = cur.fetchall()
    logger.info(f"Found {len(skills)} skill(s) to embed (force={force})")

    if not skills:
        logger.info("Nothing to do — all skills already have embeddings.")
        cur.close()
        conn.close()
        return

    if dry_run:
        for skill_id, name in skills:
            logger.info(f"  [DRY-RUN] Would embed: id={skill_id}, name={name}")
        cur.close()
        conn.close()
        return

    logger.error(
        "seed_skill_embeddings is retired (offline cutover): "
        "embeddings are produced locally by MiniLM at runtime."
    )
    sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="RETIRED: canonical skill embedding seeder (offline cutover)")
    parser.add_argument("--batch-size", type=int, default=50, help="Skills per API batch call")
    parser.add_argument("--force", action="store_true", help="Re-embed all, even if already set")
    parser.add_argument("--dry-run", action="store_true", help="Print skills without API calls")
    args = parser.parse_args()

    run_seed(batch_size=args.batch_size, force=args.force, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
