"""
Interview System v2 — Question Generator
Calls Groq once at session start to generate all questions + adaptive reserve pool.
Falls back to the hardcoded question bank on any Groq error.
"""
import json
import logging
import datetime
from typing import List, Optional
from sqlalchemy.orm import Session as DBSession

from ..config import settings
from ..core.llm_router import llm_router
from ..constants import INTERVIEW_CONFIG_V2
from .prompts import GROQ_MODEL, QUESTION_GENERATION_PROMPT, PERSONA_PROMPTS
from .fallback_questions import get_fallback_questions
from .subtopic_taxonomy_builder import SubtopicTaxonomyBuilder

logger = logging.getLogger(__name__)


def build_session_context(parsed_record: dict) -> dict:
    """
    Extract interview-relevant fields from the LLMParsedRecord.normalized JSON.
    Returns a safe dict with defaults for all fields.
    """
    normalized = parsed_record.get("normalized", parsed_record) if parsed_record else {}
    return {
        "skills": normalized.get("skills", []),
        "experience_years": normalized.get("experience_years", 0),
        "target_role": normalized.get("target_role") or normalized.get("desired_role") or "Software Engineer",
        "education": normalized.get("education", {}),
        "projects": [p.get("title", "") for p in normalized.get("projects", []) if isinstance(p, dict)][:5],
        "work_experience": [
            w.get("company", "") + " — " + w.get("title", "")
            for w in normalized.get("work_experience", []) if isinstance(w, dict)
        ][:4],
    }


def select_subtopics_for_session(
    applicant_id: Optional[int],
    skill: str,
    num_questions: int,
    db: DBSession,
    current_time: Optional[datetime.datetime] = None
) -> List[str]:
    """
    Retrieves subtopics from SubtopicTaxonomyBuilder and applies
    the blended priority selector + cooldown checks.
    """
    if current_time is None:
        current_time = datetime.datetime.utcnow()

    builder = SubtopicTaxonomyBuilder(db)
    subtopics = builder.get_subtopics(skill)
    if not subtopics:
        subtopics = [f"{skill} - fundamentals", f"{skill} - best practices", f"{skill} - debugging"]

    if not applicant_id:
        selected = []
        for i in range(num_questions):
            selected.append(subtopics[i % len(subtopics)])
        return selected

    from ..db import InterviewQuestion, InterviewAnswer, InterviewSession

    # Query all past questions/answers for this applicant
    history_records = (
        db.query(
            InterviewQuestion.skill_tag,
            InterviewAnswer.score,
            InterviewSession.created_at
        )
        .join(InterviewSession, InterviewQuestion.session_id == InterviewSession.id)
        .outerjoin(InterviewAnswer, InterviewQuestion.id == InterviewAnswer.question_id)
        .filter(InterviewSession.applicant_id == applicant_id)
        .all()
    )

    # Map from normalized subtopic to original subtopic name
    subtopic_map = {s.lower().strip(): s for s in subtopics}
    
    # Group history by normalized subtopic name
    subtopic_history = {s.lower().strip(): [] for s in subtopics}
    for row in history_records:
        tag_norm = row.skill_tag.lower().strip() if row.skill_tag else ""
        if tag_norm in subtopic_history:
            subtopic_history[tag_norm].append({
                "score": row.score,
                "created_at": row.created_at
            })

    unseen_pool = []
    weak_ready_pool = []
    mod_ready_pool = []
    strong_ready_pool = []
    weak_cooldown_pool = []
    mod_cooldown_pool = []
    strong_cooldown_pool = []

    for sub_norm, sub_orig in subtopic_map.items():
        hist = subtopic_history[sub_norm]
        if not hist:
            unseen_pool.append(sub_orig)
            continue
        
        scores = [h["score"] for h in hist if h["score"] is not None]
        avg_score = sum(scores) / len(scores) if scores else 0.0
        
        last_asked = max(h["created_at"] for h in hist)
        days_since = (current_time - last_asked).total_seconds() / 86400.0
        
        # Categorize with cooldown limits: Weak (7d), Moderate (14d), Strong (30d)
        if avg_score < 0.60:
            if days_since >= 7.0:
                weak_ready_pool.append((sub_orig, days_since))
            else:
                weak_cooldown_pool.append((sub_orig, days_since))
        elif avg_score < 0.80:
            if days_since >= 14.0:
                mod_ready_pool.append((sub_orig, days_since))
            else:
                mod_cooldown_pool.append((sub_orig, days_since))
        else:
            if days_since >= 30.0:
                strong_ready_pool.append((sub_orig, days_since))
            else:
                strong_cooldown_pool.append((sub_orig, days_since))

    # Sort pools descending by days_since (least recently asked first)
    def sort_by_days(items):
        return [item[0] for item in sorted(items, key=lambda x: x[1], reverse=True)]

    weak_ready = sort_by_days(weak_ready_pool)
    mod_ready = sort_by_days(mod_ready_pool)
    strong_ready = sort_by_days(strong_ready_pool)
    
    weak_cooldown = sort_by_days(weak_cooldown_pool)
    mod_cooldown = sort_by_days(mod_cooldown_pool)
    strong_cooldown = sort_by_days(strong_cooldown_pool)

    # Blended priority order: Unseen -> Weak (ready) -> Moderate (ready) -> Strong (ready) -> Cooldown pools
    candidate_pool = (
        unseen_pool +
        weak_ready +
        mod_ready +
        strong_ready +
        weak_cooldown +
        mod_cooldown +
        strong_cooldown
    )

    if not candidate_pool:
        candidate_pool = subtopics

    selected = []
    for i in range(num_questions):
        selected.append(candidate_pool[i % len(candidate_pool)])
    return selected


