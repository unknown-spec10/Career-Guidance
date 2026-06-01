# Career Guidance — Interview System Architecture
### Complete Technical Design Document
**Project:** unknown-spec10/Career-Guidance  
**Stack:** FastAPI + React 18 + PostgreSQL + Groq API  
**Last Updated:** May 2026

---

## Table of Contents

1. [The Big Picture](#1-the-big-picture)
2. [Why We Made Each Major Decision](#2-why-we-made-each-major-decision)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Phase 1 — Session Setup](#4-phase-1--session-setup)
5. [Phase 2 — The Interview Loop](#5-phase-2--the-interview-loop)
6. [Phase 3 — Results & Study Plan](#6-phase-3--results--study-plan)
7. [Conversation Memory](#7-conversation-memory)
8. [Background Evaluation](#8-background-evaluation)
9. [Streaming](#9-streaming)
10. [Voice Layer (Optional Upgrade)](#10-voice-layer-optional-upgrade)
11. [Database Design](#11-database-design)
12. [API Contracts](#12-api-contracts)
13. [Groq Prompt Templates](#13-groq-prompt-templates)
14. [Frontend Page Design](#14-frontend-page-design)
15. [Error Handling & Edge Cases](#15-error-handling--edge-cases)
16. [File Structure](#16-file-structure)
17. [Build Order](#17-build-order)

---

## 1. The Big Picture

The interview system is a **resume-aware, adaptive, AI-powered mock interview engine** built entirely on free-tier infrastructure. The candidate's resume — already parsed and stored in the database — is the source of truth for everything: what topics to cover, what skills to probe, and how to evaluate answers.

The flow at the highest level:

```
Candidate configures session
        ↓
Backend reads parsed resume from DB
        ↓
Groq generates all questions upfront (one API call)
        ↓
Interview loop: candidate answers → next question shown instantly
                evaluation runs in background
        ↓
Results page: skill breakdown + personalized study plan
```

There is no WebSocket. No LangGraph. No Redis. No Celery. Just plain HTTP REST, FastAPI BackgroundTasks, and Groq — all of which you already have.

---

## 2. Why We Made Each Major Decision

### Why REST, not WebSockets?

WebSockets maintain a persistent, always-open connection between browser and server. They make sense for truly real-time, two-way, continuous streams — like live chat or multiplayer games.

Your interview is turn-based:
- AI asks question
- Candidate answers
- AI evaluates
- Next question

That is not a continuous stream. It is a sequence of request/response pairs. REST handles this perfectly, is simpler to build, easier to debug, and has no connection management overhead. WebSockets would add complexity for zero benefit.

### Why not LangGraph?

LangGraph is a graph-based orchestration framework where you define nodes (processing steps) and edges (transitions between them). It manages state across those steps and is powerful for non-linear AI agent flows — where an AI might decide to call a tool, loop back, branch based on output, etc.

Your interview flow is linear:
```
Q1 → A1 → Q2 → A2 → Q3 → A3 → ... → Results
```

There is no branching. No autonomous agent decisions. No tool calls mid-flow. LangGraph would introduce a new framework dependency and learning curve for a problem that does not need it. Conversation memory in your case is just a list of messages passed to Groq — that is a data problem, not a framework problem.

Use LangGraph only if you later build something like an autonomous AI that decides mid-session whether to probe deeper, fetch external resources, or hand off to a different agent. That is a v3 feature.

### Why not Redis for session memory?

Redis is a fast in-memory key-value store, excellent for caching data that is read many times by many users simultaneously.

Your interview session data is:
- Read by exactly one user
- In sequential, one-at-a-time turns
- A small payload (a 10-question session is ~5KB of text)

PostgreSQL reads 5KB in ~5-15ms. The Groq API call takes 800-2000ms. Adding Redis would save ~8ms on a 1500ms operation — less than 1% improvement. The user cannot feel it. Redis adds operational complexity for zero perceptible gain in this context.

Redis would make sense later if you add a global leaderboard or a stats dashboard that thousands of users hit simultaneously. That is a cache-worthy problem. Per-session interview state is not.

### Why Groq (LLaMA 3)?

- Already in your `.env.example` — zero new setup
- Free tier is generous enough for question generation and evaluation
- LLaMA 3 is strong enough for interview Q&A tasks
- Groq's inference is fast (they use custom hardware called LPUs)
- Supports streaming natively
- Supports multi-turn conversation history natively

Gemini is kept only for resume parsing where it already works well. Enabling Gemini billing removes free tier access entirely, so all new features route to Groq.

### Why pre-generate all questions upfront?

The naive approach calls Groq twice per question: once to generate the next question, once to evaluate the previous answer. For a 10-question interview that is 20 Groq API calls.

The smarter approach calls Groq once at session start to generate all questions, then once per answer for evaluation. That is 11 Groq calls total — nearly half.

Pre-generation also means showing the next question is instant — it just reads from the database. No API latency mid-interview.

The tradeoff: questions are generated before we know how the candidate will answer, so they cannot adapt to earlier answers. This is acceptable for v1. Adaptive questioning (where Q5 reacts to how Q4 was answered) can be layered in later using the conversation memory system.

### Why FastAPI BackgroundTasks, not Celery?

Celery is a distributed task queue — it runs tasks in separate worker processes, survives server restarts, and can scale to millions of jobs. It requires Redis or RabbitMQ as a message broker.

FastAPI BackgroundTasks runs tasks in the same process, after the HTTP response is sent. It is simpler, requires nothing extra, and is sufficient when:
- Tasks are short-lived (1-3 seconds)
- You have a small number of concurrent users
- You do not need tasks to survive a server crash

Evaluation tasks take 1-2 seconds and are per-session. BackgroundTasks is exactly right here. Celery would be the correct choice when you have hundreds of concurrent users all submitting answers simultaneously. That is a scale problem you do not have yet.

---

## 3. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18)                   │
│                                                             │
│  SetupPage → InterviewPage → ResultsPage                    │
│  Web Speech API (mic) + Web SpeechSynthesis (speaker)       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP REST (Axios)
┌────────────────────────▼────────────────────────────────────┐
│                     BACKEND (FastAPI)                        │
│                                                             │
│  /api/interview/start                                       │
│  /api/interview/answer   ──► BackgroundTask: evaluate()     │
│  /api/interview/session/{id}                                │
│  /api/interview/results/{id}                                │
└──────────┬─────────────────────────────┬────────────────────┘
           │                             │
┌──────────▼──────────┐     ┌────────────▼───────────────────┐
│   PostgreSQL (DB)   │     │         Groq API               │
│                     │     │                                 │
│  llm_parsed_records │     │  LLaMA 3 — question generation  │
│  interview_sessions │     │  LLaMA 3 — answer evaluation    │
│  interview_questions│     │  LLaMA 3 — study plan           │
│  interview_answers  │     │  Whisper large-v3 — STT         │
└─────────────────────┘     └────────────────────────────────┘
```

---

## 4. Phase 1 — Session Setup

### What the candidate configures

Before starting, the candidate fills a simple form:

| Field | Options | Default |
|---|---|---|
| Interview type | Technical / HR / Behavioral / Mixed | Technical |
| Topic focus | Auto (from resume) / Specific topic | Auto |
| Difficulty | Easy / Medium / Hard | Medium |
| Number of questions | 5 / 10 / 15 | 10 |
| Mode | Text only / Voice | Text only |

### What happens on the backend

1. Pull the candidate's parsed resume from `llm_parsed_records` table
2. Extract: skills, experience level, target role, education
3. Build a Groq prompt with all this context
4. Call Groq once — get all N questions back as a JSON array
5. Each question is tagged with: the skill it tests, expected difficulty, expected answer keywords
6. Save all questions to `interview_questions` table
7. Create a new row in `interview_sessions` table
8. Return `session_id` + first question to frontend

### Why generate all questions at once

- Zero Groq latency mid-interview (next question always comes from DB)
- One API call instead of N calls for generation
- Questions are consistent — they are designed as a cohesive set, not generated one-by-one without context

### The resume data extraction (Python)

```python
def build_session_context(applicant_id: str, db) -> dict:
    record = db.get_parsed_resume(applicant_id)
    return {
        "skills": record.get("skills", []),
        "experience_years": record.get("experience_years", 0),
        "target_role": record.get("target_role", "Software Engineer"),
        "education": record.get("education", {}),
        "projects": record.get("projects", []),
        "work_experience": record.get("work_experience", [])
    }
```

---

## 5. Phase 2 — The Interview Loop

This is the core of the system. Here is the exact sequence for every question-answer cycle:

```
1. Frontend displays current question (from pre-generated list)
2. Candidate reads/hears question
3. Candidate types answer (or speaks — converted to text by Web Speech API)
4. Candidate clicks Submit
5. POST /api/interview/answer is called
6. Backend immediately:
   a. Saves raw answer text to DB          (~5ms)
   b. Queues evaluation as background task  (non-blocking)
   c. Fetches next question from DB         (~5ms)
   d. Returns next question to frontend     (~20ms total)
7. Frontend shows next question immediately
8. In the background (invisible to user):
   a. Groq evaluates the submitted answer   (800-2000ms)
   b. Score + feedback saved to DB
9. Repeat from step 1
```

The user experiences zero wait time between questions. The evaluation happens silently.

### Adaptive Difficulty (Mid-Session)

Even though questions are pre-generated, you can layer adaptation on top:

```python
# After every 3 questions, check running score
running_score = get_average_score_so_far(session_id)

if running_score > 80:
    # Candidate is doing well — pull a harder question from reserve pool
    next_question = get_harder_variant(session_id)
elif running_score < 40:
    # Candidate is struggling — add a hint to next question display
    next_question["hint"] = generate_hint(next_question)
```

Generate a small reserve pool of harder/easier questions at session start (2-3 extras). Swap them in based on performance. All still from the upfront Groq call.

### Mid-Interview Hint (Subtle, Like a Real Interviewer)

When the background evaluation detects a weak answer (score < 40%), the system can send a soft nudge before showing the next question:

```
Weak answer detected on Q3
→ Next question prefixed with:
  "Interesting take. Before we move on — could you touch 
   on [specific concept] specifically? Then we'll continue."
```

This is one extra field in the question response object. The hint is generated during evaluation in the background and attached to the next question delivery.

---

## 6. Phase 3 — Results & Study Plan

### The Last Question Problem

When the candidate submits the final answer, the results page loads. But that final answer's evaluation is still running in the background. You need to handle this.

**Implementation: Poll until complete**

```javascript
// ResultsPage.jsx
useEffect(() => {
  const checkResults = async () => {
    const res = await api.get(`/api/interview/results/${sessionId}`);
    if (res.data.status === "processing") {
      // Not all evaluations done yet
      setTimeout(checkResults, 2000); // check again in 2 seconds
    } else {
      setResults(res.data);
    }
  };
  checkResults();
}, [sessionId]);
```

Show a "Analyzing your responses..." spinner while polling. This feels intentional and professional, not broken.

### What the Results Page Shows

**1. Overall Score**
A single percentage. Simple.

**2. Skill Breakdown Chart**
Every question was tagged to a skill at generation time. Roll up scores by skill:

```
React          ████████░░  80%   Strong
System Design  ████░░░░░░  42%   Needs Work  ← flag this
SQL            ██████░░░░  61%   Moderate
Authentication ███████░░░  73%   Good
```

This is actionable. A single overall score is not.

**3. Per-Question Review**
For each question:
- The question text
- The candidate's answer
- AI feedback (what was good, what was missing)
- The ideal answer keywords/concepts

**4. Personalized Study Plan**
One final Groq call after all evaluations complete. Input: all weak skills + candidate's experience level. Output: a 30-day plan.

```
Week 1: System Design fundamentals
  - Read: "Designing Data-Intensive Applications" Ch 1-3
  - Practice: Design a URL shortener (classic starter problem)
  - Watch: [Specific YouTube topic]

Week 2: ...
```

This is not generic. It is generated from what the candidate actually got wrong.

---

## 7. Conversation Memory

### What This Is

Conversation memory means the AI knows the full history of the interview — not just the current question in isolation. This enables:
- Follow-up questions based on previous answers
- References to earlier responses ("You mentioned microservices earlier...")
- Coherent, human-like interview flow

### How It Works (No Framework Needed)

Groq, like all modern LLMs, accepts a `messages` array. This array is the conversation. You just reconstruct it from the database on every call and pass it in.

```python
def build_conversation_history(session_id: str, db) -> list:
    """
    Reconstruct the full conversation from DB for Groq.
    """
    questions = db.get_session_questions(session_id)
    answers = db.get_session_answers(session_id)
    
    messages = [
        {
            "role": "system",
            "content": INTERVIEWER_SYSTEM_PROMPT  # see Section 13
        }
    ]
    
    # Interleave questions and answers chronologically
    for q in questions:
        messages.append({
            "role": "assistant",
            "content": q.question_text
        })
        # Find matching answer if it exists
        answer = next((a for a in answers if a.question_id == q.id), None)
        if answer:
            messages.append({
                "role": "user",
                "content": answer.answer_text
            })
    
    return messages
```

Then when evaluating an answer or generating a follow-up, pass this history:

```python
response = groq_client.chat.completions.create(
    model="llama3-70b-8192",
    messages=build_conversation_history(session_id, db) + [
        {"role": "user", "content": "Evaluate the last answer and generate the next question."}
    ]
)
```

The DB is your state store. You already built it. No Redis, no LangGraph, no external memory system.

### Why This Is Enough

A 15-question interview with full history is roughly 3,000-5,000 tokens — well within LLaMA 3's 8,192 token context window. You have room. No chunking, no summarization needed.

---

## 8. Background Evaluation

### The FastAPI Implementation

```python
from fastapi import BackgroundTasks
from groq import Groq

groq_client = Groq(api_key=settings.GROQ_API_KEY)

@router.post("/api/interview/answer")
async def submit_answer(
    data: AnswerRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # Step 1: Save raw answer immediately (fast)
    answer_record = db.save_answer(
        session_id=data.session_id,
        question_id=data.question_id,
        answer_text=data.answer_text,
        status="pending_evaluation"
    )
    
    # Step 2: Queue evaluation — non-blocking, runs after response is sent
    background_tasks.add_task(
        run_evaluation,
        session_id=data.session_id,
        question_id=data.question_id,
        answer_id=answer_record.id,
        db=db
    )
    
    # Step 3: Get next question from DB (instant, no Groq call)
    next_q = db.get_next_question(data.session_id, data.question_id)
    
    # Step 4: Return immediately — user gets next question in ~20ms
    if next_q:
        return {
            "status": "ok",
            "next_question": next_q.question_text,
            "question_id": next_q.id,
            "question_number": next_q.order_index + 1,
            "total_questions": db.get_session_question_count(data.session_id)
        }
    else:
        return {
            "status": "interview_complete",
            "next_question": None
        }


async def run_evaluation(session_id: str, question_id: str, answer_id: str, db):
    """
    Runs in background after HTTP response is sent.
    User never waits for this.
    """
    try:
        question = db.get_question(question_id)
        answer = db.get_answer(answer_id)
        history = build_conversation_history(session_id, db)
        
        # Call Groq for evaluation
        evaluation = await evaluate_with_groq(
            question=question.question_text,
            answer=answer.answer_text,
            skill_tag=question.skill_tag,
            conversation_history=history
        )
        
        # Save evaluation result
        db.update_answer(answer_id, {
            "score": evaluation["score"],
            "feedback": evaluation["feedback"],
            "missing_concepts": evaluation["missing_concepts"],
            "status": "evaluated",
            "hint_for_next": evaluation.get("hint_for_next")
        })
        
    except Exception as e:
        # Never crash the background task silently
        db.update_answer(answer_id, {"status": "evaluation_failed"})
        logger.error(f"Evaluation failed for answer {answer_id}: {e}")
```

### The Last Question Edge Case

```python
@router.get("/api/interview/results/{session_id}")
async def get_results(session_id: str, db: Session = Depends(get_db)):
    session = db.get_session(session_id)
    answers = db.get_session_answers(session_id)
    
    # Check if all evaluations are done
    pending = [a for a in answers if a.status == "pending_evaluation"]
    
    if pending:
        return {
            "status": "processing",
            "completed": len(answers) - len(pending),
            "total": len(answers)
        }
    
    # All done — compute and return full results
    return build_full_results(session, answers, db)
```

---

## 9. Streaming

### Why Streaming Matters

Without streaming: user submits answer → stares at blank screen for 1.5 seconds → full response appears.

With streaming: user submits answer → text starts appearing after ~200ms → response builds word by word.

The total time is identical. The perceived experience is completely different. This is the single highest-impact latency improvement available, and it costs nothing.

Note: streaming applies to the **evaluator feedback** shown to the user (if you show live feedback), and to **the study plan generation** on the results page. The next question itself is instant from DB, so streaming is not needed there.

### FastAPI Streaming Implementation

```python
from fastapi.responses import StreamingResponse
import json

@router.get("/api/interview/study-plan/{session_id}")
async def stream_study_plan(session_id: str, db: Session = Depends(get_db)):
    """
    Streams the study plan generation so user sees it build in real time.
    """
    weak_skills = db.get_weak_skills(session_id)  # skills with score < 60%
    
    async def generate():
        stream = groq_client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[{
                "role": "user",
                "content": build_study_plan_prompt(weak_skills)
            }],
            stream=True  # This is the key flag
        )
        
        for chunk in stream:
            if chunk.choices[0].delta.content:
                # Send each token as a Server-Sent Event
                yield f"data: {json.dumps({'token': chunk.choices[0].delta.content})}\n\n"
        
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"}
    )
```

### Frontend Streaming Consumer

```javascript
// In ResultsPage.jsx
const streamStudyPlan = async (sessionId) => {
    const response = await fetch(`/api/interview/study-plan/${sessionId}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let plan = "";
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        
        for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
                const data = JSON.parse(line.replace("data: ", ""));
                plan += data.token;
                setStudyPlan(plan); // React state update — UI updates in real time
            }
        }
    }
};
```

---

## 10. Voice Layer (Optional Upgrade)

The voice layer is entirely browser-side. The backend does not change at all. Voice input is converted to text in the browser and sent to the same REST endpoints as typed text.

### Voice Input — Web Speech API

```javascript
// InterviewPage.jsx
const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        // Fallback: show text input
        setVoiceAvailable(false);
        return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;  // Show partial results while speaking
    recognition.lang = "en-US";
    
    recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join("");
        setAnswerText(transcript);  // Same state variable as typed answer
    };
    
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e) => {
        console.error("Speech recognition error:", e);
        setIsListening(false);
    };
    
    recognition.start();
    setIsListening(true);
};
```

### Voice Output — Web SpeechSynthesis

```javascript
const speakQuestion = (questionText) => {
    window.speechSynthesis.cancel(); // Stop any current speech
    
    const utterance = new SpeechSynthesisUtterance(questionText);
    utterance.rate = 0.9;    // Slightly slower than default — more natural
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Try to use a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => 
        v.name.includes("Google") || v.name.includes("Natural")
    );
    if (preferred) utterance.voice = preferred;
    
    window.speechSynthesis.speak(utterance);
};

// Call this whenever a new question is displayed
useEffect(() => {
    if (voiceMode && currentQuestion) {
        speakQuestion(currentQuestion.text);
    }
}, [currentQuestion]);
```

### Groq Whisper Fallback (Higher Quality STT)

If Web Speech API accuracy is insufficient:

```python
@router.post("/api/interview/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Fallback STT endpoint using Groq Whisper.
    Only used if Web Speech API is unavailable or inaccurate.
    """
    audio_bytes = await audio.read()
    
    transcription = groq_client.audio.transcriptions.create(
        model="whisper-large-v3",
        file=("audio.webm", audio_bytes, "audio/webm"),
        language="en"
    )
    
    return {"transcript": transcription.text}
```

### Voice Mode Decision Logic (Frontend)

```
User enables Voice Mode
→ Check: window.SpeechRecognition available?
  YES → Use Web Speech API (free, browser-native)
  NO  → Fall back to Groq Whisper (record audio blob → POST to /transcribe)
→ Either way, the answer text goes to the same /api/interview/answer endpoint
```

---

## 11. Database Design

All tables already exist in your schema. No migrations needed. Here is how each is used:

### `interview_sessions`

```sql
id              UUID PRIMARY KEY
applicant_id    UUID REFERENCES applicants(id)
status          ENUM('active', 'completed', 'abandoned')
interview_type  VARCHAR  -- 'technical', 'hr', 'behavioral', 'mixed'
difficulty      VARCHAR  -- 'easy', 'medium', 'hard'
voice_mode      BOOLEAN  DEFAULT FALSE
total_questions INTEGER
overall_score   FLOAT    -- populated when all evaluations complete
created_at      TIMESTAMP
completed_at    TIMESTAMP
```

### `interview_questions`

```sql
id              UUID PRIMARY KEY
session_id      UUID REFERENCES interview_sessions(id)
order_index     INTEGER  -- 0-based position in session
question_text   TEXT
skill_tag       VARCHAR  -- e.g. 'React', 'System Design', 'SQL'
difficulty_level VARCHAR  -- may change from session default if adaptive
expected_keywords TEXT[]  -- concepts Groq expects in a good answer
is_followup     BOOLEAN  DEFAULT FALSE
created_at      TIMESTAMP
```

### `interview_answers`

```sql
id              UUID PRIMARY KEY
session_id      UUID REFERENCES interview_sessions(id)
question_id     UUID REFERENCES interview_questions(id)
answer_text     TEXT
score           FLOAT    -- 0.0 to 1.0, populated by background evaluation
feedback        TEXT     -- AI feedback on this answer
missing_concepts TEXT[]  -- what the candidate missed
hint_for_next   TEXT     -- optional nudge to prefix on next question
status          ENUM('pending_evaluation', 'evaluated', 'evaluation_failed')
created_at      TIMESTAMP
evaluated_at    TIMESTAMP
```

### Session Resume Query

```sql
-- Check for incomplete sessions for a user
SELECT s.id, s.created_at, s.total_questions,
       COUNT(a.id) as answered_count
FROM interview_sessions s
LEFT JOIN interview_answers a ON a.session_id = s.id
WHERE s.applicant_id = :applicant_id
  AND s.status = 'active'
  AND s.created_at > NOW() - INTERVAL '24 hours'
GROUP BY s.id
ORDER BY s.created_at DESC
LIMIT 1;
```

---

## 12. API Contracts

### POST /api/interview/start

**Request:**
```json
{
  "applicant_id": "uuid",
  "interview_type": "technical",
  "difficulty": "medium",
  "num_questions": 10,
  "topic_focus": null,
  "voice_mode": false
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "first_question": {
    "id": "uuid",
    "text": "Explain the difference between REST and GraphQL.",
    "question_number": 1,
    "total_questions": 10,
    "skill_tag": "API Design"
  }
}
```

---

### POST /api/interview/answer

**Request:**
```json
{
  "session_id": "uuid",
  "question_id": "uuid",
  "answer_text": "REST uses fixed endpoints while GraphQL..."
}
```

**Response (mid-interview):**
```json
{
  "status": "ok",
  "next_question": {
    "id": "uuid",
    "text": "Good. Now explain how you would handle authentication in a GraphQL API.",
    "question_number": 2,
    "total_questions": 10,
    "skill_tag": "Authentication",
    "hint": null
  }
}
```

**Response (last question):**
```json
{
  "status": "interview_complete",
  "next_question": null
}
```

---

### GET /api/interview/session/{session_id}

Used for crash recovery / page refresh.

**Response:**
```json
{
  "session_id": "uuid",
  "status": "active",
  "current_question_index": 4,
  "total_questions": 10,
  "current_question": {
    "id": "uuid",
    "text": "...",
    "question_number": 5
  },
  "answers_submitted": 4
}
```

---

### GET /api/interview/results/{session_id}

**Response (still processing):**
```json
{
  "status": "processing",
  "completed": 8,
  "total": 10
}
```

**Response (complete):**
```json
{
  "status": "complete",
  "overall_score": 0.67,
  "skill_breakdown": [
    {"skill": "React", "score": 0.80, "questions": 3, "label": "Strong"},
    {"skill": "System Design", "score": 0.42, "questions": 2, "label": "Needs Work"},
    {"skill": "SQL", "score": 0.61, "questions": 2, "label": "Moderate"}
  ],
  "questions_review": [
    {
      "question": "Explain React hooks",
      "answer": "Hooks let you use state in functional components...",
      "score": 0.80,
      "feedback": "Good explanation of useState. Missing discussion of useCallback and useMemo for performance optimization.",
      "missing_concepts": ["useCallback", "useMemo", "custom hooks"]
    }
  ],
  "weak_skills": ["System Design", "Authentication"]
}
```

---

### POST /api/interview/transcribe (Voice Fallback)

**Request:** multipart/form-data with audio file (WebM)

**Response:**
```json
{
  "transcript": "I think the main difference between REST and GraphQL is..."
}
```

---

## 13. Groq Prompt Templates

### System Prompt (Interviewer Persona)

```python
INTERVIEWER_SYSTEM_PROMPT = """
You are an experienced technical interviewer at a top technology company.
You are conducting a mock interview for a candidate.

Candidate profile:
- Role: {target_role}
- Experience: {experience_years} years
- Skills: {skills}
- Projects: {projects}

Interview configuration:
- Type: {interview_type}
- Difficulty: {difficulty}
- Total questions: {num_questions}

Your behavior:
- Ask one question at a time
- Be professional but warm — like a real human interviewer
- Reference the candidate's background naturally when relevant
- Do not give away answers or over-hint
- Keep questions focused and clear
- Vary question types: conceptual, practical, scenario-based

Important: Generate questions that specifically test the skills listed 
in the candidate's resume. Make the interview feel personalized.
"""
```

---

### Question Generation Prompt

```python
QUESTION_GENERATION_PROMPT = """
Generate exactly {num_questions} interview questions for this candidate.

Candidate skills: {skills}
Target role: {target_role}
Experience level: {experience_years} years
Interview type: {interview_type}
Difficulty: {difficulty}

Rules:
- Each question must test a specific skill from the candidate's profile
- Distribute questions across different skills (do not repeat the same skill more than twice)
- Mix question types: conceptual explanation, practical scenario, problem-solving
- Match difficulty: easy=foundational, medium=applied, hard=system-level/edge-cases

Respond ONLY with a valid JSON array. No preamble, no markdown, no explanation.
Format:
[
  {
    "question_text": "...",
    "skill_tag": "React",
    "difficulty": "medium",
    "expected_keywords": ["hooks", "state", "lifecycle", "functional component"],
    "question_type": "conceptual"
  },
  ...
]
"""
```

---

### Answer Evaluation Prompt

```python
EVALUATION_PROMPT = """
Evaluate this interview answer.

Question: {question_text}
Skill being tested: {skill_tag}
Expected key concepts: {expected_keywords}
Candidate's answer: {answer_text}

Evaluate objectively. Consider:
- Accuracy of technical content
- Depth of understanding (not just surface-level)
- Clarity of explanation
- Coverage of key concepts

Respond ONLY with valid JSON. No preamble.
Format:
{
  "score": 0.75,
  "feedback": "Good understanding of X. Missing discussion of Y and Z.",
  "missing_concepts": ["concept1", "concept2"],
  "strength": "Clear explanation of the core mechanism",
  "hint_for_next": null
}

Score guide: 0.0-0.39=poor, 0.40-0.59=average, 0.60-0.79=good, 0.80-1.0=excellent
hint_for_next: only populate if score < 0.40 and a gentle nudge would help bridge to the next question. Otherwise null.
"""
```

---

### Study Plan Prompt

```python
STUDY_PLAN_PROMPT = """
Generate a personalized 30-day study plan for a {experience_level} developer 
who performed weakly in the following areas during a mock interview:

Weak skills: {weak_skills}

For each skill, provide:
- Why it matters for their target role ({target_role})
- Specific resources (books, videos, practice sites)
- Concrete exercises to practice
- A realistic weekly breakdown

Format as a readable, motivating study guide. Be specific — not generic advice.
Reference real resources, real problem sets, real concepts to study.
"""
```

---

## 14. Frontend Page Design

### Page 1 — Setup Page (/dashboard/interview)

**Components:**
- Interview type selector (tabs: Technical / HR / Behavioral / Mixed)
- Difficulty selector (radio: Easy / Medium / Hard)
- Question count slider (5, 10, 15)
- Topic focus input (optional override — defaults to auto from resume)
- Voice mode toggle
- "Resume Incomplete" warning if resume not parsed yet
- "You have an unfinished session" banner (session resume)
- Start Interview button

**State to manage:**
```javascript
const [config, setConfig] = useState({
  interview_type: "technical",
  difficulty: "medium",
  num_questions: 10,
  topic_focus: null,
  voice_mode: false
});
```

---

### Page 2 — Interview Page (/dashboard/interview/:sessionId)

**Components:**
- Progress bar (Question 3 of 10)
- Question card (large, centered, readable)
- Answer input area (textarea or voice button)
- Mic button (if voice mode) with listening indicator
- Submit button
- Timer (optional — shows elapsed time, no hard limit)
- "Leave session" button with confirmation dialog

**State to manage:**
```javascript
const [currentQuestion, setCurrentQuestion] = useState(null);
const [answerText, setAnswerText] = useState("");
const [isListening, setIsListening] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
const [questionNumber, setQuestionNumber] = useState(1);
const [totalQuestions, setTotalQuestions] = useState(10);
```

**On page load:** call GET /api/interview/session/:id to recover state if page was refreshed.

---

### Page 3 — Results Page (/dashboard/interview/results/:sessionId)

**States:**
1. **Processing** — spinner + "Analyzing your {N} responses..."
2. **Complete** — full results display

**Components:**
- Overall score circle (large percentage)
- Skill breakdown bar chart (one bar per skill, color-coded)
- Per-question accordion (expand each Q to see feedback)
- Study plan section (streamed in, appears word by word)
- "Start New Session" button
- "Save Results" button (already saved to DB, just links to history)

---

## 15. Error Handling & Edge Cases

### Browser refresh mid-interview

GET /api/interview/session/:id returns current state. Frontend restores to the correct question. Any answers already submitted are safe in DB.

### Groq API failure during question generation

```python
try:
    questions = generate_questions_with_groq(context)
except Exception as e:
    # Fall back to a curated question bank for the candidate's role
    questions = get_fallback_questions(target_role, difficulty, num_questions)
    logger.warning(f"Groq failed, using fallback questions: {e}")
```

Have a small hardcoded bank of generic questions per role as fallback. The session starts regardless.

### Background evaluation failure

The answer is already saved with `status="evaluation_failed"`. Results page detects this and shows "Could not evaluate this answer" for that question rather than crashing. The session is not broken.

### Last question — results not ready

Frontend polls GET /api/interview/results/:id every 2 seconds. Backend returns `{"status": "processing"}` until all evaluations are complete. Maximum wait: ~10 seconds for a 15-question session's last evaluation.

### Voice not supported

```javascript
const voiceSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
if (!voiceSupported) {
  // Silently disable voice mode toggle
  // Show tooltip: "Voice not supported in this browser. Use Chrome for voice interviews."
}
```

### Session abandoned (user leaves mid-interview)

On page unload, send a beacon:
```javascript
window.addEventListener("beforeunload", () => {
  navigator.sendBeacon(`/api/interview/abandon/${sessionId}`);
});
```

Backend marks session as `abandoned`. This session will appear in the "resume?" prompt next time.

---

## 16. File Structure

```
resume_pipeline/
└── resume_pipeline/
    └── interview/
        ├── __init__.py
        ├── router.py          # All 5 API endpoints
        ├── service.py         # Core business logic
        ├── evaluator.py       # Background evaluation logic
        ├── generator.py       # Question generation logic
        ├── prompts.py         # All Groq prompt templates
        ├── schemas.py         # Pydantic request/response models
        ├── voice.py           # Whisper transcription endpoint
        └── fallback_questions.py  # Hardcoded fallback question bank

frontend/
└── src/
    └── pages/
        └── interview/
            ├── SetupPage.jsx
            ├── InterviewPage.jsx
            ├── ResultsPage.jsx
            └── hooks/
                ├── useSpeechRecognition.js
                ├── useSpeechSynthesis.js
                └── useInterviewSession.js
```

---

## 17. Build Order

Build in this exact sequence. Each step is independently testable.

### Week 1 — Core REST System

- [ ] `generator.py` — call Groq, get questions JSON, save to DB
- [ ] `router.py` — POST /start endpoint, GET /session endpoint
- [ ] `schemas.py` — all Pydantic models
- [ ] `router.py` — POST /answer endpoint (no background eval yet, evaluate synchronously first)
- [ ] `router.py` — GET /results endpoint
- [ ] Test: full 5-question interview via Swagger UI (localhost:8000/docs)

### Week 2 — Background Evaluation + Streaming

- [ ] Move evaluation to BackgroundTasks in /answer endpoint
- [ ] Add polling logic to GET /results (processing vs complete status)
- [ ] Add streaming to GET /study-plan endpoint
- [ ] Frontend ResultsPage: polling loop + streaming study plan display

### Week 3 — Frontend Pages

- [ ] SetupPage.jsx — config form + start session
- [ ] InterviewPage.jsx — question display + answer submission
- [ ] ResultsPage.jsx — skill chart + per-question review + study plan
- [ ] Session recovery on page refresh
- [ ] Session resume banner on setup page

### Week 4 — Voice + Polish

- [ ] useSpeechRecognition.js hook
- [ ] useSpeechSynthesis.js hook
- [ ] Voice mode UI in InterviewPage
- [ ] POST /transcribe endpoint (Groq Whisper fallback)
- [ ] Mid-interview hints (hint_for_next field)
- [ ] Adaptive difficulty (score-based question swapping)
- [ ] Error states and fallback questions

---

## Summary

| Decision | Choice | Reason |
|---|---|---|
| Connection type | REST (HTTP) | Interview is turn-based, not continuous |
| State management | PostgreSQL (existing) | Already built, fast enough, no Redis needed |
| Memory system | Message history list | Groq supports it natively, no framework needed |
| Task queue | FastAPI BackgroundTasks | Simple, zero dependencies, right scale |
| AI backbone | Groq LLaMA 3 | Already integrated, free tier, fast |
| STT (primary) | Web Speech API | Free, browser-native, zero backend |
| STT (fallback) | Groq Whisper | Already have API key, high quality |
| TTS | Web SpeechSynthesis | Free, browser-native, zero backend |
| Streaming | SSE (Server-Sent Events) | Native browser support, simple to implement |
| Latency fix | Pre-generation + background eval | Real problem, right solution |
| LangGraph | Not used | Linear flow does not need a graph framework |
| Redis | Not used | DB is fast enough for this access pattern |
| Celery | Not used | BackgroundTasks is sufficient at this scale |

---

## 18. Rate Limiting & Cost Safeguards

To prevent API spams and safeguard against high LLM/Whisper costs, a transactional database-backed rate-limiting system is implemented:

### Configured Thresholds
- **Session Start**: Max 1 mock session created per 5 minutes per applicant, and an overall limit of 3 mock sessions per day.
- **Answer Submission**: Max 1 answer submitted per 10 seconds per applicant, and an overall limit of 30 evaluations per day.

### Implementation Blueprint (`limiter.py`)
Both checks query the transactional indexes of the `interview_sessions` and `interview_answers` tables. This is 100% safe for multi-process environments like Render, as all web processes share the same PostgreSQL database.

On violation, the backend throws an `HTTP 429 Too Many Requests` error with detailed retry instructions, which are seamlessly displayed by the frontend toast alert system.

---

*This document covers everything needed to build the interview system from scratch. Follow the build order in Section 17. Each week produces something testable and shippable.*
