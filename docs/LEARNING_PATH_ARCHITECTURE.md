# Learning Path Module — Full Architecture (Ground-Up Rebuild)

**Project:** Career Guidance AI  
**Scope:** Replace Gemini/Google Custom Search with a free, self-contained stack for YouTube resource discovery  
**Status:** Design document — no existing backend routes or generation logic currently in place

---

## 1. What Currently Exists vs. What Is Missing

### What already works

| Component | File | Status |
|---|---|---|
| `LearningPathPage.jsx` | `frontend/src/pages/` | Exists — renders courses, projects, practice items |
| `MyLearningPathsPage.jsx` | `frontend/src/pages/` | Exists — lists all paths for an applicant |
| `learning_paths` DB table | `db.py :: LearningPath` | Exists — schema fully defined |
| `LearningPathResponse` schema | `schemas.py` | Exists — Pydantic model ready |
| Routes registered in `App.jsx` | `/dashboard/learning-path/:pathId` | Exists |
| `stream_study_plan` | `interview/evaluator.py` | Exists — Groq generates a text markdown plan |
| Skill gap calculation | `interview/service.py :: get_weak_skills()` | Exists — returns list of weak skill tags |
| Missing concepts summary | `interview/service.py :: get_missing_concepts_summary()` | Exists — returns string of missing concepts |

### What is completely missing (the gap)

| Component | Needed for |
|---|---|
| Backend route `POST /api/interview/generate-learning-path/{session_id}` | Triggers generation after interview completes |
| Backend route `GET /api/learning-paths/{path_id}` | `LearningPathPage.jsx` already calls this |
| Backend route `GET /api/learning-paths/applicant/{applicant_id}` | `MyLearningPathsPage.jsx` already calls this |
| `learning_path_generator.py` | Core generation logic — Groq + YouTube API |
| YouTube Data API v3 integration | Free video search with quality metadata |
| `YOUTUBE_API_KEY` in `.env.example` | New environment variable |

The frontend is already built and waiting. The backend generation pipeline is what needs to be created from scratch.

---

## 2. The Problem Being Solved

