"""
Unit tests for the reconstructed Learning Path module.
Covers duration parsing, video filtering heuristics, daily limits, and dynamic credit policies.
"""
import sys
import os
import datetime
import uuid
import pytest
from unittest.mock import patch, MagicMock

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from resume_pipeline.db import SessionLocal, User, Applicant, InterviewSession, InterviewQuestion, InterviewAnswer, LearningPath, CreditAccount, CreditUsageStats
from resume_pipeline.constants import CREDIT_CONFIG
from resume_pipeline.interview.learning_path_generator import parse_iso8601_duration, filter_and_rank_videos, generate_learning_path

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
    """Creates a student user and applicant profile with credit balances for testing."""
    test_uid = f"lp_test_user_{uuid.uuid4().hex[:8]}"
    
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
        display_name="Learning Path Test Applicant",
        location_city="Pune"
    )
    db.add(applicant)
    db.commit()
    db.refresh(applicant)

    # Create credit account with 50 credits
    credit_account = CreditAccount(
        applicant_id=applicant.id,
        current_credits=50,
        total_earned=50,
        next_refill_at=datetime.datetime.utcnow() + datetime.timedelta(days=7),
        weekly_credit_limit=60
    )
    db.add(credit_account)
    db.commit()
    db.refresh(credit_account)
    
    stats = CreditUsageStats(account_id=credit_account.id)
    db.add(stats)
    db.commit()

    yield user, applicant

    # Cleanup
    db.query(LearningPath).filter_by(applicant_id=applicant.id).delete()
    db.query(CreditUsageStats).filter_by(account_id=credit_account.id).delete()
    db.query(CreditAccount).filter_by(applicant_id=applicant.id).delete()
    
    sessions = db.query(InterviewSession).filter_by(applicant_id=applicant.id).all()
    for s in sessions:
        db.query(InterviewAnswer).filter_by(session_id=s.id).delete()
        db.query(InterviewQuestion).filter_by(session_id=s.id).delete()
        db.delete(s)
        
    db.delete(applicant)
    db.delete(user)
    db.commit()


def test_parse_iso8601_duration():
    """Verify parse_iso8601_duration correctly parses YouTube duration strings into seconds."""
    assert parse_iso8601_duration("PT5M") == 300
    assert parse_iso8601_duration("PT15M33S") == 933
    assert parse_iso8601_duration("PT1H2M10S") == 3730
    assert parse_iso8601_duration("") == 0
    assert parse_iso8601_duration("Invalid") == 0


def test_filter_and_rank_videos():
    """Verify video quality score heuristics (views, duration, and trusted channel checks)."""
    videos = [
        {
            "video_id": "vid1",
            "title": "React For Beginners",
            "channel": "freeCodeCamp.org",
            "published_at": "2024-01-01T00:00:00Z"
        },
        {
            "video_id": "vid2",
            "title": "React Advanced Hacks",
            "channel": "SomeRandomGuy",
            "published_at": "2024-01-01T00:00:00Z"
        },
        {
            "video_id": "vid3",
            "title": "React in 2 Seconds",
            "channel": "Fireship",
            "published_at": "2024-01-01T00:00:00Z"
        }
    ]
    
    stats_map = {
        "vid1": {
            "view_count": 200000,
            "like_count": 15000,
            "duration_iso": "PT45M"  # 2700s (Quality length)
        },
        "vid2": {
            "view_count": 150000,
            "like_count": 8000,
            "duration_iso": "PT45M"
        },
        "vid3": {
            "view_count": 1000000,
            "like_count": 50000,
            "duration_iso": "PT2M"  # 120s (Disqualified for duration < 10 mins)
        }
    }
    
    trusted_channels = {"freeCodeCamp.org", "CS50", "Fireship"}
    
    ranked = filter_and_rank_videos(videos, stats_map, trusted_channels)
    
    # Assertions
    # vid3 is disqualified because duration is < 600 seconds (10 mins)
    video_ids = [v["video_id"] for v in ranked]
    assert "vid3" not in video_ids
    
    # vid1 should rank higher than vid2 because it belongs to a trusted channel (freeCodeCamp.org)
    assert ranked[0]["video_id"] == "vid1"
    assert ranked[0]["score"] > ranked[1]["score"]


