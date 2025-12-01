"""
Fix display names for applicants by reading from parsed data
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from resume_pipeline.db import SessionLocal, Applicant, LLMParsedRecord

def fix_display_names():
    """Update display_name for all applicants from their parsed data"""
    print(f"\n{'='*60}")
    print("Fixing Applicant Display Names")
    print(f"{'='*60}\n")
    
    db = SessionLocal()
    
    try:
        # Get all applicants with generic names
        applicants = db.query(Applicant).filter(
            Applicant.display_name.like('Applicant app_%')
        ).all()
        
        print(f"Found {len(applicants)} applicants with generic names\n")
        
        fixed = 0
        for applicant in applicants:
            # Get their parsed record
            parsed = db.query(LLMParsedRecord).filter(
                LLMParsedRecord.applicant_id == applicant.id
            ).first()
            
            if not parsed:
                print(f"⚠ No parsed record for {applicant.applicant_id}")
                continue
            
            # Try to get name from 'personal' or 'personal_info'
            normalized = parsed.normalized or {}
            personal = normalized.get('personal') or normalized.get('personal_info', {})
            
            name = personal.get('name')
            location = personal.get('location')
            
            if name:
                old_name = applicant.display_name
                applicant.display_name = name
                
                # Also update location if available
                if location:
                    location_parts = location.split(',')
                    applicant.location_city = location_parts[0].strip() if location_parts else None  # type: ignore
                    applicant.location_state = location_parts[1].strip() if len(location_parts) > 1 else None  # type: ignore
                
                print(f"✓ {applicant.applicant_id[:12]}... : '{old_name}' → '{name}'")
                fixed += 1
            else:
                print(f"⚠ No name found in parsed data for {applicant.applicant_id[:12]}...")
        
        db.commit()
        
        print(f"\n{'='*60}")
        print(f"✓ Fixed {fixed} applicant names")
        print(f"{'='*60}\n")
        
        return fixed
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    fix_display_names()