Previously, the system used **Google Custom Search API** (or Gemini's grounding capability) to search the web for YouTube tutorials and courses matching a student's skill gaps. This is now unavailable/too costly.

The replacement approach:

- **Groq (LLaMA)** handles all intelligence — it understands the skill gaps, generates meaningful search queries, and structures the learning path
- **YouTube Data API v3** handles the actual video discovery — it is free (10,000 units/day), returns rich metadata (views, duration, channel), and works without billing enabled
- **Quality filtering** on the metadata replaces the need for Google's ranking intelligence — you apply your own heuristics based on view count, video duration, and channel trust

---

## 3. The Replacement Stack

### Old stack
```
Gemini/Google Custom Search API
  → Returns web results (often YouTube links mixed with other sites)
  → No quality signals
  → Paid / rate-limited aggressively
```

### New stack
```
Groq LLaMA 3 (free tier)
  → Understands context: skill gaps, target role, experience level
  → Generates precise YouTube search queries per skill
  → Structures the full learning path JSON

YouTube Data API v3 (free, 10,000 units/day)
  → Searches YouTube for videos matching each query
  → Returns viewCount, likeCount, duration, channelTitle, thumbnail
  → One search call = ~100 units → ~100 searches/day free

Quality filter (pure Python logic, no API cost)
  → view_count > 50,000 (popularity signal)
  → duration between 600s and 3600s (10 min to 60 min — tutorial length)
  → Whitelist bonus: known channels score higher (freeCodeCamp, CS50, Fireship, etc.)
```

### API cost comparison

| API | Cost | Daily limit |
|---|---|---|
| Google Custom Search API | $5 per 1,000 queries | 100 free/day |
| Gemini grounded search | Billing required (no free tier with billing on) | N/A |
| YouTube Data API v3 | **Free** | **10,000 units = ~100 searches** |
| Groq (LLaMA 3.3-70B) | **Free tier** | 6,000 tokens/min, 131K context |

---

## 4. Full Data Flow

```
[Interview Session Completes]
         │
         ▼
InterviewSession.status = "completed"
InterviewAnswer scores + missing_concepts populated by Groq evaluator
         │
         ▼
[Trigger] POST /api/interview/generate-learning-path/{session_id}
  (called from frontend results page after study plan streams)
         │
         ├─── get_weak_skills(session_id, db)
         │         → ["Python", "DSA", "DBMS"]
         │
         ├─── get_missing_concepts_summary(session_id, db)
         │         → "binary trees, indexing, list comprehensions"
         │
         ├─── LLMParsedRecord.normalized → build_session_context()
         │         → {target_role, experience_years, skills}
         │
         ▼
[Phase 1 — Groq: Query Generation]
  Input:  weak_skills, missing_concepts, target_role, experience_level
  Output: JSON list of search queries, one per skill
    [
      {"skill": "Python", "query": "python for beginners full tutorial 2024", "priority": "high"},
      {"skill": "DSA",    "query": "data structures algorithms python course", "priority": "high"},
      {"skill": "DBMS",   "query": "database management system full course",   "priority": "medium"}
    ]
         │
         ▼
[Phase 2 — YouTube Data API v3: Video Search]
  For each query:
    GET https://www.googleapis.com/youtube/v3/search
      ?part=snippet
      &q={query}
      &type=video
      &videoDuration=medium      ← filters 4–20 min; use "long" for full courses
      &order=viewCount
      &maxResults=5
      &key=YOUTUBE_API_KEY
  
  Returns: video_id, title, channelTitle, publishedAt, thumbnail URL
         │
         ▼
[Phase 3 — YouTube Data API v3: Stats Fetch]
  Batch all video IDs from Phase 2 into one call:
    GET https://www.googleapis.com/youtube/v3/videos
      ?part=statistics,contentDetails
      &id=id1,id2,id3,...
      &key=YOUTUBE_API_KEY
  
  Returns per video: viewCount, likeCount, duration (ISO 8601 format)
         │
         ▼
[Phase 4 — Quality Filter (pure Python)]
  For each video:
    - parse ISO 8601 duration → seconds
    - pass if: views > 50,000 AND 600s ≤ duration ≤ 3600s
    - score += bonus if channel in TRUSTED_CHANNELS whitelist
  
  Sort by score desc, take top 1–2 per skill
         │
         ▼
[Phase 5 — Groq: Full Path Structuring]
  Input:  weak_skills + filtered videos per skill + target_role
  Output: complete LearningPath JSON matching DB schema
    {
      "skill_gaps":           {"Python": "weak", "DSA": "moderate", "DBMS": "weak"},
      "recommended_courses":  [{title, url, channel, thumbnail, views, duration_minutes, focus_skills}],
      "recommended_projects": [{title, description, skills_practiced}],
      "practice_problems":    [{title, platform, url, difficulty}],
      "topics_outline":       [{topic, why_it_matters, subtopics: [{title, details}]}],
      "priority_skills":      ["Python", "DSA", "DBMS"]
    }
         │
         ▼
[Persist to DB]
  INSERT INTO learning_paths (applicant_id, source_session_id, generated_from,
    skill_gaps, recommended_courses, recommended_projects, practice_problems,
    topics_outline, priority_skills, status)
  
  Deduct LEARNING_PATH_GENERATION_COST (2 credits) from CreditAccount
         │
         ▼
[Response to Frontend]
  Returns: {path_id, already_exists: false}
  Frontend navigates to: /dashboard/learning-path/{path_id}
         │
         ▼
[Frontend — LearningPathPage.jsx]
  GET /api/learning-paths/{path_id}
  Renders: circular journey layout with YouTube thumbnails + links
```

---

## 5. New Files to Create

### `resume_pipeline/resume_pipeline/interview/learning_path_generator.py`

This is the core engine. It contains four functions called in sequence:

**`generate_search_queries(weak_skills, missing_concepts, target_role, experience_level) → list[dict]`**  
One Groq call. Returns a list of YouTube search queries, one per weak skill, with priority tags.

**`search_youtube(query, max_results=5) → list[dict]`**  
Calls YouTube Data API v3 `/search` endpoint. Returns raw video stubs (id, title, channel, thumbnail).

**`fetch_video_stats(video_ids: list[str]) → dict`**  
One batched call to YouTube Data API v3 `/videos` endpoint with all IDs. Returns stats and duration per video. Batching is critical — this costs only 1 unit per video, not 1 unit per call.

**`filter_and_rank_videos(videos_with_stats) → list[dict]`**  
Pure Python, no API calls. Applies view threshold (50k), duration range (10–60 min), and channel whitelist bonus. Returns only quality-passing videos, sorted.

**`build_learning_path(weak_skills, filtered_videos, target_role, experience_level, missing_concepts) → dict`**  
One Groq call. Takes the filtered video list as context and outputs the full structured JSON for the `learning_paths` table. Groq fills in projects, practice problems, and topic outlines in this call.

**`generate_learning_path(session_id, db) → LearningPath`**  
Orchestrator. Calls the four functions above in order. Handles caching (checks if a path already exists for this session). Deducts credits. Persists to DB.

---

### New routes in `resume_pipeline/resume_pipeline/interview/router.py`

**`POST /api/interview/generate-learning-path/{session_id}`**  
Protected: `require_role("student")`  
Calls `generate_learning_path(session_id, db)`. Returns `{path_id, already_exists}`.  
This endpoint is idempotent — calling it twice returns the same path without re-generating.

**`GET /api/learning-paths/{path_id}`**  
Protected: `require_role("student")`  
Fetches a single `LearningPath` by ID. Verifies `applicant_id` matches current user. Returns `LearningPathResponse`.

**`GET /api/learning-paths/applicant/{applicant_id}`**  
Protected: `require_role("student")`  
Returns all learning paths for an applicant, ordered by `created_at desc`. Used by `MyLearningPathsPage.jsx`.

---

## 6. YouTube API Unit Cost Breakdown

Understanding units matters because the free quota is 10,000/day.

| Operation | Units per call | Calls per path | Total units |
|---|---|---|---|
| `/search` (per skill) | 100 | 3 skills typical | 300 |
| `/videos` stats (one batch for all results) | 1 per video × N | ~15 videos total | 15 |
| **Total per learning path** | — | — | **~315 units** |
| **Free quota per day** | 10,000 | — | **~31 paths/day** |

For a student platform, 31 paths/day is more than sufficient. If you ever need more, a second free Google API key on a different Gmail account gives another 10,000 units.

---

## 7. Groq Prompt Design

### Prompt 1 — Query generation

```
You are helping a career platform find the best YouTube tutorials for a student.

Student profile:
- Experience level: {experience_level}  (junior / mid-level / senior)
- Target role: {target_role}
- Weak skills from mock interview: {weak_skills}
- Missing concepts: {missing_concepts}

For each weak skill, generate ONE highly specific YouTube search query that would 
find a free full tutorial. Prefer beginner-friendly queries for junior, 
intermediate for mid-level.

Respond ONLY with a JSON array. No preamble, no markdown fences. Example format:
[
  {"skill": "Python", "query": "python for beginners full course 2024", "priority": "high"},
  {"skill": "DSA",    "query": "data structures algorithms python tutorial", "priority": "high"}
]
```

### Prompt 2 — Full path structuring

```
You are building a personalized learning path for a student. 
You have already found quality YouTube videos for their weak skills.

Student context:
- Target role: {target_role}
- Experience: {experience_level}
- Weak skills: {weak_skills}
- Missing concepts: {missing_concepts}

YouTube videos found (already quality-filtered):
{videos_json}

Generate a complete learning path JSON with these exact keys:
- skill_gaps: object mapping skill → "weak" or "moderate"
- recommended_courses: use ONLY the videos provided above (include url, title, 
  channel, thumbnail, duration_minutes, focus_skills)
- recommended_projects: 2-3 hands-on projects to build using the weak skills
- practice_problems: 3-5 coding problems from LeetCode, HackerRank, or CodeChef 
  (include platform name, difficulty, and a direct url if possible)
- topics_outline: structured topic breakdown per weak skill with subtopics
- priority_skills: top 3 skills to focus on first, ordered

Respond ONLY with valid JSON. No markdown, no explanation.
```

The second prompt explicitly passes the already-fetched videos as context — this prevents Groq from hallucinating YouTube links (a common failure mode when you ask an LLM to "suggest YouTube videos" without grounding).

---

## 8. Quality Filter Logic

```python
TRUSTED_CHANNELS = {
    "freeCodeCamp.org",
    "CS50",
    "Fireship",
    "Traversy Media",
    "Corey Schafer",
    "Tech With Tim",
    "MIT OpenCourseWare",
    "Abdul Bari",           # DSA / algorithms
    "CodeWithHarry",
    "Jenny's Lectures CS IT" # DSA / DBMS
}

def quality_score(video: dict) -> float:
    views    = int(video["statistics"].get("viewCount", 0))
    duration = parse_iso8601_duration(video["contentDetails"]["duration"])  # → seconds
    channel  = video["snippet"]["channelTitle"]

    # Hard disqualifiers
    if views < 50_000:
        return 0.0
    if not (600 <= duration <= 3600):
        return 0.0

    # Base score from log-normalized views (prevents mega-viral videos from dominating)
    import math
    score = math.log10(max(views, 1))

    # Recency bonus (videos < 2 years old score slightly higher)
    published = video["snippet"]["publishedAt"]  # ISO 8601
    age_days  = (datetime.utcnow() - datetime.fromisoformat(published[:-1])).days
    if age_days < 730:
        score += 0.5

    # Trusted channel bonus
    if channel in TRUSTED_CHANNELS:
        score += 1.5

    return score
```

---

## 9. Caching and Idempotency

The `generate_learning_path` orchestrator must check before generating:

```python
existing = db.query(LearningPath).filter_by(
    source_session_id=None,  # UUID sessions set this to NULL (see db.py comment)
    applicant_id=applicant.id,
    generated_from="interview"
).order_by(LearningPath.created_at.desc()).first()
```

If a path already exists for this applicant from a recent interview (within 30 days), return it immediately with `already_exists: True` — no API calls, no credit deduction.

This protects against:
- Users double-clicking the "Generate Learning Path" button
- Page refreshes triggering duplicate generation
- YouTube quota being consumed unnecessarily

---

## 10. Credit Integration

The credit system (`CreditAccount`, `CreditTransaction`) is already built. Learning path generation uses `LEARNING_PATH_GENERATION_COST = 2` credits, already defined in `constants.py`.

The flow mirrors what the interview session does:

```python
credit_service = CreditService(db)
eligibility = credit_service.check_eligibility(applicant.id, "learning_path_generation")
if not eligibility["eligible"]:
    raise HTTPException(402, detail=eligibility["reason"])

# ... generate ...

credit_service.deduct(
    applicant_id=applicant.id,
    cost=CREDIT_CONFIG["costs"]["LEARNING_PATH_GENERATION_COST"],
    activity_type="learning_path_generation",
    reference_id=new_path.id,
    description=f"Learning path generated from session {session_id[:8]}"
)
```

---

## 11. Environment Configuration

One new variable added to `.env.example`:

```
# =============================================================================
# YOUTUBE DATA API v3 (for Learning Path resource discovery)
# Free tier: 10,000 units/day — no billing required
# Get your key at: https://console.cloud.google.com
#   → APIs & Services → Enable "YouTube Data API v3"
#   → Credentials → Create API Key
# Restrict the key to "YouTube Data API v3" to prevent misuse
# =============================================================================
YOUTUBE_API_KEY=YOUR_YOUTUBE_DATA_API_KEY
```

This is completely separate from the old `GOOGLE_API_KEY` / `GOOGLE_SEARCH_ENGINE_ID` pair (which was for Google Custom Search). Those can remain in `.env.example` for the skill taxonomy builder that uses them, but are no longer needed for learning path generation.

---

## 12. Frontend Integration Points

### `InterviewResultsPage.jsx` — trigger generation

After the study plan finishes streaming, add a button that calls:
```
POST /api/interview/generate-learning-path/{sessionId}
```
On success, navigate to `/dashboard/learning-path/{path_id}`.

The button should show a loading state while generation runs (it makes 2 Groq calls + YouTube API calls, so ~5–10 seconds).

### `LearningPathPage.jsx` — already built, minor enhancement needed

The page already renders `recommended_courses`, `practice_problems`, `recommended_projects`, and `topics_outline`. The only enhancement needed is displaying YouTube thumbnails and embedding a link to the YouTube video (the `url` field in `recommended_courses` will now be a proper `https://youtube.com/watch?v=...` URL from the API).

The `ExternalLink` icon and link rendering is already in the JSX — it just needs a real URL to link to.

### `MyLearningPathsPage.jsx` — already built

No changes needed. It calls `GET /api/learning-paths/{applicant_id}` which is one of the new routes to be added.

---

## 13. Error Handling and Fallbacks

### If YouTube API quota is exhausted (HTTP 403)

Fall back to Groq generating course recommendations from its own training data — without real video URLs. Mark these entries with `"source": "llm_generated"` instead of `"source": "youtube_api"`. The frontend shows them without thumbnails and with a note that the link may need verification.

### If Groq fails on query generation

Use a simple template-based fallback: for each weak skill, construct a query as `"{skill} full tutorial for beginners"`. Less intelligent but always works.

### If no videos pass the quality filter for a skill

Lower the threshold for that skill only: retry with `views > 10,000` (instead of 50,000). If still nothing passes, skip that skill's video and let Groq fill in a text recommendation for it in the topics_outline instead.

### If the session has no weak skills

Return a pre-built "maintenance path" — a standard set of general resources for the student's target role — without calling YouTube at all.

---

## 14. Module File Structure After Implementation

```
resume_pipeline/resume_pipeline/interview/
├── __init__.py                    (existing — exports router)
├── router.py                      (existing + 3 new routes added)
├── evaluator.py                   (existing — no changes)
├── generator.py                   (existing — no changes)
├── service.py                     (existing — no changes)
├── prompts.py                     (existing — 2 new prompt strings added)
├── schemas.py                     (existing — no changes, LearningPathResponse is in root schemas.py)
├── fallback_questions.py          (existing — no changes)
└── learning_path_generator.py     (NEW — core of this feature)
```

No existing files are deleted or broken. The new file slots in cleanly alongside the existing module.

---

## 15. Summary of Design Decisions

**Why YouTube Data API v3 and not Bing, DuckDuckGo, or scraping?**  
YouTube Data API v3 is purpose-built for this use case — it returns structured video metadata (viewCount, duration, channelTitle) that you can filter programmatically. Scraping YouTube would violate ToS and break constantly. Bing/DDG search results would return links to many platforms mixed together, requiring more parsing to extract YouTube links.

**Why two Groq calls instead of one?**  
Splitting query generation from path structuring keeps each prompt focused and outputs consistent JSON. A single mega-prompt asking Groq to "generate search queries AND build the full path" produces less reliable JSON structure. The first call is also very cheap (small output) — only the second call produces the full path JSON (~1,000 tokens).

**Why log-normalize view counts in the quality score?**  
Without normalization, a video with 10 million views would completely dominate over a 200k-view video from a trusted specialized channel. Log normalization (log10) compresses the range so that a 5x improvement in views gives a smaller score boost, and the channel whitelist bonus becomes more meaningful.

**Why is `source_session_id` set to NULL for UUID sessions?**  
The db.py comment explains this: `source_session_id` is an Integer column for backward compatibility with old integer session IDs. New sessions use UUID strings. So the learning path links to the session by checking `applicant_id` + `generated_from` + `created_at`, not by a foreign key on `source_session_id`.

**Why deduct credits even though YouTube API is free?**  
The credit cost is for the two Groq API calls (which are free-tier but have rate limits), and more importantly, it enforces fair-use — preventing a student from regenerating their learning path 50 times a day and exhausting the system's YouTube API quota for all users.
