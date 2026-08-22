"""
Seed the canonical_skills table and runtime credit configuration.

Idempotent: safe to run repeatedly. Upserts every skill from
resume_pipeline/resume_pipeline/resume/skill_taxonomy.json (+ metadata) into
canonical_skills, and creates SystemConfiguration defaults that are read at
runtime but were previously never writable/seeded:

    - learning_path_generation_cost  (default from constants.CREDIT_CONFIG)
    - dynamic_subtopic_taxonomy      (empty object placeholder)

Usage (from resume_pipeline/, venv active):
    python scripts/seed_canonical_skills.py

NOTE: embeddings for canonical skills are NOT generated here — run
scripts/seed_skill_embeddings.py afterwards (requires pgvector migration +
this script to have run first).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from resume_pipeline.db import SessionLocal, CanonicalSkill, SystemConfiguration
from resume_pipeline.constants import CREDIT_CONFIG

TAXONOMY_PATH = Path(__file__).resolve().parents[1] / "resume_pipeline" / "resume" / "skill_taxonomy.json"
METADATA_PATH = Path(__file__).resolve().parents[1] / "resume_pipeline" / "resume" / "skill_taxonomy_metadata.json"


def seed_canonical_skills(db):
    taxonomy = json.loads(TAXONOMY_PATH.read_text(encoding="utf-8"))
    try:
        metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        metadata = {}

    created, updated = 0, 0
    for name_lower, _skill_id in taxonomy.items():
        meta = metadata.get(name_lower, {})
        display_name = (meta.get("display_name") or name_lower).strip()

        existing = db.query(CanonicalSkill).filter(CanonicalSkill.name == display_name).first()
        if not existing:
            # Also match case-insensitively to avoid duplicate lowercase variants
            existing = (
                db.query(CanonicalSkill)
                .filter(func_lower(CanonicalSkill.name) == display_name.lower())
                .first()
            )

        if existing:
            existing.aliases = sorted(set((existing.aliases or []) + [name_lower]))
            if meta.get("category"):
                existing.category = meta["category"]
            if meta.get("relevance_score") is not None:
                existing.market_score = float(meta["relevance_score"])
            if meta.get("market_demand"):
                existing.demand_level = meta["market_demand"]
            updated += 1
        else:
            db.add(CanonicalSkill(
                name=display_name,
                aliases=[name_lower],
                category=meta.get("category"),
                market_score=float(meta["relevance_score"]) if meta.get("relevance_score") is not None else None,
                demand_level=meta.get("market_demand"),
            ))
            created += 1

    db.commit()
    return created, updated


def func_lower(col):
    from sqlalchemy import func
    return func.lower(col)


def seed_system_configuration(db):
    """Create runtime-overridable config keys that code reads but nothing wrote."""
    seeded = []

    lp_cost = CREDIT_CONFIG.get('LEARNING_PATH_GENERATION_COST', 10)
    if not db.query(SystemConfiguration).filter_by(key="learning_path_generation_cost").first():
        db.add(SystemConfiguration(key="learning_path_generation_cost", value=lp_cost))
        seeded.append(f"learning_path_generation_cost={lp_cost}")

    if not db.query(SystemConfiguration).filter_by(key="dynamic_subtopic_taxonomy").first():
        db.add(SystemConfiguration(key="dynamic_subtopic_taxonomy", value={}))
        seeded.append("dynamic_subtopic_taxonomy={}")

    db.commit()
    return seeded


def main():
    db = SessionLocal()
    try:
        created, updated = seed_canonical_skills(db)
        print(f"canonical_skills: {created} created, {updated} updated")
        seeded = seed_system_configuration(db)
        for s in seeded:
            print(f"system_configurations: seeded {s}")
        if not seeded:
            print("system_configurations: already up to date")
    finally:
        db.close()


if __name__ == "__main__":
    main()
