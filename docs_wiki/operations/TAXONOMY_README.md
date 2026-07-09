"""
Skill Taxonomy Builder - Dynamic Market-Driven Skill Classification

This module uses Google Custom Search API to:
1. Extract skills from resumes automatically
2. Search Google for each skill to gauge market relevance
3. Categorize skills based on search results
4. Build a taxonomy ranked by market demand

Setup:
1. Get Google Custom Search API key: https://developers.google.com/custom-search/v1/overview
2. Create a Custom Search Engine: https://programmablesearchengine.google.com/
3. Add credentials to .env:
   GOOGLE_API_KEY=your_api_key
   GOOGLE_SEARCH_ENGINE_ID=your_engine_id

Usage:
```bash
# Build taxonomy from all sample resumes
python -m resume_pipeline.scripts.build_skill_taxonomy

# Or import and use programmatically
from resume_pipeline.resume.skill_taxonomy_builder import SkillTaxonomyBuilder

builder = SkillTaxonomyBuilder()
taxonomy = builder.build_taxonomy_for_skills(["Python", "React", "AWS"])
builder.save_taxonomy(taxonomy, "custom_taxonomy.json")
```

Output:
- skill_taxonomy.json: Simple skill->ID mapping for the parser
- skill_taxonomy_metadata.json: Full taxonomy with scores, categories, related skills

Categories:
- programming, data_science, web_development, mobile, cloud, database, 
  framework, tools, soft_skills, other

Market Demand Levels (based on search volume):
- very_high (80-100), high (60-80), medium (40-60), low (20-40), very_low (0-20)
"""
