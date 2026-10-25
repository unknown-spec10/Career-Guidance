"""
Google Search API integration for fetching interview questions, coding problems, and learning resources.
Includes fallback to chat-provider generation (via llm_router) when quota is exhausted.
"""
import hashlib
import json
from typing import List, Dict, Optional

import requests

from ..config import settings
from ..core.llm_router import llm_router


class InterviewContentFetcher:
    """
    Fetch interview-related content from Google Search API with chat-provider fallback.
    """

    def __init__(self):
        self.api_key = settings.GOOGLE_API_KEY
        self.search_engine_id = settings.GOOGLE_SEARCH_ENGINE_ID
        self.base_url = "https://www.googleapis.com/customsearch/v1"
        self.cache = {}  # Simple in-memory cache
        self.quota_exhausted = False
    
    def _cache_key(self, query: str) -> str:
        """Generate cache key from query"""
        return hashlib.md5(query.encode()).hexdigest()
    
    def _check_cache(self, query: str) -> Optional[List[Dict]]:
        """Check if query results are cached"""
        key = self._cache_key(query)
        return self.cache.get(key)
    
    def _update_cache(self, query: str, results: List[Dict]):
        """Update cache with results"""
        key = self._cache_key(query)
        self.cache[key] = results
    
    def _google_search(self, query: str, num_results: int = 5) -> List[Dict]:
        """
        Perform Google Custom Search API query.
        Returns list of result dicts with title, link, snippet.
        """
        # Check cache first
        cached = self._check_cache(query)
        if cached:
            return cached
        
        # Check if quota is exhausted
        if self.quota_exhausted:
            return []
        
        params = {
            "key": self.api_key,
            "cx": self.search_engine_id,
            "q": query,
            "num": min(num_results, 10)  # Max 10 per request
        }
        
        try:
            response = requests.get(self.base_url, params=params, timeout=10)
            
            if response.status_code == 429:  # Rate limit exceeded
                print("Google Search API quota exhausted - switching to chat-provider fallback")
                self.quota_exhausted = True
                return []
            
            if response.status_code != 200:
                print(f"Google Search API error: {response.status_code}")
                return []
            
            data = response.json()
            results = []
            
            for item in data.get('items', []):
                results.append({
                    "title": item.get('title', ''),
                    "url": item.get('link', ''),
                    "snippet": item.get('snippet', ''),
                    "source": self._extract_domain(item.get('link', ''))
                })
            
            # Update cache
            self._update_cache(query, results)
            
            return results
        
        except Exception as e:
            print(f"Error in Google Search: {e}")
            return []
    
    def _extract_domain(self, url: str) -> str:
        """Extract domain name from URL"""
        try:
            from urllib.parse import urlparse
            domain = urlparse(url).netloc
            return domain.replace('www.', '')
        except:
            return 'unknown'
    def fetch_learning_resources(
        self, 
        skill_gaps: Dict[str, str],
        count_per_skill: int = 3,
        job_title: str | None = None,
        job_description: str | None = None
    ) -> List[Dict]:
        """
        Fetch learning resources (YouTube videos and playlists) for weak skills.
        
        Args:
            skill_gaps: Dict of {skill_name: "weak|moderate|strong"}
            count_per_skill: Number of resources per weak skill
        
        Returns:
            List of dicts with title, url, provider (YouTube), focus, and type (video|playlist)
        """
        all_resources = []
        
        # Focus on weak skills only
        weak_skills = [skill for skill, level in skill_gaps.items() if level == "weak"]
        if not weak_skills:
            weak_skills = list(skill_gaps.keys())[:3]
            
        role_context = ""
        if job_title:
            role_context += f" for the role '{job_title}'"
        if job_description:
            role_context += f". Job description: {job_description[:400]}"
        
        # Try Google Search first if API is configured
        if self.api_key and self.search_engine_id and not self.quota_exhausted:
            for skill in weak_skills[:3]:  # Top 3 weak skills
                # Search specifically for YouTube videos and playlists
                query = (
                    f"{skill} tutorial playlist {job_title or ''} 2024 "
                    "site:youtube.com"
                )
                
                results = self._google_search(query, num_results=count_per_skill)
                
                for result in results:
                    # Determine if it's a playlist or video
                    res_type = "playlist" if "playlist" in result['url'].lower() else "video"
                    all_resources.append({
                        "title": result['title'],
                        "url": result['url'],
                        "provider": "YouTube",
                        "focus": skill,
                        "type": res_type,
                        "context": role_context.strip()
                    })
        
        # If no Google results or API not configured, use chat-provider fallback
        if not all_resources:
            print(f"Generating YouTube learning resources via chat provider (weak skills: {weak_skills})")
            prompt = f"""Generate SPECIFIC, ACTIONABLE YouTube tutorial recommendations for learning these skills: {', '.join(weak_skills[:5])}{role_context}.

For EACH skill, provide 2-3 high-quality YouTube learning resources with:
- EXACT video/playlist titles as they appear on YouTube
- REAL YouTube channel names (freeCodeCamp, Traversy Media, The Net Ninja, Academind, Programming with Mosh, Code with Harry, etc.)
- Direct YouTube URLs (watch?v= for individual videos, playlist?list= for playlists)
- Each resource should teach ONE specific topic within the skill

Return ONLY valid JSON array (no extra text):
[
  {{
    "title": "[Channel Name] - Specific Topic Tutorial Name",
    "provider": "YouTube",
    "focus": "skill_name",
    "type": "video",
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }},
  {{
    "title": "[Channel Name] - Complete [Skill] Course/Playlist",
    "provider": "YouTube",
    "focus": "skill_name",
    "type": "playlist",
    "url": "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"
  }}
]

CRITICAL REQUIREMENTS:
1. Generate REAL, SPECIFIC tutorial titles - not generic channel names
2. Include famous tutorial creators with their most popular courses
3. For each skill: 1 complete course/playlist + 1-2 focused tutorials
4. Example good titles:
   - "freeCodeCamp - Python Tutorial for Beginners"
   - "The Net Ninja - JavaScript Fundamentals (Full Course)"
   - "Traversy Media - SQL Tutorial for Complete Beginners"
   - "Code with Harry - Complete Data Structures & Algorithms"
5. URLs must be real YouTube links (watch?v= or playlist?list= format)
6. Return ONLY the JSON array, no markdown or other text"""

            try:
                res = llm_router.generate_chat_completion(
                    messages=[{"role": "user", "content": prompt}],
                    provider=None,
                    capability="chat",
                    temperature=0.3,
                    max_tokens=2048,
                    response_format={"type": "json_object"},
                    timeout=30,
                )
                try:
                    resources = json.loads(res["content"])
                    if isinstance(resources, list):
                        all_resources = resources
                        print(f"[SUCCESS] Generated {len(all_resources)} YouTube resources via chat provider")
                    else:
                        print(f"Warning: chat provider returned non-list: {type(resources)}")
                except json.JSONDecodeError as je:
                    print(f"Error parsing chat-provider JSON response: {je}")
            except Exception as e:
                print(f"Error generating learning resources via chat provider: {e}")
        
        if all_resources:
            print(f"[SUCCESS] Fetched {len(all_resources)} learning resources")
        else:
            print("[WARNING] No learning resources could be fetched - returning empty list")
        
        return all_resources
