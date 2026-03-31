"""Job recommendation service with semantic skill matching support."""
from typing import List, Dict, Optional, Tuple, Any
import datetime as dt
import numpy as np
from sqlalchemy.orm import Session, joinedload
from ..config import settings
from ..constants import JOB_RECOMMENDATION_WEIGHTS, SEMANTIC_MATCHING_CONFIG
from ..db import (
    Applicant, Job, InterviewSession, JobRecommendation,
    ApplicantEmbedding, JobEmbedding
)
from ..core.semantic_matching import SemanticMatcher
import logging

logger = logging.getLogger(__name__)


class RecommendationService:
    """Generate personalized job recommendations for an applicant."""
    
    def __init__(self, db: Session):
        self.db = db
        # Initialize semantic matcher (singleton, lazy loads embeddings)
        try:
            self.semantic_matcher = SemanticMatcher()
            if self.semantic_matcher.enabled:
                logger.info("Semantic skill matching enabled")
            else:
                logger.warning("Semantic skill matching disabled (missing dependencies or taxonomy)")
        except Exception as e:
            logger.error(f"Failed to initialize semantic matcher: {e}")
            self.semantic_matcher = None
        
    def get_recommendations(self, applicant_id: int) -> Dict:
        """Get job recommendations for an applicant."""
        try:
            # Fetch applicant data with parsed record eagerly loaded
            applicant = self.db.query(Applicant).options(
                joinedload(Applicant.parsed_record)
            ).filter(Applicant.id == applicant_id).first()
            
            if not applicant:
                logger.warning(f"Applicant {applicant_id} not found")
                return {'job_recommendations': []}
            
            # Get parsed resume data
            parsed_record = applicant.parsed_record
            if not parsed_record:
                logger.warning(f"No parsed resume for applicant {applicant_id}")
                return {'job_recommendations': []}
            
            normalized_data = parsed_record.normalized or {}
            
            # Get interview scores
            interview_score = self._get_latest_interview_score(applicant_id)
            
            # Generate job recommendations
            job_recs = self._generate_job_recommendations(
                applicant, normalized_data, interview_score
            )
            
            logger.info(f"Generated {len(job_recs)} job recommendations for applicant {applicant_id}")
            
            return {
                'job_recommendations': job_recs
            }
        except Exception as e:
            logger.error(f"Error in get_recommendations: {str(e)}", exc_info=True)
            return {'job_recommendations': []}
    
    def _get_latest_interview_score(self, applicant_id: int) -> Optional[float]:
        """Get the most recent interview score (normalized 0-1)"""
        session = self.db.query(InterviewSession).filter(
            InterviewSession.applicant_id == applicant_id,
            InterviewSession.status == 'completed'
        ).order_by(InterviewSession.completed_at.desc()).first()
        
        if session and session.overall_score is not None:
            # Normalize to 0-1 scale (overall_score is 0-100)
            return session.overall_score / 100.0
        return None
    
    def _calculate_projects_score(self, projects: List[Dict], is_academic: bool = False) -> float:
        """Calculate projects score (0-1)"""
        if not projects:
            return 0.3
        
        score = 0.3
        
        # More projects = higher score
        project_count = len(projects)
        if project_count >= 5:
            score += 0.4
        elif project_count >= 3:
            score += 0.3
        elif project_count >= 1:
            score += 0.2
        
        # Check for quality indicators
        for project in projects:
            if project.get('url') or project.get('github'):
                score += 0.05
            if project.get('technologies') and len(project.get('technologies', [])) >= 3:
                score += 0.05
        
        return min(1.0, score)
    
    def _calculate_certifications_score(self, certifications: List[Dict]) -> float:
        """Calculate certifications score (0-1)"""
        if not certifications:
            return 0.2
        
        count = len(certifications)
        if count >= 5:
            return 1.0
        elif count >= 3:
            return 0.8
        elif count >= 1:
            return 0.5
        
        return 0.2

    def _generate_job_recommendations(
        self, applicant: Applicant, normalized_data: Dict, interview_score: Optional[float]
    ) -> List[Dict]:
        """Generate job recommendations with match scores using skills-focused weights"""

        jobs = self._load_candidate_jobs(applicant.id)
        
        recommendations = []
        min_score = settings.MIN_JOB_REC_SCORE  # Use job-specific minimum
        
        logger.info(f"Starting job recommendation generation for applicant {applicant.id}. Min score threshold: {min_score}")
        
        for job in jobs:
            # Calculate match score with applicant context for location matching
            match_score, breakdown = self._calculate_job_match(
                normalized_data, job, interview_score, applicant
            )
            
            logger.debug(f"Job {job.id} ({job.title}): score={match_score:.3f}, min={min_score}")
            
            if match_score >= min_score:
                # Get or create recommendation record (store as 0-100 percentage)
                score_percent = match_score * 100
                rec = self.db.query(JobRecommendation).filter(
                    JobRecommendation.applicant_id == applicant.id,
                    JobRecommendation.job_id == job.id
                ).first()
                
                # Generate structured explanation
                explanation = self._generate_structured_job_explanation(breakdown, job, normalized_data)
                
                if not rec:
                    rec = JobRecommendation(
                        applicant_id=applicant.id,
                        job_id=job.id,
                        score=score_percent,
                        scoring_breakdown=breakdown,
                        explain=explanation
                    )
                    self.db.add(rec)
                else:
                    # Update score
                    rec.score = score_percent
                    rec.scoring_breakdown = breakdown
                    rec.explain = explanation
                
                recommendations.append({
                    'id': job.id,
                    'title': job.title,
                    'company': job.employer.company_name if job.employer else 'Unknown',
                    'location': f"{job.location_city}, {job.location_state}",
                    'work_type': job.work_type,
                    'description': job.description,
                    'min_experience_years': job.min_experience_years,
                    'required_skills': job.required_skills,
                    'match_score': round(match_score * 100, 1), # Return as percentage for frontend
                    'match_breakdown': breakdown,
                    'recommendation_reason': self._generate_job_reason(breakdown, job)
                })
        
        # Commit recommendation records
        try:
            self.db.commit()
            logger.info(f"Generated {len(recommendations)} job recommendations for applicant {applicant.id}")
        except Exception as e:
            logger.error(f"Failed to commit job recommendations: {e}")
            self.db.rollback()
        
        # Sort by match score and limit
        recommendations.sort(key=lambda x: x['match_score'], reverse=True)
        return recommendations[:settings.MAX_RECOMMENDATIONS]

    def _load_candidate_jobs(self, applicant_id: int) -> List[Job]:
        """Load candidate jobs via vector retrieval when possible, else fallback safely."""
        now = dt.datetime.utcnow()

        base_query = self.db.query(Job).filter(
            Job.status == 'approved',
            ((Job.expires_at.is_(None)) | (Job.expires_at > now))
        )

        if not settings.USE_VECTOR_RETRIEVAL:
            return base_query.all()

        app_embedding = self.db.query(ApplicantEmbedding).filter(
            ApplicantEmbedding.applicant_id == applicant_id
        ).first()

        # If embedding doesn't exist yet, fallback for now (task enqueue occurs in parse flow).
        if not app_embedding or not app_embedding.embedding_vector:
            logger.info("Vector retrieval fallback: missing applicant embedding for %s", applicant_id)
            try:
                from ..embedding_tasks import generate_resume_embedding_task
                generate_resume_embedding_task.delay(applicant_id)
            except Exception as exc:
                logger.warning("Could not enqueue cold-start applicant embedding task for %s: %s", applicant_id, exc)
            return base_query.all()

        target = np.array(app_embedding.embedding_vector, dtype=float)
        if target.size == 0:
            return base_query.all()

        job_embeddings = self.db.query(JobEmbedding, Job).join(
            Job, Job.id == JobEmbedding.job_id
        ).filter(
            Job.status == 'approved',
            ((Job.expires_at.is_(None)) | (Job.expires_at > now))
        ).all()

        if not job_embeddings:
            try:
                from ..embedding_tasks import generate_job_embedding_task
                missing_jobs = base_query.limit(max(settings.VECTOR_RETRIEVAL_MIN_CANDIDATES, 50)).all()
                for job in missing_jobs:
                    generate_job_embedding_task.delay(job.id)
            except Exception as exc:
                logger.warning("Could not enqueue cold-start job embedding tasks: %s", exc)
            return base_query.all()

        scored_ids: List[Tuple[int, float]] = []
        for emb, job in job_embeddings:
            try:
                vec = np.array(emb.embedding_vector, dtype=float)
                if vec.size == 0 or vec.shape != target.shape:
                    continue
                denom = np.linalg.norm(target) * np.linalg.norm(vec)
                if denom == 0:
                    continue
                similarity = float(np.dot(target, vec) / denom)
                scored_ids.append((job.id, similarity))
            except Exception:
                continue

        if not scored_ids:
            return base_query.all()

        scored_ids.sort(key=lambda x: x[1], reverse=True)
        top_k = max(settings.VECTOR_RETRIEVAL_MIN_CANDIDATES, settings.VECTOR_RETRIEVAL_TOP_K)
        top_job_ids = [job_id for job_id, _ in scored_ids[:top_k]]
        if not top_job_ids:
            return base_query.all()

        # Keep DB-level filtering for freshness and status.
        return base_query.filter(Job.id.in_(top_job_ids)).all()
    
    def _calculate_job_match(
        self, normalized_data: Dict, job: Job, interview_score: Optional[float],
        applicant: Optional[Applicant] = None
    ) -> Tuple[float, Dict]:
        """
        Calculate match score for a job using skills/experience-focused weights.
        
        Follows industry best practices for job matching:
        - Skills match is primary criterion (35%)
        - Experience relevance is key differentiator (20%)
        - Location and work preferences matter for fit (15%)
        - Practical project work valued (5%)
        
        Returns:
            (match_score, breakdown_dict) where match_score is 0-1
        """
        # Extract applicant data
        skills = normalized_data.get('skills', [])
        education = normalized_data.get('education', [])
        experience = normalized_data.get('experience', [])
        projects = normalized_data.get('projects', [])
        certifications = normalized_data.get('certifications', [])
        personal = normalized_data.get('personal', {})
        
        # Get job-specific weights from settings
        skills_weight = settings.JOB_REC_SKILLS_WEIGHT
        experience_weight = settings.JOB_REC_EXPERIENCE_WEIGHT
        cert_weight = settings.JOB_REC_CERTIFICATIONS_WEIGHT
        location_weight = settings.JOB_REC_LOCATION_WEIGHT
        interview_weight = settings.JOB_REC_INTERVIEW_WEIGHT
        projects_weight = settings.JOB_REC_PROJECTS_WEIGHT
        work_type_weight = settings.JOB_REC_WORK_TYPE_WEIGHT
        salary_weight = settings.JOB_REC_SALARY_WEIGHT
        education_weight = settings.JOB_REC_EDUCATION_WEIGHT
        
        # Make normalized context available to embedding payload builder.
        self._current_normalized = normalized_data

        # Calculate individual component scores (0-1 scale)
        skills_score, skills_breakdown = self._calculate_job_skills_match(skills, job)
        experience_score = self._calculate_job_experience_match(experience, job)
        cert_score = self._calculate_job_certifications_match(certifications, job)
        location_score = self._calculate_location_match(personal, job, applicant)
        projects_score = self._calculate_projects_score(projects, is_academic=False)
        work_type_score = self._calculate_work_type_match(applicant, job)
        salary_score = self._calculate_salary_match(applicant, job)
        edu_score = self._calculate_job_education_match(education, job)
        
        # Calculate weighted score
        if interview_score is not None:
            final_score = (
                skills_score * skills_weight +
                experience_score * experience_weight +
                cert_score * cert_weight +
                location_score * location_weight +
                interview_score * interview_weight +
                projects_score * projects_weight +
                work_type_score * work_type_weight +
                salary_score * salary_weight +
                edu_score * education_weight
            )
        else:
            # Redistribute interview weight to skills and experience when no interview
            redistributed_to_skills = interview_weight * 0.6  # 60% to skills
            redistributed_to_exp = interview_weight * 0.4     # 40% to experience
            
            final_score = (
                skills_score * (skills_weight + redistributed_to_skills) +
                experience_score * (experience_weight + redistributed_to_exp) +
                cert_score * cert_weight +
                location_score * location_weight +
                projects_score * projects_weight +
                work_type_score * work_type_weight +
                salary_score * salary_weight +
                edu_score * education_weight
            )
        
        # Build detailed breakdown
        breakdown = {
            'skills_score': round(skills_score, 3),
            'skills_breakdown': skills_breakdown,  # Include detailed skill matching info
            'experience_score': round(experience_score, 3),
            'certifications_score': round(cert_score, 3),
            'location_score': round(location_score, 3),
            'interview_score': round(interview_score, 3) if interview_score else None,
            'projects_score': round(projects_score, 3),
            'work_type_score': round(work_type_score, 3),
            'salary_score': round(salary_score, 3),
            'education_score': round(edu_score, 3),
            'weights_used': {
                'skills': skills_weight,
                'experience': experience_weight,
                'certifications': cert_weight,
                'location': location_weight,
                'interview': interview_weight if interview_score else 0,
                'projects': projects_weight,
                'work_type': work_type_weight,
                'salary': salary_weight,
                'education': education_weight
            },
            'recommendation_type': 'job'
        }
        
        return final_score, breakdown
    
    def _calculate_location_match(self, personal: Dict, job: Job, applicant: Optional[Applicant]) -> float:
        """Calculate location preference match (0-1)"""
        # Remote jobs match everyone
        if job.work_type == 'remote':
            return 1.0
        
        # Get applicant location
        applicant_location = ''
        if applicant:
            applicant_location = getattr(applicant, 'location', '') or ''
        if not applicant_location and personal:
            applicant_location = personal.get('location', '')
        
        if not applicant_location:
            return 0.6  # Neutral if no location
        
        job_city = (job.location_city or '').lower()
        job_state = (job.location_state or '').lower()
        applicant_loc_lower = applicant_location.lower()
        
        # Exact city match
        if job_city and job_city in applicant_loc_lower:
            return 1.0
        
        # Same state
        if job_state and job_state in applicant_loc_lower:
            return 0.8
        
        # Hybrid can work for nearby
        if job.work_type == 'hybrid':
            return 0.7
        
        return 0.4  # Different location
    
    def _calculate_work_type_match(self, applicant: Optional[Applicant], job: Job) -> float:
        """Calculate work type preference match (0-1)"""
        # If no preference stored, assume flexible
        if not applicant:
            return 0.7
        
        # Check if applicant has stored preferences
        # For now, return neutral score
        # This can be enhanced with actual preference storage
        if job.work_type == 'remote':
            return 0.9  # Remote generally preferred
        elif job.work_type == 'hybrid':
            return 0.8
        else:
            return 0.7  # On-site
    
    def _calculate_salary_match(self, applicant: Optional[Applicant], job: Job) -> float:
        """Calculate salary expectation match (0-1)"""
        # Safely access optional salary fields
        min_salary = getattr(job, 'min_salary', None)
        max_salary = getattr(job, 'max_salary', None)
        
        # If no salary info available, return neutral
        if not min_salary and not max_salary:
            return 0.7
        
        # For now, jobs with visible salary are preferred
        # Can be enhanced with actual salary expectation matching
        if min_salary and max_salary:
            return 0.9  # Transparent salary = good match
        
        return 0.6
    
    def _calculate_job_certifications_match(self, certifications: List[Dict], job: Job) -> float:
        """Calculate certification match for job (0-1)"""
        if not certifications:
            # No penalty for missing certifications unless required
            return 0.5
        
        # Check if job has preferred certifications (optional field)
        job_certs = getattr(job, 'preferred_certifications', None) or []
        if not job_certs:
            # Has certifications but job doesn't require any
            return 0.8 if certifications else 0.5
        
        # Calculate match
        applicant_certs = set()
        for cert in certifications:
            name = cert.get('name', '') if isinstance(cert, dict) else str(cert)
            applicant_certs.add(name.lower())
        
        job_certs_lower = set(c.lower() for c in job_certs if c)
        if not job_certs_lower:
            return 0.7
            
        matches = len(applicant_certs & job_certs_lower)
        return min(1.0, matches / len(job_certs_lower) + 0.3)
    
    def _calculate_job_skills_match(self, applicant_skills: List, job: Job) -> Tuple[float, Dict]:
        """
        Calculate skill match for job using semantic matching.
        
        Returns: (match_score, detailed_breakdown)
        """
        if not applicant_skills or not job.required_skills:
            return 0.3, {"skills_score": 0.3, "matched_skills": [], "missing_skills": []}
        
        if not settings.SEMANTIC_MATCHING_ENABLED or not self.semantic_matcher:
            return 0.3, {
                "skills_score": 0.3,
                "matched_skills": [],
                "missing_skills": [],
                "matching_type": "semantic_disabled",
            }

        return self._calculate_job_skills_match_semantic(applicant_skills, job)
    
    def _calculate_job_skills_match_semantic(self, applicant_skills: List, job: Job) -> Tuple[float, Dict]:
        """Semantic skill matching using Google embeddings with MiniLM fallback."""
        try:
            applicant_skill_list = []
            for skill in applicant_skills:
                skill_name = skill.get('name', '') if isinstance(skill, dict) else str(skill)
                if skill_name:
                    applicant_skill_list.append(skill_name)

            required_skill_list = []
            for skill in job.required_skills:
                skill_name = skill if isinstance(skill, str) else skill.get('name', '')
                if skill_name:
                    required_skill_list.append(skill_name)

            if not required_skill_list:
                return 0.5, {"skills_score": 0.5, "matched_skills": [], "missing_skills": []}

            applicant_payload = self._build_applicant_embedding_payload(applicant_skills)
            job_payload = self._build_job_embedding_payload(job)

            applicant_vec, applicant_provider = self.semantic_matcher.embed_text(applicant_payload)
            job_vec, job_provider = self.semantic_matcher.embed_text(job_payload)

            context_similarity = 0.0
            if applicant_vec is not None and job_vec is not None:
                context_similarity = self.semantic_matcher.cosine_similarity(applicant_vec, job_vec)
                context_similarity = (context_similarity + 1.0) / 2.0

            matched_skills: List[str] = []
            partial_matches: List[str] = []
            missing_skills: List[str] = []
            per_required_scores: Dict[str, float] = {}

            threshold = settings.SEMANTIC_SIMILARITY_THRESHOLD
            partial_threshold = max(0.0, threshold - 0.1)

            applicant_skill_vectors: List[Tuple[str, Any]] = []
            for skill in applicant_skill_list:
                vec, _provider = self.semantic_matcher.embed_text(skill)
                if vec is not None:
                    applicant_skill_vectors.append((skill, vec))

            for req in required_skill_list:
                req_vec, _req_provider = self.semantic_matcher.embed_text(req)
                if req_vec is None or not applicant_skill_vectors:
                    missing_skills.append(req)
                    per_required_scores[req] = 0.0
                    continue

                best_sim = -1.0
                for _skill, app_vec in applicant_skill_vectors:
                    sim = self.semantic_matcher.cosine_similarity(req_vec, app_vec)
                    best_sim = max(best_sim, sim)

                sim_01 = (best_sim + 1.0) / 2.0
                per_required_scores[req] = round(sim_01, 3)

                if sim_01 >= threshold:
                    matched_skills.append(req)
                elif sim_01 >= partial_threshold:
                    partial_matches.append(req)
                else:
                    missing_skills.append(req)

            required_count = max(1, len(required_skill_list))
            exact_score = len(matched_skills) / required_count
            partial_score = (len(partial_matches) * SEMANTIC_MATCHING_CONFIG["PARTIAL_CREDIT_FOR_RELATED"]) / required_count
            coverage_score = min(1.0, exact_score + partial_score)
            final_score = min(1.0, 0.7 * coverage_score + 0.3 * context_similarity)

            breakdown = {
                "skills_score": round(final_score, 3),
                "matched_skills": matched_skills,
                "partial_matches": partial_matches,
                "missing_skills": missing_skills,
                "matching_type": "google_embedding_semantic",
                "required_skills_count": len(required_skill_list),
                "exact_matches": len(matched_skills),
                "partial_matches_count": len(partial_matches),
                "coverage_score": round(coverage_score, 3),
                "context_similarity": round(context_similarity, 3),
                "providers_used": {
                    "applicant_context": applicant_provider,
                    "job_context": job_provider,
                },
                "required_skill_similarity": per_required_scores,
            }

            return final_score, breakdown

        except Exception as e:
            logger.error(f"Error in semantic skill matching: {e}")
            return 0.3, {
                "skills_score": 0.3,
                "matched_skills": [],
                "missing_skills": [],
                "matching_type": "semantic_error",
                "error": str(e),
            }

    def _build_applicant_embedding_payload(self, applicant_skills: List) -> str:
        """Build compact applicant embedding text from selected fields only."""
        skill_names: List[str] = []
        for skill in applicant_skills:
            name = skill.get('name', '') if isinstance(skill, dict) else str(skill)
            if name:
                skill_names.append(name.strip())

        unique_skills = list(dict.fromkeys(skill_names))[:30]
        normalized = getattr(self, "_current_normalized", {}) or {}
        exp = normalized.get('experience', []) if isinstance(normalized, dict) else []
        edu = normalized.get('education', []) if isinstance(normalized, dict) else []

        roles: List[str] = []
        for item in exp[:3]:
            if isinstance(item, dict) and item.get('title'):
                roles.append(str(item.get('title')))

        degrees: List[str] = []
        for item in edu[:2]:
            if isinstance(item, dict):
                degree = item.get('degree')
                field = item.get('field')
                if degree and field:
                    degrees.append(f"{degree} in {field}")
                elif degree:
                    degrees.append(str(degree))

        return " | ".join([
            f"skills: {', '.join(unique_skills)}",
            f"experience: {', '.join(roles) if roles else 'not_provided'}",
            f"education: {', '.join(degrees) if degrees else 'not_provided'}",
        ])

    def _build_job_embedding_payload(self, job: Job) -> str:
        """Build compact job embedding text from selected recruiter fields only."""
        required: List[str] = []
        for skill in (job.required_skills or []):
            if isinstance(skill, str) and skill.strip():
                required.append(skill.strip())
            elif isinstance(skill, dict) and skill.get('name'):
                required.append(str(skill.get('name')).strip())

        required = list(dict.fromkeys(required))[:30]
        city = (job.location_city or '').strip()
        state = (job.location_state or '').strip()
        location = f"{city}, {state}".strip(', ')

        return " | ".join([
            f"title: {job.title or 'unknown'}",
            f"required_skills: {', '.join(required)}",
            f"min_experience_years: {job.min_experience_years if job.min_experience_years is not None else 0}",
            f"work_type: {job.work_type or 'unknown'}",
            f"location: {location if location else 'unknown'}",
        ])
    
    def _calculate_job_education_match(self, education: List[Dict], job: Job) -> float:
        """Calculate education match for job"""
        if not education:
            return 0.3
        
        # Check CGPA requirement
        if job.min_cgpa:
            for edu in education:
                grade = edu.get('grade')
                if grade and grade >= job.min_cgpa:
                    return 1.0
            return 0.5  # Has education but doesn't meet CGPA
        
        return 0.8  # Has education, no specific requirement
    
    def _calculate_job_experience_match(self, experience: List[Dict], job: Job) -> float:
        """Calculate experience match for job"""
        if not experience:
            if job.min_experience_years == 0:
                return 1.0  # Fresher role
            return 0.3  # No experience but experience required
        
        # Calculate total years
        total_months = len(experience) * 12  # Simple heuristic
        years = total_months / 12
        
        if years >= job.min_experience_years:
            return 1.0
        elif job.min_experience_years > 0:
            return years / job.min_experience_years
        else:
            return 0.8  # Has experience, no minimum required
    
    def _generate_job_reason(self, breakdown: Dict, job: Job) -> str:
        """Generate human-readable job recommendation reason"""
        reasons = []
        
        # Check job-relevant factors (skills and experience first)
        if breakdown.get('skills_score', 0) > 0.7:
            reasons.append("excellent skill match")
        elif breakdown.get('skills_score', 0) > 0.5:
            reasons.append("good skill alignment")
            
        if breakdown.get('experience_score', 0) > 0.7:
            reasons.append("relevant work experience")
        elif breakdown.get('experience_score', 0) > 0.5:
            reasons.append("applicable experience")
            
        if breakdown.get('location_score', 0) > 0.8:
            reasons.append("ideal location match")
            
        if breakdown.get('certifications_score', 0) > 0.7:
            reasons.append("valuable certifications")
            
        if breakdown.get('interview_score') and breakdown['interview_score'] > 0.7:
            reasons.append("strong interview performance")
            
        if breakdown.get('projects_score', 0) > 0.6:
            reasons.append("impressive project portfolio")
        
        if not reasons:
            reasons.append("good overall profile fit")
        
        return f"Recommended based on {', '.join(reasons[:3])} for {job.title}"
    
    def _generate_structured_job_explanation(self, breakdown: Dict, job: Job, normalized_data: Dict) -> Dict:
        """Generate structured explanation for frontend display with job-specific insights"""
        reasons = []
        
        # Skills analysis (35% weight - most important for jobs)
        skills_score = breakdown.get('skills_score', 0)
        if skills_score >= 0.8:
            reasons.append("Your skills are an excellent match for this role's requirements")
        elif skills_score >= 0.6:
            reasons.append("You have many of the key skills needed for this position")
        elif skills_score >= 0.4:
            reasons.append("You have some relevant skills that align with this role")
        else:
            reasons.append("This role could help you develop new valuable skills")
        
        # Experience analysis (20% weight)
        exp_score = breakdown.get('experience_score', 0)
        if exp_score >= 0.8:
            reasons.append("Your experience level matches or exceeds the requirements")
        elif exp_score >= 0.5:
            reasons.append("Your experience is relevant to this position")
        elif exp_score < 0.3 and job.min_experience_years == 0:
            reasons.append("This is a great entry-level opportunity for your career")
        
        # Location analysis (10% weight)
        location_score = breakdown.get('location_score', 0)
        if location_score >= 0.9:
            reasons.append("The job location aligns perfectly with your preferences")
        elif location_score >= 0.7:
            reasons.append("The work arrangement offers good flexibility")
        
        # Certifications (10% weight)
        cert_score = breakdown.get('certifications_score', 0)
        if cert_score >= 0.8:
            reasons.append("Your certifications strengthen your candidacy")
        
        # Interview performance (8% weight)
        interview_score = breakdown.get('interview_score')
        if interview_score and interview_score >= 0.7:
            reasons.append("Your strong interview performance indicates readiness for this role")
        
        # Projects (5% weight)
        projects_score = breakdown.get('projects_score', 0)
        if projects_score >= 0.7:
            reasons.append("Your project portfolio demonstrates practical expertise")
        
        if not reasons:
            reasons.append("Your overall profile is a good fit for this opportunity")
        
        # Build summary with key scores
        return {
            "reasons": reasons[:5],  # Top 5 reasons
            "summary": f"Match: {round(breakdown.get('skills_score', 0) * 100)}% skills, {round(breakdown.get('experience_score', 0) * 100)}% experience, {round(breakdown.get('location_score', 0) * 100)}% location fit",
            "key_strengths": [r for r in reasons if "excellent" in r.lower() or "strong" in r.lower()],
            "improvement_areas": self._identify_improvement_areas(breakdown)
        }
    
    def _identify_improvement_areas(self, breakdown: Dict) -> List[str]:
        """Identify areas for improvement based on low scores"""
        areas = []
        
        if breakdown.get('skills_score', 0) < 0.5:
            areas.append("Consider upskilling in required technologies")
        if breakdown.get('experience_score', 0) < 0.5:
            areas.append("Gain more relevant work experience or projects")
        if breakdown.get('certifications_score', 0) < 0.4:
            areas.append("Industry certifications could strengthen your profile")
        if breakdown.get('interview_score') is None:
            areas.append("Complete mock interviews to boost your profile score")
        
        return areas[:3]