@patch("resume_pipeline.interview.learning_path_generator.search_youtube")
@patch("resume_pipeline.interview.learning_path_generator.fetch_video_stats")
@patch("resume_pipeline.interview.learning_path_generator.llm_router.generate_chat_completion")
def test_generate_learning_path_orchestrator(mock_generate_chat_completion, mock_stats, mock_search, db, test_user_and_applicant):
    """Test full learning path generation orchestration including credit spending and daily limits."""
    user, applicant = test_user_and_applicant
    
    # 1. Setup mock interview session
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
    
    q1 = InterviewQuestion(
        session_id=session.id,
        order_index=0,
        question_text="Tell me about indexing in DBMS.",
        skill_tag="DBMS",
        difficulty_level="medium"
    )
    db.add(q1)
    db.commit()
    db.refresh(q1)
    
    ans1 = InterviewAnswer(
        session_id=session.id,
        question_id=q1.id,
        answer_text="Indexing is used to retrieve data faster.",
        score=0.40,
        feedback="Fair, but lacks B-Tree details.",
        missing_concepts=["B-Tree Indexing", "Clustered Indexes"],
        status="evaluated"
    )
    db.add(ans1)
    db.commit()

    # 2. Setup API mocks
    mock_search.return_value = [
        {
            "video_id": "dbms_vid1",
            "title": "DBMS Indexing Full Tutorial",
            "channel": "freeCodeCamp.org",
            "thumbnail": "http://img.com",
            "published_at": "2024-01-01T00:00:00Z"
        }
    ]
    
    mock_stats.return_value = {
        "dbms_vid1": {
            "view_count": 80000,
            "like_count": 5000,
            "duration_iso": "PT25M"
        }
    }
    
    # Mock query generation call and pathway generation call
    mock_res_queries = {"content": '[{"skill": "DBMS", "query": "dbms indexing tutorial", "priority": "high"}]'}
    mock_res_pathway = {"content": """{
        "skill_gaps": {"DBMS": "weak"},
        "roadmap_stages": [{
            "week": "Week 1",
            "skill_focus": "DBMS",
            "action": "Learn database indexing",
            "why_recommended": "DBMS is weak",
            "what_it_achieves": "DBMS knowledge",
            "video": {
                "title": "DBMS Indexing Full Tutorial",
                "url": "https://youtube.com/watch?v=dbms_vid1",
                "video_id": "dbms_vid1",
                "channel_title": "freeCodeCamp.org",
                "thumbnail_url": "http://img.com",
                "duration_minutes": 25
            }
        }],
        "recommended_projects": [],
        "practice_problems": [],
        "priority_skills": ["DBMS"]
    }"""}
    
    mock_generate_chat_completion.side_effect = [mock_res_queries, mock_res_pathway]
    
    # 3. Check starting credits
    acct = db.query(CreditAccount).filter_by(applicant_id=applicant.id).first()
    start_credits = acct.current_credits
    assert start_credits >= 10
    
    # 4. Generate first learning path
    path = generate_learning_path(session.id, db)
    
    assert path is not None
    assert path.id is not None
    assert path.skill_gaps["DBMS"] == "weak"
    assert path.recommended_courses[0]["video_id"] == "dbms_vid1"
    
    # Verify credits deducted (cost = 10)
    db.refresh(acct)
    assert acct.current_credits == start_credits - 10
    
    # 5. Test idempotency / caching: running a second time on the same session should not deduct credits
    path2 = generate_learning_path(session.id, db)
    assert path2.id == path.id
    db.refresh(acct)
    assert acct.current_credits == start_credits - 10  # still -10
    
    # 6. Test daily limit: create more completed sessions to hit the cap of 2 per day
    session2 = InterviewSession(applicant_id=applicant.id, interview_type="technical", difficulty="medium", total_questions=1, status="completed")
    session3 = InterviewSession(applicant_id=applicant.id, interview_type="technical", difficulty="medium", total_questions=1, status="completed")
    db.add(session2)
    db.add(session3)
    db.commit()
    
    # Let's generate for session2 (should succeed, taking daily count to 2)
    path3 = generate_learning_path(session2.id, db)
    assert path3 is not None
    
    # Let's generate for session3 (should fail due to cap = 2 daily limit)
    with pytest.raises(ValueError) as exc_info:
        generate_learning_path(session3.id, db)
    assert "daily limit" in str(exc_info.value).lower()
