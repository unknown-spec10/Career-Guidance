"""
Learning Path Generator Service — Skill Gap Refactoring
Integrates YouTube Data API v3 and Groq (LLaMA) to discover and rank quality video tutorials
and structure personalized study plans, projects, and practice problems in an interactive roadmap.
"""
# pyright: reportAttributeAccessIssue=false
import datetime
import json
import logging
import math
import re
from typing import List, Dict, Any, Tuple, Optional
import httpx
from fastapi import HTTPException

from ..config import settings
from ..db import Applicant, InterviewSession, InterviewAnswer, InterviewQuestion, LearningPath, SystemConfiguration
from ..constants import CREDIT_CONFIG
from ..core.credit_service import CreditService
from ..core.llm_router import llm_router
from .service import get_weak_skills, get_missing_concepts_summary

logger = logging.getLogger(__name__)

class RobustLearningPathResponse(dict):
    """
    A dictionary subclass that allows attribute-style access
    to support both dict-style and object-style assertions in tests.
    """
    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError:
            raise AttributeError(name)
            
    def __setattr__(self, name, value):
        self[name] = value

# Groq client helper removed in favor of llm_router

def get_fallback_leetcode_problems(weak_skills: List[str], experience_level: str) -> List[Dict[str, Any]]:
    """
    Returns standard, universally valid LeetCode problems as a robust fallback.
    """
    import random
    
    easy_probs = [
        {"title": "Two Sum", "platform": "LeetCode", "difficulty": "Easy", "url": "https://leetcode.com/problems/two-sum/"},
        {"title": "Valid Parentheses", "platform": "LeetCode", "difficulty": "Easy", "url": "https://leetcode.com/problems/valid-parentheses/"},
        {"title": "Merge Two Sorted Lists", "platform": "LeetCode", "difficulty": "Easy", "url": "https://leetcode.com/problems/merge-two-sorted-lists/"},
        {"title": "Best Time to Buy and Sell Stock", "platform": "LeetCode", "difficulty": "Easy", "url": "https://leetcode.com/problems/best-time-to-buy-and-sell-stock/"},
        {"title": "Valid Palindrome", "platform": "LeetCode", "difficulty": "Easy", "url": "https://leetcode.com/problems/valid-palindrome/"}
    ]
    
    medium_probs = [
        {"title": "Add Two Numbers", "platform": "LeetCode", "difficulty": "Medium", "url": "https://leetcode.com/problems/add-two-numbers/"},
        {"title": "Longest Substring Without Repeating Characters", "platform": "LeetCode", "difficulty": "Medium", "url": "https://leetcode.com/problems/longest-substring-without-repeating-characters/"},
        {"title": "3Sum", "platform": "LeetCode", "difficulty": "Medium", "url": "https://leetcode.com/problems/3sum/"},
        {"title": "Container With Most Water", "platform": "LeetCode", "difficulty": "Medium", "url": "https://leetcode.com/problems/container-with-most-water/"},
        {"title": "Group Anagrams", "platform": "LeetCode", "difficulty": "Medium", "url": "https://leetcode.com/problems/group-anagrams/"}
    ]
    
    hard_probs = [
        {"title": "Median of Two Sorted Arrays", "platform": "LeetCode", "difficulty": "Hard", "url": "https://leetcode.com/problems/median-of-two-sorted-arrays/"},
        {"title": "Merge k Sorted Lists", "platform": "LeetCode", "difficulty": "Hard", "url": "https://leetcode.com/problems/merge-k-sorted-lists/"},
        {"title": "Trapping Rain Water", "platform": "LeetCode", "difficulty": "Hard", "url": "https://leetcode.com/problems/trapping-rain-water/"},
        {"title": "Edit Distance", "platform": "LeetCode", "difficulty": "Hard", "url": "https://leetcode.com/problems/edit-distance/"},
        {"title": "Minimum Window Substring", "platform": "LeetCode", "difficulty": "Hard", "url": "https://leetcode.com/problems/minimum-window-substring/"}
    ]
    
    if experience_level == "senior":
        pool = medium_probs + hard_probs
    elif experience_level == "mid-level":
        pool = easy_probs + medium_probs
    else:
        pool = easy_probs
        
    return random.sample(pool, min(len(pool), 3))

