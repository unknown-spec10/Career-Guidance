import sys
import pathlib

p = pathlib.Path(__file__).resolve().parents[1]
if str(p) not in sys.path:
    sys.path.insert(0, str(p))

from resume_pipeline.resume.skill_taxonomy_builder import SkillTaxonomyBuilder

def test_google_search():
    """Test Google Custom Search API credentials."""
    print("=" * 60)
    print("Testing Google Search API Credentials")
    print("=" * 60)
    
    builder = SkillTaxonomyBuilder()
    
    if not builder.api_key:
        print("\n✗ GOOGLE_API_KEY not found in .env")
        return False
    
    if not builder.search_engine_id:
        print("\n✗ GOOGLE_SEARCH_ENGINE_ID not found in .env")
        return False
    
    print(f"\n✓ API Key: {builder.api_key[:20]}...")
    print(f"✓ Search Engine ID: {builder.search_engine_id}")
    
    # Test with a single skill
    test_skill = "Python"
    print(f"\nTesting search for: '{test_skill}'")
    print("-" * 60)
    
    result = builder.search_skill_relevance(test_skill)
    
    if result.get("relevance_score", 0) > 0:
        print(f"\n✓ Search successful!")
        print(f"  Relevance Score: {result['relevance_score']}")
        print(f"  Category: {result['category']}")
        print(f"  Market Demand: {builder._score_to_demand(result['relevance_score'])}")
        print(f"  Total Results: {result.get('total_results', 0):,}")
        
        if result.get('related'):
            print(f"  Related Skills: {', '.join(result['related'][:3])}")
        
        return True
    else:
        print(f"\n✗ Search failed or returned no results")
        print(f"  Response: {result}")
        return False

if __name__ == "__main__":
    success = test_google_search()
    
    if success:
        print("\n" + "=" * 60)
        print("✓ Google Search API is working correctly!")
        print("=" * 60)
        
        # Test with a few more skills
        print("\nTesting with multiple skills...")
        builder = SkillTaxonomyBuilder()
        
        test_skills = ["JavaScript", "React", "Machine Learning"]
        for skill in test_skills:
            result = builder.search_skill_relevance(skill)
            demand = builder._score_to_demand(result['relevance_score'])
            print(f"  {skill}: Score={result['relevance_score']}, Demand={demand}, Category={result['category']}")
        
        sys.exit(0)
    else:
        print("\n" + "=" * 60)
        print("✗ Google Search API test failed")
        print("=" * 60)
        print("\nTroubleshooting:")
        print("1. Verify GOOGLE_API_KEY in .env")
        print("2. Verify GOOGLE_SEARCH_ENGINE_ID in .env")
        print("3. Check API quota at: https://console.cloud.google.com/")
        print("4. Ensure Custom Search API is enabled")
        sys.exit(1)
