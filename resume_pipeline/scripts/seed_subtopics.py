import sys
import pathlib
import json

# Ensure parent directory is in python path
p = pathlib.Path(__file__).resolve().parents[1]
if str(p) not in sys.path:
    sys.path.insert(0, str(p))

from resume_pipeline.db import SessionLocal, SystemConfiguration
from resume_pipeline.interview.subtopic_taxonomy_builder import SubtopicTaxonomyBuilder

def seed():
    db = SessionLocal()
    # Clean up any previously stored corrupted configurations in the DB
    try:
        from resume_pipeline.db import SystemConfiguration
        db.query(SystemConfiguration).filter_by(key="dynamic_subtopic_taxonomy").delete()
        db.commit()
        print("Cleared dynamic_subtopic_taxonomy database config to avoid merging stale Unicode entries.")
    except Exception as e:
        db.rollback()
        print(f"Database cleanup info: {e}")

    builder = SubtopicTaxonomyBuilder(db)
    skills = [
        "javascript", "typescript", "docker", "aws", "django", "nodejs",
        "kubernetes", "git", "redis", "mongodb", "postgresql", "html", "css", "testing"
    ]
    print(f"Seeding subtopics for {len(skills)} skills...")
    
    # Pre-populate taxonomy from local json if it exists
    for s in skills:
        print(f"Processing '{s}'...")
        subtopics = builder.get_subtopics(s)
        print(f"  -> Found {len(subtopics)} sub-topics")

    # Sync everything from the loaded memory taxonomy to the local subtopic_taxonomy.json file
    try:
        local_path = builder.local_json_path
        with open(local_path, "w", encoding="utf-8") as f:
            json.dump(builder._taxonomy, f, indent=2)
        print(f"Synced local JSON file: {local_path}")
    except Exception as e:
        print(f"Failed to write local JSON file: {e}")

    # Sync everything to the DB dynamic_subtopic_taxonomy config
    try:
        config_record = db.query(SystemConfiguration).filter_by(key="dynamic_subtopic_taxonomy").first()
        if not config_record:
            config_record = SystemConfiguration(
                key="dynamic_subtopic_taxonomy",
                value=builder._taxonomy,
                category="interview"
            )
            db.add(config_record)
        else:
            config_record.value = builder._taxonomy
        db.commit()
        print("Synced database dynamic_subtopic_taxonomy configuration table.")
    except Exception as e:
        db.rollback()
        print(f"Failed to sync database: {e}")
        
    db.close()
    print("Done!")

if __name__ == "__main__":
    seed()
