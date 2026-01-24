"""
Interview Service - Orchestrates mock interview sessions, question generation,
answer evaluation, and learning path creation.
"""
import datetime
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from ..db import (
    InterviewSession, InterviewQuestion, InterviewAnswer,
    SkillAssessment, LearningPath, Applicant, LLMParsedRecord
)
from ..resume.llm_gemini import GeminiLLMClient
from ..core.google_search import InterviewContentFetcher
from ..core.credit_service import CreditService
from ..constants import INTERVIEW_CONFIG, PROFICIENCY_MAPPING, INTERVIEW_SCORE_MULTIPLIERS, CREDIT_CONFIG


class InterviewService:
    """
    Service layer for managing interview sessions and assessments.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.gemini_client = GeminiLLMClient()
        self.content_fetcher = InterviewContentFetcher()
        self.credit_service = CreditService(db)
    
    def check_daily_limit(self, applicant_id: int) -> Tuple[bool, int]:
        """
        Check if applicant can start a new session (max 2 per day).
        Only counts COMPLETED or IN_PROGRESS sessions started today.
        
        Returns:
            (can_start: bool, sessions_today: int)
        """
        today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Count completed sessions started today + any in_progress session
        # Do NOT count abandoned sessions
        sessions_today = self.db.query(InterviewSession).filter(
            InterviewSession.applicant_id == applicant_id,
            InterviewSession.started_at >= today_start,
            InterviewSession.status.in_(['completed', 'in_progress'])
        ).count()
        
        can_start = sessions_today < INTERVIEW_CONFIG['MAX_SESSIONS_PER_DAY']
        
        return can_start, sessions_today
    
    def get_applicant_skills(self, applicant_id: int) -> List[str]:
        """Extract skills from applicant's parsed resume."""
        parsed = self.db.query(LLMParsedRecord).filter(
            LLMParsedRecord.applicant_id == applicant_id
        ).first()
        
        if not parsed:
            return []
        
        normalized = getattr(parsed, 'normalized', {})
        if not isinstance(normalized, dict):
            return []
        
        skills = normalized.get('skills', [])
        if isinstance(skills, list):
            return [s.get('name', s) if isinstance(s, dict) else str(s) for s in skills]
        
        return []
    
    def get_previous_score(self, applicant_id: int) -> Optional[float]:
        """Get the most recent interview score for difficulty adjustment."""
        latest_session = self.db.query(InterviewSession).filter(
            InterviewSession.applicant_id == applicant_id,
            InterviewSession.status == 'completed',
            InterviewSession.overall_score.isnot(None)
        ).order_by(desc(InterviewSession.completed_at)).first()
        
        if latest_session:
            return getattr(latest_session, 'overall_score', None)
        
        return None
    
    def create_session(
        self,
        applicant_id: int,
        session_type: str,
        session_mode: str,
        difficulty_level: str,
        focus_skills: Optional[List[str]] = None
    ) -> InterviewSession:
        """
        Create a new interview session (full or micro).
        """
        # Determine credit cost and duration
        if session_mode == 'micro':
            credits_cost = CREDIT_CONFIG['MICRO_SESSION_COST']
            duration = INTERVIEW_CONFIG['MICRO_SESSION_DURATION_SECONDS']
        else:
            credits_cost = CREDIT_CONFIG['FULL_MOCK_INTERVIEW_COST']
            duration = INTERVIEW_CONFIG['SESSION_DURATION_SECONDS']
        
        # Calculate end time
        starts_at = datetime.datetime.utcnow()
        ends_at = starts_at + datetime.timedelta(seconds=duration)
        
        session = InterviewSession(
            applicant_id=applicant_id,
            session_type=session_type,
            session_mode=session_mode,
            difficulty_level=difficulty_level,
            focus_skills=focus_skills,
            credits_used=credits_cost,
            status='in_progress',
            started_at=starts_at,
            ends_at=ends_at
        )
        
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        
        return session
    
    def generate_questions(
        self,
        session: InterviewSession,
        mcq_count: int = 10,
        short_answer_count: int = 0
    ) -> List[InterviewQuestion]:
        """
        Generate MCQ questions for the session using Gemini API only.
        No fallbacks - if Gemini fails, raise an error.
        """
        applicant_id = getattr(session, 'applicant_id', 0)
        applicant_skills = self.get_applicant_skills(applicant_id)
        previous_score = self.get_previous_score(applicant_id)
        
        # Get focus areas
        focus_areas = getattr(session, 'focus_skills', None)
        
        # Generate questions with Gemini API only
        print(f"🎯 Generating {mcq_count} MCQ questions via Gemini API...")
        result = self.gemini_client.generate_interview_questions(
            applicant_skills=applicant_skills or ["Programming", "Data Structures", "Algorithms"],
            focus_areas=focus_areas,
            difficulty=getattr(session, 'difficulty_level', 'medium'),
            session_type=getattr(session, 'session_type', 'technical'),
            previous_score=previous_score,
            mcq_count=mcq_count,
            short_answer_count=short_answer_count
        )
        
        # Check for errors
        if result.get('error'):
            raise ValueError(f"Gemini API error: {result['error']}")
        
        questions_data = result.get('questions', [])
        
        if not questions_data:
            raise ValueError("Gemini API returned no questions. Please try again.")
        
        # Validate MCQ questions have proper structure
        valid_questions = []
        for q in questions_data:
            if q.get('question_type') == 'mcq':
                # Ensure MCQ has options and correct_answer
                if q.get('options') and len(q.get('options', [])) >= 2 and q.get('correct_answer'):
                    valid_questions.append(q)
                else:
                    print(f"⚠️ Skipping invalid MCQ: missing options or correct_answer")
            else:
                # Include short answer questions as-is
                valid_questions.append(q)
        
        if not valid_questions:
            raise ValueError("No valid MCQ questions generated. Please try again.")
        
        print(f"✅ Generated {len(valid_questions)} valid questions")
        
        # Create InterviewQuestion objects
        questions = []
        for idx, q_data in enumerate(valid_questions):
            question = InterviewQuestion(
                session_id=session.id,
                question_order=idx + 1,
                question_type=q_data.get('question_type', 'mcq'),
                question_text=q_data.get('question_text', ''),
                difficulty=q_data.get('difficulty', session.difficulty_level),
                category=q_data.get('category', 'General'),
                options=q_data.get('options'),
                correct_answer=q_data.get('correct_answer'),
                expected_answer_points=q_data.get('expected_answer_points'),
                max_score=q_data.get('max_score', 10.0),
                skills_tested=q_data.get('skills_tested'),
                generated_by='gemini'
            )
            
            self.db.add(question)
            questions.append(question)
        
        self.db.commit()
        
        return questions
    
    def submit_answer(
        self,
        session_id: int,
        question_id: int,
        answer_text: Optional[str],
        code_submitted: Optional[str],
        selected_option: Optional[str],
        time_taken_seconds: Optional[int]
    ) -> InterviewAnswer:
        """
        Submit and evaluate an answer.
        """
        # Get question
        question = self.db.query(InterviewQuestion).filter(
            InterviewQuestion.id == question_id,
            InterviewQuestion.session_id == session_id
        ).first()
        
        if not question:
            raise ValueError("Question not found")
        
        # Check if answer already exists
        existing = self.db.query(InterviewAnswer).filter(
            InterviewAnswer.session_id == session_id,
            InterviewAnswer.question_id == question_id
        ).first()
        
        if existing:
            raise ValueError("Answer already submitted for this question")
        
        # Determine the answer content
        candidate_answer = selected_option or answer_text or code_submitted or ""
        
        # Evaluate the answer using Gemini
        evaluation = self.gemini_client.evaluate_answer(
            question_text=getattr(question, 'question_text', ''),
            question_type=getattr(question, 'question_type', 'short_answer'),
            candidate_answer=candidate_answer,
            correct_answer=getattr(question, 'correct_answer', None),
            expected_points=getattr(question, 'expected_answer_points', None),
            max_score=getattr(question, 'max_score', 10.0)
        )
        
        # Create answer record
        answer = InterviewAnswer(
            session_id=session_id,
            question_id=question_id,
            answer_text=answer_text,
            code_submitted=code_submitted,
            selected_option=selected_option,
            time_taken_seconds=time_taken_seconds,
            is_correct=evaluation.get('is_correct'),
            score=evaluation.get('score', 0.0),
            ai_evaluation=evaluation,
            strengths=evaluation.get('strengths'),
            weaknesses=evaluation.get('weaknesses'),
            improvement_suggestions=evaluation.get('improvement_suggestions')
        )
        
        self.db.add(answer)
        self.db.commit()
        self.db.refresh(answer)
        
        return answer
    
    def calculate_session_scores(self, session_id: int) -> Dict:
        """
        Calculate overall and category-wise scores for a session.
        """
        answers = self.db.query(InterviewAnswer).filter(
            InterviewAnswer.session_id == session_id
        ).all()
        
        if not answers:
            return {
                "overall_score": 0.0,
                "technical_score": 0.0,
                "communication_score": 0.0,
                "problem_solving_score": 0.0,
                "skill_scores": {}
            }
        
        total_score = 0.0
        total_max_score = 0.0
        skill_scores = {}
        
        for answer in answers:
            question = self.db.query(InterviewQuestion).filter(
                InterviewQuestion.id == answer.question_id
            ).first()
            
            if not question:
                continue
            
            score = getattr(answer, 'score', 0.0) or 0.0
            max_score = getattr(question, 'max_score', 10.0) or 10.0
            
            total_score += score
            total_max_score += max_score
            
            # Track skill scores
            skills_tested = getattr(question, 'skills_tested', None) or []
            for skill in skills_tested:
                if skill not in skill_scores:
                    skill_scores[skill] = {"total": 0.0, "max": 0.0}
                
                skill_scores[skill]["total"] += score
                skill_scores[skill]["max"] += max_score
        
        # Calculate percentages
        overall_score = float((total_score / total_max_score * 100) if total_max_score > 0 else 0.0)
        
        # Simplify skill scores to percentages
        skill_percentages = {}
        for skill, data in skill_scores.items():
            if data["max"] > 0:
                skill_percentages[skill] = float((data["total"] / data["max"]) * 100)
        
        return {
            "overall_score": round(float(overall_score), 2),
            "technical_score": round(float(overall_score), 2),  # Simplified
            "communication_score": round(float(overall_score) * 0.8, 2),  # Approximation
            "problem_solving_score": round(float(overall_score) * 0.9, 2),  # Approximation
            "skill_scores": skill_percentages
        }
    
    def complete_session(
        self,
        session_id: int,
        generate_learning_path: bool = True
    ) -> Tuple[InterviewSession, Optional[LearningPath]]:
        """
        Finalize session, calculate scores, and optionally generate learning path.
        """
        session = self.db.query(InterviewSession).filter(
            InterviewSession.id == session_id
        ).first()
        
        if not session:
            raise ValueError("Session not found")
        
        if getattr(session, 'status', '') == 'completed':
            raise ValueError("Session already completed")
        
        # Calculate scores
        scores = self.calculate_session_scores(session_id)
        
        # Update session
        session.status = 'completed'  # type: ignore
        session.completed_at = datetime.datetime.utcnow()  # type: ignore
        completed_at = getattr(session, 'completed_at', datetime.datetime.utcnow())
        started_at = getattr(session, 'started_at', datetime.datetime.utcnow())
        session.duration_seconds = int((completed_at - started_at).total_seconds())  # type: ignore
        session.overall_score = scores['overall_score']  # type: ignore
        session.technical_score = scores['technical_score']  # type: ignore
        session.communication_score = scores['communication_score']  # type: ignore
        session.problem_solving_score = scores['problem_solving_score']  # type: ignore
        session.skill_scores = scores['skill_scores']  # type: ignore
        
        # Generate skill gap analysis
        session_results = {
            "overall_score": scores['overall_score'],
            "skill_scores": scores['skill_scores']
        }
        
        applicant_id = getattr(session, 'applicant_id', 0)
        applicant_skills = self.get_applicant_skills(applicant_id)
        
        analysis = self.gemini_client.analyze_skill_gaps(
            session_results=session_results,
            applicant_skills=applicant_skills
        )
        
        session.skill_gap_analysis = analysis.get('skill_gaps', {})  # type: ignore
        session.ai_feedback = {  # type: ignore
            "overall_assessment": analysis.get('overall_assessment', ''),
            "priority_skills": analysis.get('priority_skills', [])
        }
        session.recommended_resources = analysis.get('recommended_courses', [])  # type: ignore
        
        self.db.commit()
        self.db.refresh(session)
        
        # Generate learning path if score < 60 or explicitly requested
        learning_path = None
        if generate_learning_path and (scores['overall_score'] < 60 or True):
            learning_path = self.create_learning_path(session, analysis)
        
        return session, learning_path
    
    def create_learning_path(
        self,
        session: InterviewSession,
        analysis: Dict
    ) -> LearningPath:
        """
        Create a personalized learning path based on skill gaps.
        """
        skill_gaps = analysis.get('skill_gaps', {})
        
        # Fetch learning resources from Google Search (with Gemini fallback)
        resources = self.content_fetcher.fetch_learning_resources(
            skill_gaps=skill_gaps,
            count_per_skill=3
        )
        
        # Fetch practice problems
        practice_problems = []
        weak_skills = [skill for skill, level in skill_gaps.items() if level == "weak"]
        
        for skill in weak_skills[:2]:
            problems = self.content_fetcher.fetch_practice_problems(
                skill=skill,
                difficulty="easy",  # Start with easy for weak skills
                count=5
            )
            practice_problems.extend(problems)
        
        # Create learning path
        learning_path = LearningPath(
            applicant_id=session.applicant_id,
            generated_from='interview',
            source_session_id=session.id,
            skill_gaps=skill_gaps,
            recommended_courses=resources if resources else analysis.get('recommended_courses', []),
            recommended_projects=analysis.get('recommended_projects', []),
            practice_problems=practice_problems if practice_problems else analysis.get('practice_problems', []),
            priority_skills=analysis.get('priority_skills', []),
            status='active'
        )
        
        self.db.add(learning_path)
        self.db.commit()
        self.db.refresh(learning_path)
        
        return learning_path

    # -----------------------------------------------------
    # Job-based learning path generation
    # -----------------------------------------------------
    def create_learning_path_from_job(
        self,
        applicant_id: int,
        job
    ) -> LearningPath:
        """Create a learning path from a job's requirements vs applicant skills."""

        applicant_skills = self.get_applicant_skills(applicant_id)

        # Normalize required skills from the job posting
        raw_required = getattr(job, 'required_skills', []) or []
        required_skills = []
        for item in raw_required:
            if isinstance(item, dict):
                name = item.get('name') or item.get('skill')
                if name:
                    required_skills.append(str(name))
            else:
                required_skills.append(str(item))

        # Build skill gap map (strong if present in resume, weak otherwise)
        skill_gaps: Dict[str, str] = {}
        applicant_lower = {s.lower(): s for s in applicant_skills}
        for skill in required_skills:
            if skill.lower() in applicant_lower:
                skill_gaps[skill] = "strong"
            else:
                skill_gaps[skill] = "weak"

        priority_skills = [s for s, lvl in skill_gaps.items() if lvl == "weak"][:5] or list(skill_gaps.keys())[:5]

        # Fetch resources and practice problems with job context to get tailored videos/resources
        print(f"[LearningPath] Fetching resources for skills: {list(skill_gaps.keys())}")
        resources = self.content_fetcher.fetch_learning_resources(
            skill_gaps=skill_gaps,
            count_per_skill=3,
            job_title=getattr(job, 'title', None),
            job_description=getattr(job, 'description', None)
        )
        print(f"[LearningPath] Fetched {len(resources) if resources else 0} resources")

        topics_outline = self.content_fetcher.generate_topic_outline(
            skill_gaps=skill_gaps,
            job_title=getattr(job, 'title', None),
            job_description=getattr(job, 'description', None)
        )

        practice_problems = []
        for skill in priority_skills[:2]:
            problems = self.content_fetcher.fetch_practice_problems(
                skill=skill,
                difficulty="easy",
                count=5
            )
            practice_problems.extend(problems)

        print(f"[LearningPath] Creating path with {len(resources)} courses, {len(practice_problems)} problems")
        
        learning_path = LearningPath(
            applicant_id=applicant_id,
            job_id=getattr(job, 'id', None),
            generated_from='job',  # job-based generation without interview
            source_session_id=None,
            skill_gaps=skill_gaps,
            recommended_courses=resources if resources else [],
            recommended_projects=[],
            practice_problems=practice_problems if practice_problems else [],
            topics_outline=topics_outline if topics_outline else [],
            priority_skills=priority_skills,
            status='active'
        )

        self.db.add(learning_path)
        self.db.commit()
        self.db.refresh(learning_path)
        
        print(f"[LearningPath] Path created successfully with ID: {learning_path.id}")

        return learning_path
    
    def get_session_history(self, applicant_id: int) -> Dict:
        """
        Get interview history for an applicant.
        """
        sessions = self.db.query(InterviewSession).filter(
            InterviewSession.applicant_id == applicant_id
        ).order_by(desc(InterviewSession.started_at)).all()
        
        # Calculate statistics
        total_sessions = len(sessions)
        completed_sessions = [s for s in sessions if getattr(s, 'status', '') == 'completed']
        
        latest_score = None
        average_score = None
        
        if completed_sessions:
            scores = [getattr(s, 'overall_score', 0) for s in completed_sessions if getattr(s, 'overall_score', None) is not None]
            if scores:
                latest_score = scores[0]
                average_score = sum(scores) / len(scores)
        
        # Check sessions today - only count completed or in_progress sessions
        today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        sessions_today = sum(1 for s in sessions 
                            if getattr(s, 'started_at', datetime.datetime.utcnow()) >= today_start
                            and getattr(s, 'status', '') in ['completed', 'in_progress'])
        
        can_start_new = sessions_today < INTERVIEW_CONFIG['MAX_SESSIONS_PER_DAY']
        
        # Check if needs retake (latest session > 6 months old)
        needs_retake = False
        if completed_sessions:
            latest_completed = completed_sessions[0]
            completed_at = getattr(latest_completed, 'completed_at', datetime.datetime.utcnow())
            months_old = (datetime.datetime.utcnow() - completed_at).days / 30
            needs_retake = months_old >= INTERVIEW_CONFIG['SCORE_FRESHNESS_MONTHS']
        
        return {
            "sessions": sessions,
            "total_sessions": total_sessions,
            "latest_score": latest_score,
            "average_score": average_score,
            "sessions_today": sessions_today,
            "can_start_new": can_start_new,
            "needs_retake": needs_retake
        }
    
    def create_skill_assessment(
        self,
        applicant_id: int,
        skill_name: str,
        assessment_type: str,
        difficulty_level: str
    ) -> SkillAssessment:
        """
        Create and execute a skill assessment (MCQ quiz).
        """
        # Generate MCQ questions for the skill
        result = self.gemini_client.generate_interview_questions(
            applicant_skills=[skill_name],
            focus_areas=[skill_name],
            difficulty=difficulty_level,
            session_type='technical',
            mcq_count=10,
            short_answer_count=0
        )
        
        questions_data = result.get('questions', [])
        
        # Simulate assessment (in real implementation, questions would be shown to user)
        # For now, store questions in questions_data field
        
        assessment = SkillAssessment(
            applicant_id=applicant_id,
            skill_name=skill_name,
            assessment_type=assessment_type,
            total_questions=len(questions_data),
            correct_answers=0,  # Will be updated when user submits
            score_percentage=0.0,
            time_limit_seconds=INTERVIEW_CONFIG['SESSION_DURATION_SECONDS'],
            questions_data=questions_data
        )
        
        self.db.add(assessment)
        self.db.commit()
        self.db.refresh(assessment)
        
        return assessment
    
    def get_proficiency_level(self, score_percentage: float) -> str:
        """Map score percentage to proficiency level."""
        for (min_score, max_score), level in PROFICIENCY_MAPPING.items():
            if min_score <= score_percentage < max_score:
                return level
        return 'expert'  # >= 80