def fetch_leetcode_problems_for_skills(weak_skills: List[str], experience_level: str) -> List[Dict[str, Any]]:
    """
    Fetches real LeetCode problems, filters them to match weak skills and experience levels.
    """
    import random
    
    try:
        response = httpx.get("https://leetcode.com/api/problems/algorithms/", timeout=10)
        if response.status_code != 200:
            return get_fallback_leetcode_problems(weak_skills, experience_level)
        data = response.json()
        pairs = data.get("stat_status_pairs", [])
    except Exception as e:
        logger.error("Error fetching LeetCode problems: %s", e)
        return get_fallback_leetcode_problems(weak_skills, experience_level)
        
    # Map experience level to allowed difficulties
    if experience_level == "senior":
        allowed_levels = [2, 3] # Medium, Hard
    elif experience_level == "mid-level":
        allowed_levels = [1, 2] # Easy, Medium
    else:
        allowed_levels = [1] # Easy only for junior/students
        
    matched_problems = []
    
    # We want to select at least 1-2 questions per weak skill
    for skill in weak_skills:
        skill_lower = skill.lower().replace(" ", "-")
        # Find candidates
        candidates = []
        for p in pairs:
            if p.get("paid_only"):
                continue
            level = p.get("difficulty", {}).get("level", 1)
            if level not in allowed_levels:
                continue
            
            stat = p.get("stat", {})
            title = stat.get("question__title", "")
            slug = stat.get("question__title_slug", "")
            
            # Simple keyword match on slug/title
            if skill_lower in slug or any(word in slug for word in skill_lower.split("-")):
                candidates.append(p)
                
        # If no specific matches, fall back to matching any sub-words or general list
        if not candidates:
            # Let's search for partial words
            for p in pairs:
                if p.get("paid_only"):
                    continue
                level = p.get("difficulty", {}).get("level", 1)
                if level not in allowed_levels:
                    continue
                
                stat = p.get("stat", {})
                slug = stat.get("question__title_slug", "")
                if any(word in slug for word in skill_lower.split("-") if len(word) > 2):
                    candidates.append(p)
                    
        # If still no candidates, pick a few random ones from general algorithms
        if not candidates:
            candidates = [p for p in pairs if not p.get("paid_only") and p.get("difficulty", {}).get("level", 1) in allowed_levels]
            
        if candidates:
            # Select up to 2 questions randomly for this skill
            selection = random.sample(candidates, min(len(candidates), 2))
            for p in selection:
                stat = p.get("stat", {})
                level = p.get("difficulty", {}).get("level", 1)
                diff_str = "Easy" if level == 1 else "Medium" if level == 2 else "Hard"
                prob = {
                    "title": stat.get("question__title"),
                    "platform": "LeetCode",
                    "difficulty": diff_str,
                    "url": f"https://leetcode.com/problems/{stat.get('question__title_slug')}/"
                }
                # Avoid duplicates
                if prob not in matched_problems:
                    matched_problems.append(prob)
                    
    # Return up to 5 problems in total. If we have fewer than 3, pad with fallback problems to ensure value
    if len(matched_problems) < 3:
        fallbacks = get_fallback_leetcode_problems(weak_skills, experience_level)
        for fb in fallbacks:
            if fb not in matched_problems:
                matched_problems.append(fb)
                
    return matched_problems[:5]

TRUSTED_CHANNELS = {
    "freeCodeCamp.org",
    "CS50",
    "Fireship",
    "Traversy Media",
    "Corey Schafer",
    "Tech With Tim",
    "MIT OpenCourseWare",
    "Abdul Bari",
    "CodeWithHarry",
    "Jenny's Lectures CS IT",
    "Apna College",
    "Kunal Kushwaha"
}

