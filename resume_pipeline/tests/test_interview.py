"""
Unit tests for the new Interview System v2 backend logic.
Covers question generation context, fallback question matching, session creation,
and question navigation/state updates.
"""
import sys
import os
import uuid
import pytest

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from resume_pipeline.db import SessionLocal, User, Applicant, InterviewSession, InterviewQuestion, InterviewAnswer
from resume_pipeline.interview.generator import build_session_context
from resume_pipeline.interview.fallback_questions import get_fallback_questions
from resume_pipeline.interview.service import (
    create_session,
    get_next_question,
    get_current_question,
    get_active_session,
    get_running_score,
    get_weak_skills,
    build_full_results,
    mark_session_abandoned
)

@pytest.fixture(scope="module")
def db():
    """Database session fixture."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture(scope="module")
def test_user_and_applicant(db):
    """Creates a temporary student user and applicant profile for testing."""
    test_uid = f"test_user_{uuid.uuid4().hex[:8]}"
    
    # Create user
    user = User(
        email=f"{test_uid}@example.com",
        password_hash="fake_hash",
        role="student",
        is_verified=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create applicant
    applicant = Applicant(
        user_id=user.id,
        applicant_id=f"app_{test_uid}",
        display_name="Test Applicant",
        location_city="Bangalore"
    )
    db.add(applicant)
    db.commit()
    db.refresh(applicant)

    yield user, applicant

    # Cleanup after tests
    # Delete answers, questions, sessions first to avoid FK constraints
    sessions = db.query(InterviewSession).filter_by(applicant_id=applicant.id).all()
    for s in sessions:
        db.query(InterviewAnswer).filter_by(session_id=s.id).delete()
        db.query(InterviewQuestion).filter_by(session_id=s.id).delete()
        db.delete(s)
    db.delete(applicant)
    db.delete(user)
    db.commit()


def test_build_session_context():
    """Test extracting session context from LLM parsed records."""
    raw_record = {
        "normalized": {
            "skills": ["Python", "SQL", "React"],
            "experience_years": 3,
            "target_role": "Backend Developer",
            "education": {"degree": "B.Tech"},
            "projects": [{"title": "Project A"}, {"title": "Project B"}],
            "work_experience": [{"company": "Google", "title": "SWE"}]
        }
    }
    context = build_session_context(raw_record)
    assert context["experience_years"] == 3
    assert context["target_role"] == "Backend Developer"
    assert "Python" in context["skills"]
    assert "Project A" in context["projects"]
    assert "Google — SWE" in context["work_experience"]


def test_fallback_questions():
    """Test loading fallback questions for various roles and difficulties."""
    # Test software engineer medium
    questions = get_fallback_questions("Software Engineer", "medium", num_questions=3, reserve_count=2)
    assert len(questions) == 5
    assert all(isinstance(q["question_text"], str) for q in questions)
    assert all(isinstance(q["skill_tag"], str) for q in questions)
    
    # Assert reserve questions are tagged
    assert sum(1 for q in questions if q.get("is_reserve")) == 2

    # Test unknown role defaults to General
    general_qs = get_fallback_questions("Astronaut Chef", "easy", num_questions=2, reserve_count=1)
    assert len(general_qs) == 3


def test_session_lifecycle(db, test_user_and_applicant):
    """Test full session setup, question navigation, answering, and status changes."""
    user, applicant = test_user_and_applicant

    # 1. Generate fallback questions
    questions_data = get_fallback_questions(
        target_role="Software Engineer",
        difficulty="medium",
        num_questions=3,
        reserve_count=2
    )

    # 2. Create interview session
    session, first_q = create_session(
        applicant_id=applicant.id,
        interview_type="technical",
        difficulty="medium",
        num_questions=3,
        voice_mode=False,
        topic_focus="Python",
        questions_data=questions_data,
        db=db
    )

    assert session is not None
    assert session.status == "active"
    assert session.interview_type == "technical"
    assert session.difficulty == "medium"
    assert first_q is not None
    assert first_q.order_index == 0
    assert first_q.is_reserve is False

    # 3. Active session helper should find this session
    active = get_active_session(applicant.id, db)
    assert active is not None
    assert active.id == session.id

    # 4. Current question helper should return first question
    curr_q = get_current_question(session.id, db)
    assert curr_q is not None
    assert curr_q.id == first_q.id

    # 5. Answer first question
    ans1 = InterviewAnswer(
        id=uuid.uuid4().hex,
        session_id=session.id,
        question_id=first_q.id,
        answer_text="Python is a dynamically typed high-level language.",
        score=0.85,
        feedback="Good description.",
        missing_concepts=[],
        status="evaluated"
    )
    db.add(ans1)
    db.commit()

    # Running score check
    assert get_running_score(session.id, db) == 0.85

    # 6. Retrieve next question
    next_q = get_next_question(session.id, first_q.id, db)
    assert next_q is not None
    assert next_q.order_index == 1
    assert next_q.is_reserve is False

    # Current question should now point to next_q
    curr_q = get_current_question(session.id, db)
    assert curr_q.id == next_q.id

    # Answer second question (weak score)
    ans2 = InterviewAnswer(
        id=uuid.uuid4().hex,
        session_id=session.id,
        question_id=next_q.id,
        answer_text="I don't know.",
        score=0.20,
        feedback="Incorrect answer.",
        missing_concepts=["Lists", "Dicts"],
        status="evaluated"
    )
    db.add(ans2)
    db.commit()

    # Running score should update
    assert get_running_score(session.id, db) == 0.525  # (0.85 + 0.20) / 2

    # Weak skills helper check
    weak_skills = get_weak_skills(session.id, db)
    assert len(weak_skills) >= 1

    # 7. Get third question
    third_q = get_next_question(session.id, next_q.id, db)
    assert third_q is not None
    assert third_q.order_index == 2

    # Answer third question
    ans3 = InterviewAnswer(
        id=uuid.uuid4().hex,
        session_id=session.id,
        question_id=third_q.id,
        answer_text="SQL is Structured Query Language.",
        score=0.90,
        feedback="Perfect.",
        missing_concepts=[],
        status="evaluated"
    )
    db.add(ans3)
    db.commit()

    # Next question after the 3rd should be None (reserve questions are only swapped in if triggered)
    fourth_q = get_next_question(session.id, third_q.id, db)
    assert fourth_q is None

    # 8. Complete session (build_full_results updates status and score)
    build_full_results(session, db)
    db.refresh(session)
    assert session.status == "completed"
    assert abs(session.overall_score - 0.65) < 0.01
    assert session.completed_at is not None

    # Active session check should now be None
    assert get_active_session(applicant.id, db) is None


def test_abandon_session(db, test_user_and_applicant):
    """Test marking a session as abandoned."""
    user, applicant = test_user_and_applicant

    questions_data = get_fallback_questions("Software Engineer", "medium", 2, 1)
    session, _ = create_session(
        applicant_id=applicant.id,
        interview_type="hr",
        difficulty="medium",
        num_questions=2,
        voice_mode=False,
        topic_focus="",
        questions_data=questions_data,
        db=db
    )

    assert session.status == "active"
    
    mark_session_abandoned(session.id, db)
    db.refresh(session)
    assert session.status == "abandoned"
    assert get_active_session(applicant.id, db) is None


def test_get_history(db, test_user_and_applicant):
    """Test fetching all interview sessions for an applicant (history)."""
    user, applicant = test_user_and_applicant
    
    # We should have the sessions created in the previous tests
    sessions = db.query(InterviewSession).filter_by(applicant_id=applicant.id).all()
    assert len(sessions) >= 2
    
    statuses = [s.status for s in sessions]
    assert "completed" in statuses
    assert "abandoned" in statuses


def test_growth_oriented_history(db, test_user_and_applicant):
    """Test compiled historical weak areas and growth context logic."""
    user, applicant = test_user_and_applicant
    
    past_sessions = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.applicant_id == applicant.id,
            InterviewSession.status == "completed"
        )
        .all()
    )
    assert len(past_sessions) >= 1
    
    past_session_ids = [s.id for s in past_sessions]
    past_answers = (
        db.query(InterviewAnswer)
        .join(InterviewQuestion, InterviewAnswer.question_id == InterviewQuestion.id)
        .filter(
            InterviewAnswer.session_id.in_(past_session_ids),
            InterviewAnswer.status == "evaluated",
            InterviewAnswer.score.isnot(None),
        )
        .all()
    )
    
    skill_scores = {}
    for a in past_answers:
        tag = a.question.skill_tag
        skill_scores.setdefault(tag, []).append(a.score)
        
    past_weak_skills = []
    for skill, scores in skill_scores.items():
        avg = sum(scores) / len(scores)
        if avg < 0.60:
            past_weak_skills.append(skill)
            
    assert len(past_weak_skills) >= 1


def test_study_plan_caching(db, test_user_and_applicant):
    """Test study plan caching mechanism."""
    import asyncio
    from unittest.mock import patch
    user, applicant = test_user_and_applicant
    
    # Create session
    questions_data = get_fallback_questions("Software Engineer", "medium", 2, 1)
    session, _ = create_session(
        applicant_id=applicant.id,
        interview_type="technical",
        difficulty="medium",
        num_questions=2,
        voice_mode=False,
        topic_focus="Python",
        questions_data=questions_data,
        db=db
    )
    assert session.study_plan is None
    
    # Mock stream generator to avoid external API rate limits during unit tests
    async def mock_stream_study_plan(*args, **kwargs):
        yield 'data: {"token": "Mock Study Plan Token 1"}\n\n'
        yield 'data: {"token": "Mock Study Plan Token 2"}\n\n'
        yield 'data: [DONE]\n\n'
    
    # Run async generator consumption
    async def run_consume():
        from resume_pipeline.interview.router import _stream_and_cache_study_plan
        tokens = []
        async for item in _stream_and_cache_study_plan(
            session_id=session.id,
            db=db,
            weak_skills=["Python"],
            missing_concepts_summary="Syntax errors",
            target_role="Software Engineer",
            experience_level="junior"
        ):
            tokens.append(item)
        return tokens
        
    with patch("resume_pipeline.interview.router.stream_study_plan", new=mock_stream_study_plan):
        asyncio.run(run_consume())
    
    db.refresh(session)
    assert session.study_plan is not None
    assert len(session.study_plan) > 0


def test_exit_suspension_logic(db, test_user_and_applicant):
    """Test daily mock practice suspension logic when user exits sessions more than twice."""
    user, applicant = test_user_and_applicant
    
    # 1. Start with clean slate: check abandoned count
    import datetime
    exit_cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
    initial_count = db.query(InterviewSession).filter(
        InterviewSession.applicant_id == applicant.id,
        InterviewSession.status == "abandoned",
        InterviewSession.created_at >= exit_cutoff
    ).count()
    
    # 2. Add 3 abandoned sessions to simulate suspensions
    sessions_to_cleanup = []
    for _ in range(3):
        questions_data = get_fallback_questions("Software Engineer", "medium", 2, 1)
        session, _ = create_session(
            applicant_id=applicant.id,
            interview_type="technical",
            difficulty="medium",
            num_questions=2,
            voice_mode=False,
            topic_focus="Python",
            questions_data=questions_data,
            db=db
        )
        session.status = "abandoned"
        db.commit()
        sessions_to_cleanup.append(session)
        
    # 3. Verify count is now initial_count + 3
    abandoned_count = db.query(InterviewSession).filter(
        InterviewSession.applicant_id == applicant.id,
        InterviewSession.status == "abandoned",
        InterviewSession.created_at >= exit_cutoff
    ).count()
    assert abandoned_count == initial_count + 3
    
    # 4. Cleanup sessions so it doesn't affect other tests
    for s in sessions_to_cleanup:
        db.query(InterviewQuestion).filter_by(session_id=s.id).delete()
        db.delete(s)
    db.commit()


def test_navigation_and_early_finish(db, test_user_and_applicant):
    """Test manual prev/next navigation data retrieval and mid-interview finish endpoints."""
    user, applicant = test_user_and_applicant
    
    # 1. Create a session
    questions_data = get_fallback_questions("Software Engineer", "medium", 3, 1)
    session, _ = create_session(
        applicant_id=applicant.id,
        interview_type="technical",
        difficulty="medium",
        num_questions=3,
        voice_mode=False,
        topic_focus="Python",
        questions_data=questions_data,
        db=db
    )
    
    # 2. Assert questions list API maps correctly
    from resume_pipeline.interview.router import get_session_questions, finish_interview
    
    # Simulate DB lookup
    qs = get_session_questions(session_id=session.id, db=db, current_user=user)
    assert len(qs) == 3
    assert qs[0].question_number == 1
    assert qs[0].user_answer is None
    
    # 3. Simulate mid-interview Finish Early
    res = finish_interview(session_id=session.id, db=db, current_user=user)
    assert res["status"] == "ok"
    
    # Refresh and assert completed status
    db.refresh(session)
    assert session.status == "completed"
    assert session.completed_at is not None
    
    # Cleanup
    db.query(InterviewQuestion).filter_by(session_id=session.id).delete()
    db.delete(session)
    db.commit()


def test_question_deduplication_and_diversity(db, test_user_and_applicant):
    """Test generating questions with granular skill tags, strict diversity, and deduplication context."""
    user, applicant = test_user_and_applicant
    
    from resume_pipeline.interview.generator import generate_questions
    
    context = {
        "skills": ["React", "Python", "SQL"],
        "experience_years": 4,
        "target_role": "Fullstack Developer",
        "projects": [],
        "work_experience": []
    }
    
    past_questions = [
        "Explain the virtual DOM in React",
        "What are decorators in Python?"
    ]
    
    # Test generation (should execute cleanly under both mock and live modes)
    questions = generate_questions(
        context=context,
        num_questions=3,
        interview_type="technical",
        difficulty="medium",
        past_question_texts=past_questions
    )
    
    assert len(questions) > 0
    for q in questions:
        assert "question_text" in q
        assert "skill_tag" in q
        assert "question_type" in q


def test_rate_limiter_session_and_answers(db, test_user_and_applicant):
    """Test that the DB-backed rate limiter correctly throws 429 exceptions."""
    user, applicant = test_user_and_applicant
    
    from resume_pipeline.interview.limiter import check_session_start_limits, check_answer_submit_limits
    from fastapi import HTTPException
    
    # 1. Create a dummy session
    session = InterviewSession(
        applicant_id=applicant.id,
        interview_type="technical",
        difficulty="medium",
        total_questions=3
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    # Starting a second session immediately should trigger a rate limit exception (5 min window)
    with pytest.raises(HTTPException) as exc_info:
        check_session_start_limits(applicant.id, db)
    assert exc_info.value.status_code == 429
    assert "Please wait" in exc_info.value.detail
    
    # Cleanup session
    db.delete(session)
    db.commit()
    
    # 2. Test answer submissions rate limiter (10 seconds)
    session = InterviewSession(
        applicant_id=applicant.id,
        interview_type="technical",
        difficulty="medium",
        total_questions=3
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    q = InterviewQuestion(
        session_id=session.id,
        order_index=0,
        question_text="Dummy question",
        skill_tag="React",
        difficulty_level="medium"
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    
    ans = InterviewAnswer(
        session_id=session.id,
        question_id=q.id,
        answer_text="My answer",
        status="evaluated"
    )
    db.add(ans)
    db.commit()
    
    # Trying to submit another answer immediately should raise a 429
    with pytest.raises(HTTPException) as exc_info:
        check_answer_submit_limits(applicant.id, db)
    assert exc_info.value.status_code == 429
    assert "Please wait" in exc_info.value.detail
    
    # Cleanup
    db.delete(ans)
    db.delete(q)
    db.delete(session)
    db.commit()


def test_candidate_intelligence(db, test_user_and_applicant):
    """Test generating and updating Longitudinal Candidate Profile."""
    import datetime
    user, applicant = test_user_and_applicant
    
    # 1. Create a completed session
    questions_data = get_fallback_questions("Software Engineer", "medium", 2, 1)
    session, _ = create_session(
        applicant_id=applicant.id,
        interview_type="technical",
        difficulty="medium",
        num_questions=2,
        voice_mode=False,
        topic_focus="React",
        questions_data=questions_data,
        db=db
    )
    
    # Add answers
    for q in session.questions:
        ans = InterviewAnswer(
            id=uuid.uuid4().hex,
            session_id=session.id,
            question_id=q.id,
            answer_text="React hooks are functions that let you hook into React state and lifecycle features.",
            score=0.80,
            feedback="Good answer",
            strength="Clear core explanation",
            missing_concepts=[],
            status="evaluated"
        )
        db.add(ans)
    
    session.overall_score = 0.80
    session.status = "completed"
    session.completed_at = datetime.datetime.utcnow()
    db.commit()
    
    # 2. Invoke Candidate Intelligence generator
    from resume_pipeline.interview.candidate_intelligence import generate_longitudinal_profile
    profile = generate_longitudinal_profile(applicant.id, db)
    
    assert profile is not None
    assert profile["sessions_count"] >= 1
    assert "summary" in profile
    assert "answer_patterns" in profile
    assert "technical_skills" in profile
    assert "role_readiness" in profile
    
    # Refresh applicant and verify direct attribute access
    db.refresh(applicant)
    assert applicant.candidate_profile is not None
    assert applicant.candidate_profile["sessions_count"] >= 1
    
    # Cleanup
    for q in session.questions:
        db.query(InterviewAnswer).filter_by(question_id=q.id).delete()
    db.query(InterviewQuestion).filter_by(session_id=session.id).delete()
    db.delete(session)
    db.commit()


def test_interviewer_persona(db, test_user_and_applicant):
    """Test creating a session with a custom interviewer persona and retrieving it."""
    user, applicant = test_user_and_applicant
    
    # 1. Create a session with 'Tough FAANG Interviewer'
    questions_data = get_fallback_questions("Software Engineer", "medium", 2, 1)
    session, _ = create_session(
        applicant_id=applicant.id,
        interview_type="technical",
        difficulty="medium",
        num_questions=2,
        voice_mode=False,
        topic_focus="React",
        questions_data=questions_data,
        db=db,
        interviewer_persona="Tough FAANG Interviewer"
    )
    
    assert session.interviewer_persona == "Tough FAANG Interviewer"
    
    # Clean up
    db.query(InterviewQuestion).filter_by(session_id=session.id).delete()
    db.delete(session)
    db.commit()


def test_coordinate_selection_and_cooldown(db, test_user_and_applicant):
    """Test the coordinate selection, depth progression, and cooldown selector logic."""
    user, applicant = test_user_and_applicant
    
    from resume_pipeline.interview.generator import (
        select_subtopics_for_session,
        select_coordinate_for_subtopic
    )
    import datetime

    # 1. Test coordinate selection for a brand-new subtopic (should return surface, conceptual, and empty past list)
    lvl, ctx, past = select_coordinate_for_subtopic(applicant.id, "Nonexistent Subtopic", db)
    assert lvl == "surface"
    assert ctx == "conceptual"
    assert len(past) == 0

    # 2. Test selecting subtopics with no history (should cycle correctly)
    selected_new = select_subtopics_for_session(applicant.id, "React", 3, db)
    assert len(selected_new) == 3

    # 3. Create a session, questions, and answers to simulate progress
    session = InterviewSession(
        applicant_id=applicant.id,
        interview_type="technical",
        difficulty="medium",
        total_questions=2,
        status="completed"
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Question 1: React - hooks - useState internals, surface, conceptual. Score: 0.85
    q1 = InterviewQuestion(
        session_id=session.id,
        order_index=0,
        question_text="What is useState?",
        skill_tag="hooks - useState internals",
        difficulty_level="surface",
        question_type="conceptual"
    )
    db.add(q1)
    db.commit()
    db.refresh(q1)

    a1 = InterviewAnswer(
        session_id=session.id,
        question_id=q1.id,
        answer_text="State hook",
        score=0.85,  # >= 70%, should advance depth next time!
        status="evaluated"
    )
    db.add(a1)
    db.commit()

    # 4. Now, check coordinate selection for "hooks - useState internals"
    # Since average score for "surface" level is 0.85 (>= 70%), it should progress to "applied" depth level!
    # And context_type should be the least-used context type (which is not "conceptual")
    lvl2, ctx2, past2 = select_coordinate_for_subtopic(applicant.id, "hooks - useState internals", db)
    assert lvl2 == "applied"
    assert ctx2 != "conceptual"
    assert "What is useState?" in past2

    # 5. Let's test cooldown behavior.
    # The subtopic was just asked (created_at is utcnow). Average score is 0.85 (Strong).
    # Since 0.85 is Strong, cooldown is 30 days. So it should be in strong_cooldown_pool.
    # If we request a subtopic for React now, the selector should pick other unseen subtopics first!
    selected_subtopics = select_subtopics_for_session(applicant.id, "React", 5, db)
    # The subtopic "hooks - useState internals" should not be the first one, since unseen subtopics have priority!
    assert "hooks - useState internals" not in selected_subtopics[:4]

    # Clean up the test session, question, and answer
    db.delete(a1)
    db.delete(q1)
    db.delete(session)
    db.commit()







