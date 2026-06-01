"""
seed_skill_embeddings.py
------------------------
One-time script to generate and store gemini-embedding-2-preview embeddings
for all canonical skills in the `canonical_skills` table.

Must be run AFTER migrate_pgvector.py has added the `embedding vector(768)` column.

Usage (from repo root with venv active):
    python scripts/seed_skill_embeddings.py

Options:
    --batch-size N   Number of skills to embed per API call (default: 50)
    --force          Re-embed all skills even if embedding already exists
    --dry-run        Print skill names without calling API
"""

import sys
import argparse
import logging
import time
from pathlib import Path
from typing import List, Optional, Tuple

# Ensure package is importable when run as a script
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg2
from psycopg2.extras import execute_batch

from resume_pipeline.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("seed_skill_embeddings")

# Prompt prefix matching what the normalizer uses at parse time
SKILL_EMBED_PREFIX = "Represent this skill name for semantic similarity matching: "

VECTOR_DIMENSION = 768


def get_connection() -> psycopg2.extensions.connection:
    return psycopg2.connect(
        host=settings.PG_HOST or "localhost",
        port=settings.PG_PORT or 5432,
        user=settings.PG_USER or "postgres",
        password=settings.PG_PASSWORD or "",
        dbname=settings.PG_DB or "resumes",
    )


def get_gemini_embeddings(
    texts: List[str], api_key: str, model: str = "gemini-embedding-2-preview"
) -> List[Optional[List[float]]]:
    """
    Call Gemini embedding API for a batch of texts.
    Returns a list of float vectors (or None on failure for that item).
    """
    import requests

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:batchEmbedContents?key={api_key}"
    )

    # Build batch request with prompt prefix for semantic similarity task
    requests_payload = [
        {
            "model": f"models/{model}",
            "content": {
                "parts": [{"text": SKILL_EMBED_PREFIX + text}]
            },
        }
        for text in texts
    ]

    body = {"requests": requests_payload}

    try:
        resp = requests.post(url, json=body, timeout=60)
        if resp.status_code != 200:
            logger.error(f"Gemini API error {resp.status_code}: {resp.text[:300]}")
            return [None] * len(texts)

        data = resp.json()
        embeddings_raw = data.get("embeddings", [])
        results = []
        for emb in embeddings_raw:
            vals = emb.get("values")
            if vals and len(vals) == VECTOR_DIMENSION:
                results.append(vals)
            else:
                results.append(None)
        # Pad if API returned fewer than expected
        while len(results) < len(texts):
            results.append(None)
        return results

    except Exception as e:
        logger.error(f"Exception calling Gemini embedding API: {e}")
        return [None] * len(texts)


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

    api_key = settings.GEMINI_API_KEY
    if not api_key:
        logger.error("GEMINI_API_KEY not set. Cannot call embedding API.")
        sys.exit(1)

    total_done = 0
    total_failed = 0

    # Process in batches
    for i in range(0, len(skills), batch_size):
        batch = skills[i : i + batch_size]
        ids = [row[0] for row in batch]
        names = [row[1] for row in batch]

        logger.info(
            f"Embedding batch {i // batch_size + 1} "
            f"({i + 1}–{min(i + batch_size, len(skills))} of {len(skills)})..."
        )

        vectors = get_gemini_embeddings(names, api_key)

        # Upsert vectors
        for skill_id, name, vector in zip(ids, names, vectors):
            if vector is None:
                logger.warning(f"  Failed to embed: id={skill_id}, name={name}")
                total_failed += 1
                continue

            # Format vector as pgvector literal '[x,y,z,...]'
            vec_literal = "[" + ",".join(str(v) for v in vector) + "]"
            cur.execute(
                "UPDATE canonical_skills SET embedding = %s::vector WHERE id = %s",
                (vec_literal, skill_id),
            )
            total_done += 1

        conn.commit()

        # Rate limiting — be polite to the API
        if i + batch_size < len(skills):
            time.sleep(0.5)

    cur.close()
    conn.close()

    logger.info("")
    logger.info("=" * 60)
    logger.info(f"Seeding complete: {total_done} embedded, {total_failed} failed")
    logger.info("=" * 60)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed canonical skill embeddings via Gemini API")
    parser.add_argument("--batch-size", type=int, default=50, help="Skills per API batch call")
    parser.add_argument("--force", action="store_true", help="Re-embed all, even if already set")
    parser.add_argument("--dry-run", action="store_true", help="Print skills without API calls")
    args = parser.parse_args()

    run_seed(batch_size=args.batch_size, force=args.force, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