def parse_iso8601_duration(duration_str: str) -> int:
    """
    Parses an ISO 8601 duration string (e.g., 'PT1H2M10S', 'PT14M33S', 'PT5M') into seconds using a clean regex.
    """
    if not duration_str:
        return 0
    pattern = re.compile(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?')
    match = pattern.match(duration_str)
    if not match:
        return 0
    hours = int(match.group(1)) if match.group(1) else 0
    minutes = int(match.group(2)) if match.group(2) else 0
    seconds = int(match.group(3)) if match.group(3) else 0
    return hours * 3600 + minutes * 60 + seconds

def generate_search_queries(
    weak_skills: List[str],
    missing_concepts: str,
    target_role: str,
    experience_level: str,
    groq_client: Any = None
) -> List[Dict[str, Any]]:
    """
    One Groq call. Prompt instructs: respond ONLY with a JSON array, no markdown, no preamble.
    """
    from .prompts import LEARNING_PATH_QUERY_GENERATION_PROMPT
    
    try:
        prompt = LEARNING_PATH_QUERY_GENERATION_PROMPT.format(
            weak_skills=", ".join(weak_skills),
            target_role=target_role,
            experience_level=experience_level,
            missing_concepts=missing_concepts
        )
        
        res = llm_router.generate_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            provider="groq",
            model_name=settings.GROQ_CHAT_MODEL or "llama-3.3-70b-versatile",
            temperature=0.2,
            max_tokens=800
        )
        raw = res["content"].strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()
        
        queries = json.loads(raw)
        if isinstance(queries, list):
            return queries
        return []
    except Exception as e:
        logger.error("Error generating search queries via Groq: %s", e)
        # Fallback template-based query builder
        fallback = []
        for skill in weak_skills:
            fallback.append({
                "skill": skill,
                "query": f"{skill} full tutorial for beginners 2024",
                "priority": "high"
            })
        return fallback

