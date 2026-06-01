import sys
import pathlib

# Ensure parent directory is in python path
p = pathlib.Path(__file__).resolve().parents[1]
if str(p) not in sys.path:
    sys.path.insert(0, str(p))

from resume_pipeline.db import SessionLocal, Applicant, InterviewSession
from resume_pipeline.interview.candidate_intelligence import generate_longitudinal_profile

def backfill():
    db = SessionLocal()
    try:
        # Query completed sessions to get unique applicant IDs
        completed_sessions = (
            db.query(InterviewSession)
            .filter(InterviewSession.status == "completed")
            .all()
        )
        applicant_ids = list(set([s.applicant_id for s in completed_sessions if s.applicant_id]))
        
        if not applicant_ids:
            print("No applicants with completed mock interview sessions found.")
            return
            
        applicants_with_sessions = (
            db.query(Applicant)
            .filter(Applicant.id.in_(applicant_ids))
            .all()
        )
        
        print(f"Found {len(applicants_with_sessions)} applicant(s) with completed interview sessions.")
        
        for app in applicants_with_sessions:
            print(f"Generating Longitudinal Profile for Applicant ID {app.id} ({app.display_name or 'Candidate'})...")
            profile = generate_longitudinal_profile(app.id, db)
            if profile:
                print(f"Successfully generated profile for Applicant ID {app.id} (Sessions: {profile.get('sessions_count', 1)})")
            else:
                print(f"Failed to generate profile for Applicant ID {app.id}")
                
        print("Backfill process finished!")
    except Exception as e:
        print(f"Backfill failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    backfill()
