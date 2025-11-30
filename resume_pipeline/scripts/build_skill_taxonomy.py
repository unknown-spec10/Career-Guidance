import sys
import pathlib
from pathlib import Path

p = pathlib.Path(__file__).resolve().parents[1]
if str(p) not in sys.path:
    sys.path.insert(0, str(p))

from resume_pipeline.resume.skill_taxonomy_builder import SkillTaxonomyBuilder

def main():
    """Build skill taxonomy from extracted skills using Google Search."""
    
    builder = SkillTaxonomyBuilder()
    
    # Example: Extract skills from sample resume
    test_dir = Path(__file__).parent
    sample_resume = test_dir / "sample_resume_1.txt"
    
    if sample_resume.exists():
        with open(sample_resume, 'r') as f:
            resume_text = f.read()
        
        print("Building taxonomy from sample resume...")
        taxonomy_path = test_dir.parent / "skill_taxonomy.json"
        
        taxonomy = builder.update_taxonomy_from_resume(
            resume_text,
            existing_taxonomy_path=str(taxonomy_path) if taxonomy_path.exists() else ""
        )
        
        builder.save_taxonomy(
            {k: {"skill_id": v, "relevance_score": 0} for k, v in taxonomy.items()},
            str(taxonomy_path)
        )
    else:
        # Manual skill list for testing
        skills = [
            "Python", "Java", "JavaScript", "React", "Node.js",
            "Machine Learning", "Deep Learning", "SQL", "Docker",
            "AWS", "Git", "Data Analysis", "C++", "MongoDB"
        ]
        
        print(f"Building taxonomy for {len(skills)} skills...")
        taxonomy = builder.build_taxonomy_for_skills(skills)
        
        output_path = test_dir.parent / "skill_taxonomy.json"
        builder.save_taxonomy(taxonomy, str(output_path))
        
        # Print summary
        print("\n=== Taxonomy Summary ===")
        for skill, info in list(taxonomy.items())[:10]:
            print(f"{info['skill_id']}: {info['display_name']} - {info['market_demand']} demand ({info['relevance_score']})")

if __name__ == "__main__":
    main()