def search_youtube(query: str, api_key: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    HTTP GET to YouTube Search using httpx.
    """
    if not api_key:
        return []
    
    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "videoDuration": "medium",
        "order": "viewCount",
        "maxResults": max_results,
        "key": api_key
    }
    try:
        with httpx.Client() as client:
            response = client.get(url, params=params, timeout=10.0)
            if response.status_code != 200:
                logger.error("YouTube search error: %s %s", response.status_code, response.text)
                return []
            
            data = response.json()
            videos = []
            for item in data.get("items", []):
                video_id = item.get("id", {}).get("videoId")
                if not video_id:
                    continue
                snippet = item.get("snippet", {})
                videos.append({
                    "video_id": video_id,
                    "title": snippet.get("title"),
                    "channel_title": snippet.get("channelTitle"),
                    "thumbnail_url": snippet.get("thumbnails", {}).get("high", {}).get("url") or snippet.get("thumbnails", {}).get("default", {}).get("url"),
                    "published_at": snippet.get("publishedAt")
                })
            return videos
    except Exception as e:
        logger.error("Error calling YouTube search for query '%s': %s", query, e)
        return []

def fetch_video_stats(video_ids: List[str], api_key: str) -> Dict[str, Dict[str, Any]]:
    """
    One batched HTTP GET to YouTube videos using httpx.
    """
    if not api_key or not video_ids:
        return {}
    
    url = "https://www.googleapis.com/youtube/v3/videos"
    params = {
        "part": "statistics,contentDetails",
        "id": ",".join(video_ids),
        "key": api_key
    }
    try:
        with httpx.Client() as client:
            response = client.get(url, params=params, timeout=10.0)
            if response.status_code != 200:
                logger.error("YouTube videos fetch stats error: %s %s", response.status_code, response.text)
                return {}
            
            data = response.json()
            stats_map = {}
            for item in data.get("items", []):
                v_id = item.get("id")
                stats_map[v_id] = {
                    "view_count": int(item.get("statistics", {}).get("viewCount", 0)),
                    "like_count": int(item.get("statistics", {}).get("likeCount", 0)),
                    "duration_seconds": parse_iso8601_duration(item.get("contentDetails", {}).get("duration", ""))
                }
            return stats_map
    except Exception as e:
        logger.error("Error fetching YouTube video stats: %s", e)
        return {}

def filter_and_rank_videos(
    videos: List[Dict[str, Any]],
    stats: Dict[str, Dict[str, Any]],
    trusted_channels: Optional[set] = None
) -> List[Dict[str, Any]]:
    """
    Pure Python. Merge each video stub with its stats, discard outliers, apply heuristics, and rank.
    """
    if trusted_channels is None:
        trusted_channels = TRUSTED_CHANNELS
        
    ranked = []
    for v in videos:
        v_id = v["video_id"]
        v_stats = stats.get(v_id, {"view_count": 0, "duration_seconds": 0, "like_count": 0})
        
        view_count = v_stats.get("view_count", 0)
        
        # Support both duration_seconds and duration_iso (via parsing duration_iso if duration_seconds is missing)
        duration_seconds = v_stats.get("duration_seconds", 0)
        if not duration_seconds and "duration_iso" in v_stats:
            duration_seconds = parse_iso8601_duration(v_stats["duration_iso"])
            
        channel_title = v.get("channel_title") or v.get("channel") or ""
        
        # Discard criteria
        if view_count < 50000 or duration_seconds < 600 or duration_seconds > 3600:
            # Skip if strict parameters aren't met
            continue
            
        score = math.log10(max(view_count, 1))
        
        # Recency bonus (last 730 days)
        try:
            pub_date = datetime.datetime.fromisoformat(v["published_at"].replace("Z", "+00:00"))
            age_days = (datetime.datetime.now(datetime.timezone.utc) - pub_date).days
            if age_days < 730:
                score += 0.5
        except Exception:
            pass
            
        # Trusted channel bonus
        if channel_title in trusted_channels:
            score += 1.5
            
        v_copy = v.copy()
        v_copy["score"] = score
        v_copy["view_count"] = view_count
        v_copy["duration_minutes"] = int(duration_seconds // 60)
        v_copy["url"] = f"https://www.youtube.com/watch?v={v_id}"
        ranked.append(v_copy)
        
    ranked.sort(key=lambda x: x["score"], reverse=True)
    return ranked

def build_learning_path_json(
    weak_skills: List[str],
    filtered_videos_by_skill: Dict[str, List[Dict[str, Any]]],
    target_role: str,
    experience_level: str,
    missing_concepts: str,
    groq_client: Any = None
) -> Dict[str, Any]:
    """
    One Groq call. Structuring complete path JSON with exact key fields.
    """
    try:
        # Prepare context by taking top 2 candidate videos per skill
        clean_context = {}
        for skill, v_list in filtered_videos_by_skill.items():
            clean_context[skill] = [
                {
                    "video_id": v.get("video_id"),
                    "title": v.get("title"),
                    "channel_title": v.get("channel_title") or v.get("channel") or "",
                    "thumbnail_url": v.get("thumbnail_url") or v.get("thumbnail") or "",
                    "url": v.get("url") or f"https://www.youtube.com/watch?v={v.get('video_id')}",
                    "duration_minutes": v.get("duration_minutes", 0)
                }
                for v in v_list[:2]
            ]
            
        prompt = f"""You are building a personalized learning path for a student.

Student context:
- Target role: {target_role}
- Experience: {experience_level}
- Weak skills: {', '.join(weak_skills)}
- Missing concepts: {missing_concepts}

YouTube videos found:
{json.dumps(clean_context, indent=2)}

Generate a complete learning path JSON with these exact keys:
- skill_gaps: object mapping skill -> "weak" or "moderate"
- priority_skills: top 3 skills to focus on, ordered by priority
- roadmap_stages: array of stages. Include EXACT key names: week, skill_focus, action, why_recommended, what_it_achieves, and optionally video (which MUST use ONLY the video objects provided above in the context! Do NOT invent video IDs or URLs. If no video is available for a skill, omit the video field entirely). In 'why_recommended', explain why this conceptual milestone/video is recommended for their target career/skill gaps. In 'what_it_achieves', explain what concrete capability or skill understanding they will achieve upon completion.
- practice_problems: array of compact practice problems. Include exact keys: title, platform, difficulty, url.
- recommended_projects: array of projects. Include exact keys: title, description, skills_practiced (array).

Respond ONLY with valid JSON. No markdown fences (e.g. no ```json), no explanations.
"""
        res = llm_router.generate_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            provider="groq",
            model_name=settings.GROQ_CHAT_MODEL or "llama-3.3-70b-versatile",
            temperature=0.3,
            max_tokens=1500
        )
        raw = res["content"].strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()
        
        path_data = json.loads(raw)
        return path_data
    except Exception as e:
        logger.error("Error building learning path JSON: %s", e)
        # Muted fallback payload structure
        stages = []
        for i, skill in enumerate(weak_skills):
            stage = {
                "week": f"Week {i+1}",
                "skill_focus": skill,
                "action": f"Master core syntax and paradigms in {skill}.",
                "why_recommended": f"Focusing on {skill} is critical because technical mastery in this domain forms the foundation for professional developer roles.",
                "what_it_achieves": f"You will achieve core architectural understanding and practical implementation confidence in {skill} concepts."
            }
            if skill in filtered_videos_by_skill and filtered_videos_by_skill[skill]:
                v = filtered_videos_by_skill[skill][0]
                stage["video"] = {
                    "video_id": v.get("video_id"),
                    "title": v.get("title"),
                    "channel_title": v.get("channel_title") or v.get("channel") or "",
                    "thumbnail_url": v.get("thumbnail_url") or v.get("thumbnail") or "",
                    "url": v.get("url") or f"https://www.youtube.com/watch?v={v.get('video_id')}",
                    "duration_minutes": v.get("duration_minutes", 0)
                }
            stages.append(stage)
            
        return {
            "skill_gaps": {skill: "weak" for skill in weak_skills},
            "priority_skills": weak_skills[:3],
            "roadmap_stages": stages,
            "practice_problems": [
                {"title": f"Solve easy problems in {weak_skills[0]}", "platform": "LeetCode", "difficulty": "Easy", "url": "https://leetcode.com"}
            ],
            "recommended_projects": [
                {"title": f"{weak_skills[0]} Starter Project", "description": "Apply week concepts in a clean application.", "skills_practiced": [weak_skills[0]]}
            ]
        }

def generate_learning_path(session_id: str, db) -> Dict[str, Any]:
    """
    Orchestration controller for Learning Path Generation pipeline.
    """
    # 1. Load InterviewSession
    session: Optional[InterviewSession] = db.query(InterviewSession).filter_by(id=session_id).first()
    if not session:
        raise ValueError("Interview session not found.")
        
    if session.status != "completed":
        raise ValueError("Interview session is not completed yet.")
        
    applicant = db.query(Applicant).filter_by(id=session.applicant_id).first()
    if not applicant:
        raise ValueError("Applicant profile not found.")
        
    # 2. Check credit eligibility
    credit_service = CreditService(db)
    eligible, msg, ctx = credit_service.check_eligibility(applicant.id, "learning_path_generation")
    if not eligible:
        raise ValueError(msg)
        
    # 3. Session-Specific Idempotency check:
    # Query learning paths, scan for matching session_id in skill_gaps cache metadata
    existing_paths = db.query(LearningPath).filter(
        LearningPath.applicant_id == applicant.id,
        LearningPath.generated_from == "interview"
    ).all()
    for lp in existing_paths:
        if lp.skill_gaps and isinstance(lp.skill_gaps, dict) and lp.skill_gaps.get("session_id") == session_id:
            logger.info("Found cached learning path matching session_id %s, returning directly.", session_id)
            return RobustLearningPathResponse({
                "id": lp.id,
                "path_id": lp.id,
                "already_exists": True,
                "skill_gaps": lp.skill_gaps,
                "recommended_courses": lp.recommended_courses,
                "recommended_projects": lp.recommended_projects,
                "practice_problems": lp.practice_problems,
                "topics_outline": lp.topics_outline,
                "priority_skills": lp.priority_skills,
                "status": lp.status,
                "progress_percentage": lp.progress_percentage,
                "path": {
                    "id": lp.id,
                    "applicant_id": lp.applicant_id,
                    "skill_gaps": lp.skill_gaps,
                    "recommended_courses": lp.recommended_courses,
                    "recommended_projects": lp.recommended_projects,
                    "practice_problems": lp.practice_problems,
                    "topics_outline": lp.topics_outline,
                    "priority_skills": lp.priority_skills,
                    "status": lp.status,
                    "progress_percentage": lp.progress_percentage
                }
            })

    # 4. Enforce 2-generations-per-day daily limit
    limit_cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
    daily_gen_count = db.query(LearningPath).filter(
        LearningPath.applicant_id == applicant.id,
        LearningPath.created_at >= limit_cutoff
    ).count()

    config_limit = db.query(SystemConfiguration).filter_by(key="learning_path_daily_limit").first()
    daily_limit = int(config_limit.value) if config_limit else 2

    if daily_gen_count >= daily_limit:
        raise ValueError(f"Daily limit reached. You can only generate up to {daily_limit} learning paths per day.")

    # Resolve variables & settings
    weak_skills = get_weak_skills(session_id, db)
    if not weak_skills:
        weak_skills = ["Software Engineering Core"]
        
    missing_concepts = get_missing_concepts_summary(session_id, db) or "Syntax and architecture gaps"
    
    target_role = "Software Developer"
    experience_level = "junior"
    
    parsed_record = applicant.parsed_record
    if parsed_record and parsed_record.normalized:
        normalized = parsed_record.normalized
        target_role = normalized.get("target_role") or normalized.get("objective", {}).get("target_role") or "Software Developer"
        exp_years = float(normalized.get("total_experience") or normalized.get("work_experience_years") or 0.0)
        experience_level = "junior" if exp_years < 2.0 else "mid-level" if exp_years < 5.0 else "senior"

    groq_client = None
    youtube_key = settings.YOUTUBE_API_KEY or settings.YOUTUBE_DATA_API_KEY

    filtered_videos_by_skill = {}
    
    if youtube_key:
        try:
            # 5. Core execution steps
            # Phase A: Query Generation
            queries = generate_search_queries(
                weak_skills=weak_skills,
                missing_concepts=missing_concepts,
                target_role=target_role,
                experience_level=experience_level,
                groq_client=groq_client
            )
            
            # Phase B: YouTube Video Search
            all_videos_list = []
            videos_by_skill = {}
            for q_obj in queries:
                skill = q_obj.get("skill")
                query = q_obj.get("query")
                if not skill or not query:
                    continue
                videos = search_youtube(query, youtube_key, max_results=5)
                if videos:
                    # tag skill within video objects
                    for v in videos:
                        v["skill"] = skill
                    videos_by_skill[skill] = videos
                    all_videos_list.extend(videos)
            
            # Phase C: Fetch Stats & Parse ISO-8601 Durations
            v_ids = [v["video_id"] for v in all_videos_list]
            stats_map = fetch_video_stats(v_ids, youtube_key)
            
            # Phase D: Pythonic Quality Score Heuristics Filter
            for skill, v_list in videos_by_skill.items():
                ranked = filter_and_rank_videos(v_list, stats_map)
                if ranked:
                    filtered_videos_by_skill[skill] = ranked
                    
        except Exception as api_err:
            logger.error("Error executing YouTube discovery pipeline: %s. Falling back to LLM structure.", api_err)
            filtered_videos_by_skill = {}
    else:
        logger.warning("YOUTUBE_API_KEY is not configured. Skipping YouTube statistics fetching.")

    # Phase E: Structural path generation via Groq
    # Fetch real LeetCode problems
    real_problems = fetch_leetcode_problems_for_skills(weak_skills, experience_level)

    learning_path_payload = build_learning_path_json(
        weak_skills=weak_skills,
        filtered_videos_by_skill=filtered_videos_by_skill,
        target_role=target_role,
        experience_level=experience_level,
        missing_concepts=missing_concepts,
        groq_client=groq_client
    )

    # Inject real valid LeetCode problems
    if real_problems:
        learning_path_payload["practice_problems"] = real_problems

    # Inject the session ID into the skill gaps JSON as an idempotency cache key
    skill_gaps_cache = learning_path_payload.get("skill_gaps", {})
    if isinstance(skill_gaps_cache, dict):
        skill_gaps_cache["session_id"] = session_id
    learning_path_payload["skill_gaps"] = skill_gaps_cache

    # 6. Persist learning path
    # Extract courses (video objects from roadmap_stages)
    courses = []
    for stage in learning_path_payload.get("roadmap_stages", []):
        if "video" in stage and stage["video"]:
            courses.append(stage["video"])

    new_lp = LearningPath(
        applicant_id=applicant.id,
        generated_from="interview",
        source_session_id=None,
        skill_gaps=learning_path_payload.get("skill_gaps"),
        recommended_courses=courses,
        recommended_projects=learning_path_payload.get("recommended_projects"),
        practice_problems=learning_path_payload.get("practice_problems"),
        topics_outline=learning_path_payload.get("roadmap_stages"),
        priority_skills=learning_path_payload.get("priority_skills"),
        status="active",
        progress_percentage=0.0
    )
    
    db.add(new_lp)
    db.commit()
    db.refresh(new_lp)

    # 7. Deduct credits
    config_cost = db.query(SystemConfiguration).filter_by(key="learning_path_generation_cost").first()
    cost = int(config_cost.value) if config_cost else CREDIT_CONFIG.get('LEARNING_PATH_GENERATION_COST', 10)
    
    credit_service.spend_credits(
        applicant_id=applicant.id,
        activity_type="learning_path_generation",
        cost=cost,
        reference_id=new_lp.id,
        description=f"Learning path from session {session_id[:8]}"
    )
    
    logger.info("Successfully persisted new LearningPath record (id=%d)", new_lp.id)
    return RobustLearningPathResponse({
        "id": new_lp.id,
        "path_id": new_lp.id,
        "already_exists": False,
        "skill_gaps": new_lp.skill_gaps,
        "recommended_courses": new_lp.recommended_courses,
        "recommended_projects": new_lp.recommended_projects,
        "practice_problems": new_lp.practice_problems,
        "topics_outline": new_lp.topics_outline,
        "priority_skills": new_lp.priority_skills,
        "status": new_lp.status,
        "progress_percentage": new_lp.progress_percentage,
        "path": {
            "id": new_lp.id,
            "applicant_id": new_lp.applicant_id,
            "skill_gaps": new_lp.skill_gaps,
            "recommended_courses": new_lp.recommended_courses,
            "recommended_projects": new_lp.recommended_projects,
            "practice_problems": new_lp.practice_problems,
            "topics_outline": new_lp.topics_outline,
            "priority_skills": new_lp.priority_skills,
            "status": new_lp.status,
            "progress_percentage": new_lp.progress_percentage
        }
    })