def select_coordinate_for_subtopic(
    applicant_id: Optional[int],
    sub_topic: str,
    db: DBSession,
    banned_question_texts: Optional[List[str]] = None
) -> tuple[str, str, List[str]]:
    """
    Determines target depth_level and context_type based on scoring history,
    and returns all past question texts for this subtopic.
    
    Returns: (depth_level, context_type, past_question_texts)
    """
    levels = ["surface", "applied", "system", "edge_case"]
    context_types = ["conceptual", "scenario", "debug", "tradeoff", "code_review", "incident"]
    
    past_questions = []
    if banned_question_texts:
        for bq in banned_question_texts:
            past_questions.append(bq.strip())

    if not applicant_id:
        return "surface", "conceptual", list(set(past_questions))

    from ..db import InterviewQuestion, InterviewAnswer, InterviewSession

    history_records = (
        db.query(
            InterviewQuestion.skill_tag,
            InterviewQuestion.difficulty_level,
            InterviewQuestion.question_type,
            InterviewQuestion.question_text,
            InterviewAnswer.score
        )
        .join(InterviewSession, InterviewQuestion.session_id == InterviewSession.id)
        .outerjoin(InterviewAnswer, InterviewQuestion.id == InterviewAnswer.question_id)
        .filter(InterviewSession.applicant_id == applicant_id)
        .all()
    )

    level_scores = {lvl: [] for lvl in levels}
    context_counts = {ctx: 0 for ctx in context_types}

    target_sub = sub_topic.lower().strip()
    for row in history_records:
        tag = row.skill_tag.lower().strip() if row.skill_tag else ""
        if tag == target_sub:
            if row.question_text:
                past_questions.append(row.question_text.strip())
            
            lvl = row.difficulty_level.lower().strip() if row.difficulty_level else ""
            if lvl in level_scores and row.score is not None:
                level_scores[lvl].append(row.score)
                
            ctx = row.question_type.lower().strip() if row.question_type else ""
            if ctx in context_counts:
                context_counts[ctx] += 1

    # 1. Determine depth_level: advance level only if average score >= 70%
    chosen_level = None
    level_avg_scores = {}
    for lvl in levels:
        scores = level_scores[lvl]
        if not scores:
            chosen_level = lvl
            break
        avg = sum(scores) / len(scores)
        level_avg_scores[lvl] = avg
        if avg < 0.70:
            chosen_level = lvl
            break

    if not chosen_level:
        if level_avg_scores:
            chosen_level = min(level_avg_scores, key=level_avg_scores.get)
        else:
            chosen_level = "edge_case"

    # 2. Determine context_type (least frequently used)
    chosen_context = min(context_types, key=lambda c: context_counts[c])

    return chosen_level, chosen_context, list(set(past_questions))


