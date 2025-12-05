# Mock Interview & Skill Assessment Feature

## Overview
The Interview & Assessment system provides AI-powered mock interviews to help students practice, identify skill gaps, and boost their recommendation scores.

## Features

### 1. Mock Interviews
- **Types**: Technical, HR, Behavioral, Mixed
- **Difficulty Levels**: Easy, Medium, Hard
- **Duration**: 30 minutes per session
- **Question Format**: 
  - Multiple Choice Questions (MCQ)
  - Short Answer Questions
- **Daily Limit**: 2 sessions per day
- **AI Evaluation**: Real-time feedback on each answer using Google Gemini

### 2. Personalized Learning Paths
After completing an interview, students receive:
- **Skill Gap Analysis**: Skills categorized as weak/moderate/strong
- **Recommended Courses**: From Udemy, Coursera, YouTube
- **Practice Problems**: From LeetCode, HackerRank, CodeChef
- **Project Suggestions**: Hands-on projects to build skills

### 3. Recommendation Score Boost
- **Interview Score Bonus** (up to 15 points):
  - Excellent (≥80%): 15 points
  - Good (60-79%): 10 points
  - Average (40-59%): 5 points
  - Below 40%: 0 points
- **Skill Assessment Bonus** (up to 10 points):
  - 2 points per verified skill with ≥70% proficiency
- Scores remain valid for 6 months

### 4. Google Search Integration
- **Coding Problems**: Fetched from LeetCode, HackerRank
- **Interview Questions**: From GeeksForGeeks, InterviewBit
- **Learning Resources**: Courses and tutorials from popular platforms
- **Fallback**: Automatic Gemini generation when Google quota exhausted
- **Caching**: 30-day cache to optimize API usage

## Pages

### InterviewPage (`/dashboard/interview`)
- View interview history and statistics
- Start new interview sessions
- Configure session type, difficulty, and focus skills
- Check daily limit and retake warnings

### InterviewSessionPage (`/dashboard/interview/:sessionId`)
- Live interview interface
- 30-minute countdown timer
- MCQ and short answer questions
- Navigation between questions
- Real-time answer submission

### InterviewResultsPage (`/dashboard/interview/results/:sessionId`)
- Overall score and performance badge
- Skill breakdown chart
- AI feedback (strengths, weaknesses, recommendations)
- Skill gap analysis (red/yellow/green indicators)
- Learning path preview and link

### LearningPathPage (`/dashboard/learning-path/:pathId`)
- Focus areas with priority indicators
- Recommended courses with external links
- Suggested projects with skill tags
- Practice problems with difficulty badges

## Dashboard Integration

### Student Dashboard Enhancements
1. **Interview Button**: Quick access to interview page
2. **Interview Stat Card**: Displays latest score
3. **Interview Widget**:
   - Total sessions count
   - Latest score with color coding
   - Today's session counter (x/2)
   - Retake warning if score >6 months old
   - "Start Mock Interview" button
   - Daily limit notification

## Backend API Endpoints

### Interview Endpoints
- `POST /api/interviews/start` - Create new session
- `GET /api/interviews/{id}/questions` - Get session questions
- `POST /api/interviews/{id}/submit-answer` - Submit and evaluate answer
- `POST /api/interviews/{id}/complete` - Finish session and generate learning path
- `GET /api/interviews/history` - Get session history with metadata
- `GET /api/learning-paths/{id}` - Get personalized learning resources
- `POST /api/assessments/start` - Create skill assessment quiz

### Authentication
All interview endpoints require JWT authentication with `student` role.

## Database Schema

### InterviewSession
- `id`, `applicant_id`, `session_type`, `difficulty_level`
- `status` (in_progress/completed/abandoned)
- `overall_score`, `skill_scores` (JSON)
- `ai_feedback` (JSON: strengths, weaknesses, recommendations)
- `skill_gap_analysis` (JSON: weak, moderate, strong)
- `started_at`, `ends_at`, `completed_at`
- `learning_path_id` (FK)

### InterviewQuestion
- `id`, `session_id`, `question_type`, `skill`
- `question_text`, `options` (JSON for MCQ)
- `test_cases` (JSON for coding)
- `correct_answer`

### InterviewAnswer
- `id`, `question_id`, `answer_text`, `selected_option`
- `score`, `ai_evaluation` (JSON: feedback, strengths, weaknesses)
- `submitted_at`

### SkillAssessment
- `id`, `applicant_id`, `skill_name`, `proficiency_level`
- `score_percentage`, `questions_data` (JSON)
- `completed_at`

### LearningPath
- `id`, `applicant_id`, `skill_gaps` (JSON array)
- `recommended_courses` (JSON: title, provider, URL, priority, focus_skills)
- `recommended_projects` (JSON: title, description, skills)
- `practice_problems` (JSON: title, platform, URL, difficulty, skill)
- `created_at`

## Configuration

### Environment Variables
```env
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_CUSTOM_SEARCH_API_KEY=your_google_search_key
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_search_engine_id
```

### Constants (resume_pipeline/constants.py)
```python
INTERVIEW_CONFIG = {
    "MAX_SESSIONS_PER_DAY": 2,
    "SESSION_DURATION_SECONDS": 1800,  # 30 minutes
    "SCORE_FRESHNESS_MONTHS": 6
}

INTERVIEW_SCORE_MULTIPLIERS = {
    "excellent": 1.0,    # ≥80%
    "good": 0.67,        # 60-79%
    "average": 0.33,     # 40-59%
    "poor": 0.0          # <40%
}

RECOMMENDATION_WEIGHTS = {
    "INTERVIEW_SCORE": 15.0,
    "ASSESSMENT_SCORE": 10.0,
    # ... other weights
}
```

## Usage Flow

### For Students
1. Navigate to `/dashboard/interview` or click "Interviews" button
2. Select interview type and difficulty
3. Optionally specify focus skills
4. Start session (if under daily limit)
5. Answer 7 MCQ + 3 short answer questions within 30 minutes
6. Receive instant AI feedback on each answer
7. Complete session to see overall results
8. Review skill breakdown and AI recommendations
9. Access personalized learning path
10. Recommendation scores auto-update with bonus points

### For Developers
1. Backend: `cd resume_pipeline && uvicorn resume_pipeline.app:app --reload`
2. Frontend: `cd frontend && npm run dev`
3. Access dashboard: `http://localhost:3000/student/dashboard`
4. Interview system: `http://localhost:3000/dashboard/interview`

## Key Technologies
- **Backend**: FastAPI, SQLAlchemy, Google Gemini API, Google Custom Search API
- **Frontend**: React, React Router, Tailwind CSS, Framer Motion, Lucide Icons
- **AI**: Google Gemini 1.5 Flash (JSON mode, temperature 0.1-0.7)
- **Caching**: MD5-based 30-day cache for search results

## Notes
- Interviews are optional; students can skip without affecting base recommendations
- Scores boost both college and job recommendations (50% weight for colleges, 100% for jobs)
- Learning paths are auto-generated based on skill gaps
- Google Search quota management with automatic Gemini fallback
- Session auto-submits when timer expires
- Can navigate between questions but must submit each answer
- 6-month freshness check prompts retake for optimal recommendations
