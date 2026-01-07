"""
Migration: Regenerate all learning paths with YouTube-only resources
This script updates all learning paths to use the new YouTube-only resource fetching
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from resume_pipeline.config import settings
from resume_pipeline.db import SessionLocal, LearningPath
from resume_pipeline.core.google_search import InterviewContentFetcher

def regenerate_learning_paths():
    """Regenerate learning paths with YouTube-only resources"""
    db = SessionLocal()
    fetcher = InterviewContentFetcher()
    
    try:
        paths = db.query(LearningPath).all()
        print(f"Found {len(paths)} learning paths to regenerate")
        
        for idx, path in enumerate(paths, 1):
            if not path.skill_gaps:
                print(f"  [{idx}/{len(paths)}] Path ID {path.id}: No skill gaps, skipping")
                continue
            
            print(f"\n  [{idx}/{len(paths)}] Regenerating Path ID {path.id}")
            print(f"    Skills: {list(path.skill_gaps.keys())[:5]}...")
            
            # Fetch new YouTube-only resources
            resources = fetcher.fetch_learning_resources(
                skill_gaps=path.skill_gaps,
                count_per_skill=3,
                job_title=None,
                job_description=None
            )
            
            if resources:
                print(f"    ✓ Generated {len(resources)} YouTube resources")
                path.recommended_courses = resources
                db.commit()
            else:
                print(f"    ⚠ No resources generated for this path")
        
        print(f"\n✓ Successfully regenerated {len(paths)} learning paths")
        
    except Exception as e:
        print(f"✗ Error regenerating learning paths: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == '__main__':
    regenerate_learning_paths()