def generate_questions(
    context: dict,
    num_questions: int,
    interview_type: str,
    difficulty: str,
    topic_focus: Optional[str] = None,
    past_weak_skills: Optional[List[str]] = None,
    past_missing_concepts: Optional[List[str]] = None,
    past_question_texts: Optional[List[str]] = None,
    interviewer_persona: Optional[str] = "Friendly Senior Engineer",
    db: Optional[DBSession] = None,
    applicant_id: Optional[int] = None,
) -> List[dict]:
    """
    Generate all questions for a session in a single Groq API call.
    Includes RESERVE_POOL_SIZE extra questions for adaptive difficulty.

    Returns a list of dicts:
    [{question_text, skill_tag, difficulty, expected_keywords, question_type, is_reserve}]
    """
    reserve_count = INTERVIEW_CONFIG_V2["RESERVE_POOL_SIZE"]
    total_count = num_questions + reserve_count

    # Resolve DB session
    standalone_session = None
    if db is None:
        from ..db import SessionLocal
        standalone_session = SessionLocal()
        active_db = standalone_session
    else:
        active_db = db

    try:
        # Initialize subtopic taxonomy builder
        builder = SubtopicTaxonomyBuilder(active_db)

        # 1. Determine skill list from candidate's parsed skills
        base_skills = []
        for s in context.get("skills", []):
            if isinstance(s, dict):
                s_name = s.get("name")
            else:
                s_name = str(s)
            if s_name:
                base_skills.append(s_name.strip())

        if not base_skills:
            base_skills = ["General Programming"]

        # 2. Build skill distribution dynamically
        distribution = {}
        remaining = total_count

        # Priority A: Retest past weak skills (up to 40% of questions)
        weak_limit = max(1, int(total_count * 0.4))
        allocated_weak = 0
        if past_weak_skills:
            for ws in past_weak_skills:
                if remaining <= 0 or allocated_weak >= weak_limit:
                    break
                match = next((s for s in base_skills if s.lower() == ws.lower()), None)
                if match:
                    distribution[match] = distribution.get(match, 0) + 1
                    remaining -= 1
                    allocated_weak += 1

        # Priority B: Topic Focus if specified (up to 50% of questions)
        if topic_focus and remaining > 0:
            match = next((s for s in base_skills if s.lower() == topic_focus.lower()), None) or topic_focus
            topic_limit = max(1, int(total_count * 0.5))
            allocated_topic = 0
            while remaining > 0 and allocated_topic < topic_limit:
                distribution[match] = distribution.get(match, 0) + 1
                remaining -= 1
                allocated_topic += 1

        # Priority C: Round-robin distribute remaining questions among resume skills
        index = 0
        while remaining > 0:
            skill = base_skills[index % len(base_skills)]
            distribution[skill] = distribution.get(skill, 0) + 1
            remaining -= 1
            index += 1

        # 3. For each skill in distribution, select subtopics and determine coordinates
        subtopics_by_skill = {}
        for skill, count in distribution.items():
            subtopics_by_skill[skill] = select_subtopics_for_session(applicant_id, skill, count, active_db)

        # Interleave the subtopics from different skills to form the final list of coordinates
        chosen_coordinates = []
        skill_keys = list(subtopics_by_skill.keys())
        indices = {s: 0 for s in skill_keys}

        while len(chosen_coordinates) < total_count:
            has_more = False
            for skill in skill_keys:
                if indices[skill] < len(subtopics_by_skill[skill]):
                    sub = subtopics_by_skill[skill][indices[skill]]
                    indices[skill] += 1
                    has_more = True
                    
                    # Get coordinate details
                    depth_level, context_type, past_qs = select_coordinate_for_subtopic(
                        applicant_id, sub, active_db, banned_question_texts=past_question_texts
                    )
                    
                    chosen_coordinates.append({
                        "skill_tag": skill,
                        "sub_topic": sub,
                        "depth_level": depth_level,
                        "context_type": context_type,
                        "past_questions": past_qs
                    })
            if not has_more:
                break

        # 4. Format approved target coordinates
        coordinate_parts = []
        for idx, coord in enumerate(chosen_coordinates[:total_count]):
            is_reserve_label = " (RESERVE POOL)" if idx >= num_questions else ""
            coordinate_parts.append(f"Coordinate #{idx + 1}{is_reserve_label}:")
            coordinate_parts.append(f"  - skill_tag: {coord['skill_tag']}")
            coordinate_parts.append(f"  - sub_topic: {coord['sub_topic']}")
            coordinate_parts.append(f"  - depth_level: {coord['depth_level']}")
            coordinate_parts.append(f"  - context_type: {coord['context_type']}")
            
            if coord['past_questions']:
                coordinate_parts.append("  - past_questions (DO NOT repeat or generate similar questions to these):")
                for bq in coord['past_questions']:
                    coordinate_parts.append(f"    * {bq}")
            else:
                coordinate_parts.append("  - past_questions: None")
            coordinate_parts.append("")  # empty line separator
            
        coordinate_targets_str = "\n".join(coordinate_parts)

        # 5. Fetch persona instructions
        persona_info = PERSONA_PROMPTS.get(interviewer_persona or "Friendly Senior Engineer", PERSONA_PROMPTS["Friendly Senior Engineer"])
        persona_instruction = persona_info["generation_instruction"]

        # 6. Format the prompt
        prompt = QUESTION_GENERATION_PROMPT.format(
            total_count=total_count,
            num_questions=num_questions,
            reserve_count=reserve_count,
            coordinate_targets=coordinate_targets_str,
        )

        res = llm_router.generate_chat_completion(
            messages=[
                {"role": "system", "content": persona_instruction},
                {"role": "user", "content": prompt}
            ],
            provider="groq",
            model_name=GROQ_MODEL,
            temperature=0.4,  # lower temperature for stricter adherence
            max_tokens=4096,
            response_format={"type": "json_object"}
        )

        raw = res["content"].strip()
        questions = json.loads(raw)

        if isinstance(questions, dict) and "questions" in questions:
            questions = questions["questions"]

        if not isinstance(questions, list) or len(questions) == 0:
            raise ValueError(f"Groq returned unexpected format: {type(questions)}")

        # 7. Validate and parse the output, storing sub_topic in skill_tag
        validated = []
        for i, q in enumerate(questions):
            # Align with planned coordinates if available
            planned_coord = chosen_coordinates[i] if i < len(chosen_coordinates) else None
            
            sub_topic = q.get("sub_topic") or q.get("skill_tag")
            if not sub_topic and planned_coord:
                sub_topic = planned_coord["sub_topic"]
            elif not sub_topic:
                sub_topic = "General"
                
            depth_level = q.get("depth_level") or q.get("difficulty_level") or q.get("difficulty")
            if not depth_level and planned_coord:
                depth_level = planned_coord["depth_level"]
            elif not depth_level:
                depth_level = difficulty
                
            context_type = q.get("context_type") or q.get("question_type")
            if not context_type and planned_coord:
                context_type = planned_coord["context_type"]
            elif not context_type:
                context_type = "conceptual"
                
            validated.append({
                "question_text": str(q.get("question_text", "")).strip(),
                "skill_tag": str(sub_topic).strip(),
                "difficulty_level": str(depth_level).strip(),
                "expected_keywords": q.get("expected_keywords", []),
                "question_type": str(context_type).strip(),
                "is_reserve": bool(q.get("is_reserve", i >= num_questions)),
            })

        # If Groq returned fewer questions than requested, pad with fallback
        if len(validated) < total_count:
            logger.warning(
                "Groq returned %d questions, expected %d. Padding with fallback.",
                len(validated), total_count
            )
            fallback = get_fallback_questions(
                context["target_role"], difficulty,
                total_count - len(validated), reserve_count=0
            )
            validated.extend(fallback[:total_count - len(validated)])

        logger.info("Generated %d questions via Groq (including %d reserve).", len(validated), reserve_count)
        return validated

    except Exception as e:
        logger.warning("Groq question generation failed (%s). Using fallback questions.", e)
        return get_fallback_questions(
            target_role=context.get("target_role", "Software Engineer"),
            difficulty=difficulty,
            num_questions=num_questions,
            reserve_count=reserve_count,
        )
    finally:
        if standalone_session:
            standalone_session.close()

