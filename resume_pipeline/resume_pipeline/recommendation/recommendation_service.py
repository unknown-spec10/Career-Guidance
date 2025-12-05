"""
Recommendation Service for Colleges and Jobs
Implements weighted scoring algorithm based on skills, education, experience, and interview scores
"""
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session, joinedload
from ..config import settings
from ..db import (
    Applicant, LLMParsedRecord, College, CollegeProgram, CollegeEligibility,
    Job, InterviewSession, CollegeApplicabilityLog, JobRecommendation
)
import logging

logger = logging.getLogger(__name__)


class RecommendationService:
    """Generate personalized recommendations for colleges and jobs"""
    
    def __init__(self, db: Session):
        self.db = db
        
    def get_recommendations(self, applicant_id: int) -> Dict:
        """Get all recommendations for an applicant"""
        try:
            # Fetch applicant data with parsed record eagerly loaded
            applicant = self.db.query(Applicant).options(
                joinedload(Applicant.parsed_record)
            ).filter(Applicant.id == applicant_id).first()
            
            if not applicant:
                logger.warning(f"Applicant {applicant_id} not found")
                return {'college_recommendations': [], 'job_recommendations': []}
            
            # Get parsed resume data
            parsed_record = applicant.parsed_record
            if not parsed_record:
                logger.warning(f"No parsed resume for applicant {applicant_id}")
                return {'college_recommendations': [], 'job_recommendations': []}
            
            normalized_data = parsed_record.normalized or {}
            
            # Get interview scores
            interview_score = self._get_latest_interview_score(applicant_id)
            
            # Generate college recommendations
            college_recs = self._generate_college_recommendations(
                applicant, normalized_data, interview_score
            )
            
            # Generate job recommendations
            job_recs = self._generate_job_recommendations(
                applicant, normalized_data, interview_score
            )
            
            logger.info(f"Generated {len(college_recs)} college and {len(job_recs)} job recommendations for applicant {applicant_id}")
            
            return {
                'college_recommendations': college_recs,
                'job_recommendations': job_recs
            }
        except Exception as e:
            logger.error(f"Error in get_recommendations: {str(e)}", exc_info=True)
            return {'college_recommendations': [], 'job_recommendations': []}
    
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
    
    def _generate_college_recommendations(
        self, applicant: Applicant, normalized_data: Dict, interview_score: Optional[float]
    ) -> List[Dict]:
        """Generate college recommendations with match scores"""
        
        colleges = self.db.query(College).all()
        
        recommendations = []
        for college in colleges:
            match_score, breakdown = self._calculate_college_match(
                normalized_data, college, interview_score
            )
            
            if match_score >= settings.MIN_RECOMMENDATION_SCORE:
                # Add to DB session
                rec_log = self.db.query(CollegeApplicabilityLog).filter(
                    CollegeApplicabilityLog.applicant_id == applicant.id,
                    CollegeApplicabilityLog.college_id == college.id
                ).first()
                
                if not rec_log:
                    rec_log = CollegeApplicabilityLog(
                        applicant_id=applicant.id,
                        college_id=college.id,
                        recommend_score=match_score,
                        explain=breakdown
                    )
                    self.db.add(rec_log)
                else:
                    # Update score
                    rec_log.recommend_score = match_score
                    rec_log.explain = breakdown
                
                recommendations.append({
                    'id': college.id,
                    'name': college.name,
                    'location': f"{college.location_city}, {college.location_state}",
                    'description': college.description,
                    'website': college.website,
                    'logo_url': college.logo_url,
                    'match_score': round(match_score * 100, 1), # Return as percentage for frontend
                    'match_breakdown': breakdown,
                    'recommendation_reason': self._generate_college_reason(breakdown, college)
                })
        
        try:
            self.db.commit()
        except Exception as e:
            logger.error(f"DB Commit error in recommendations: {e}")
            self.db.rollback()
            
        recommendations.sort(key=lambda x: x['match_score'], reverse=True)
        return recommendations[:settings.MAX_RECOMMENDATIONS]
    
    def _calculate_college_match(
        self, normalized_data: Dict, college: College, interview_score: Optional[float]
    ) -> Tuple[float, Dict]:
        """
        Calculate match score for a college
        
        Returns:
            (match_score, breakdown_dict)
        """
        # Extract applicant data
        skills = normalized_data.get('skills', [])
        education = normalized_data.get('education', [])
        experience = normalized_data.get('experience', [])
        
        # Calculate individual scores
        skills_score = self._calculate_skills_match(skills, college)
        education_score = self._calculate_education_match(education, college)
        experience_score = self._calculate_experience_match(experience)
        
        # Get weights
        skills_weight = settings.RECOMMENDATION_SKILLS_WEIGHT
        education_weight = settings.RECOMMENDATION_EDUCATION_WEIGHT
        experience_weight = settings.RECOMMENDATION_EXPERIENCE_WEIGHT
        interview_weight = settings.RECOMMENDATION_INTERVIEW_WEIGHT
        
        # Calculate final score
        if interview_score is not None:
            # With interview score
            final_score = (
                skills_score * skills_weight +
                education_score * education_weight +
                experience_score * experience_weight +
                interview_score * interview_weight
            )
        else:
            # Without interview - redistribute interview weight
            total_weight = skills_weight + education_weight + experience_weight
            final_score = (
                skills_score * (skills_weight + interview_weight * 0.5) / total_weight +
                education_score * (education_weight + interview_weight * 0.3) / total_weight +
                experience_score * (experience_weight + interview_weight * 0.2) / total_weight
            ) * total_weight
        
        breakdown = {
            'skills_score': round(skills_score, 2),
            'education_score': round(education_score, 2),
            'experience_score': round(experience_score, 2),
            'interview_score': round(interview_score, 2) if interview_score else None,
            'weights_used': {
                'skills': skills_weight,
                'education': education_weight,
                'experience': experience_weight,
                'interview': interview_weight if interview_score else 0
            }
        }
        
        return final_score, breakdown
    
    def _calculate_skills_match(self, applicant_skills: List, college: College) -> float:
        """Calculate skill match score (0-1)"""
        if not applicant_skills:
            return 0.0
        
        # Get college programs and their required skills
        programs = college.programs
        if not programs:
            return 0.5  # Neutral score if no specific requirements
        
        # Extract applicant skill names
        applicant_skill_names = set()
        for skill in applicant_skills:
            if isinstance(skill, dict):
                applicant_skill_names.add(skill.get('name', '').lower())
            elif isinstance(skill, str):
                applicant_skill_names.add(skill.lower())
        
        # Check match with any program
        best_match = 0.0
        for program in programs:
            if program.required_skills:
                required = set(s.lower() for s in program.required_skills)
                if required:
                    matches = len(applicant_skill_names & required)
                    match_ratio = matches / len(required)
                    best_match = max(best_match, match_ratio)
        
        return min(1.0, best_match + 0.2)  # Bonus for having skills
    
    def _calculate_education_match(self, education: List[Dict], college: College) -> float:
        """Calculate education match score (0-1)"""
        if not education:
            return 0.3  # Low score if no education data
        
        # Get eligibility criteria
        eligibility = college.eligibility
        if not eligibility:
            return 0.7  # Neutral-high if no specific requirements
        
        score = 0.0
        for edu in education:
            degree = edu.get('degree', '').lower()
            grade = edu.get('grade')
            
            # Check degree eligibility
            if eligibility[0].eligible_degrees:
                eligible = any(d.lower() in degree for d in eligibility[0].eligible_degrees)
                if eligible:
                    score += 0.5
            else:
                score += 0.4  # Assume eligible if not specified
            
            # Check CGPA
            if grade and eligibility[0].min_cgpa:
                if grade >= eligibility[0].min_cgpa:
                    score += 0.5
                else:
                    score += max(0, 0.5 * (grade / eligibility[0].min_cgpa))
            else:
                score += 0.3
        
        return min(1.0, score / len(education))
    
    def _calculate_experience_match(self, experience: List[Dict]) -> float:
        """Calculate experience score (0-1)"""
        if not experience:
            return 0.5  # Neutral for students with no experience
        
        # Calculate total years of experience
        total_months = 0
        for exp in experience:
            # Simple heuristic: assume 1 year if dates not parseable
            total_months += 12
        
        years = total_months / 12
        # Score increases with experience, capped at 1.0
        return min(1.0, 0.5 + (years * 0.1))
    
    def _generate_college_reason(self, breakdown: Dict, college: College) -> str:
        """Generate human-readable recommendation reason"""
        reasons = []
        
        if breakdown['skills_score'] > 0.7:
            reasons.append("strong skill match")
        if breakdown['education_score'] > 0.7:
            reasons.append("excellent academic fit")
        if breakdown.get('interview_score') and breakdown['interview_score'] > 0.7:
            reasons.append("impressive interview performance")
        
        if not reasons:
            reasons.append("good overall profile match")
        
        return f"Recommended based on {' and '.join(reasons)} with {college.name}"
    
    def _generate_job_recommendations(
        self, applicant: Applicant, normalized_data: Dict, interview_score: Optional[float]
    ) -> List[Dict]:
        """Generate job recommendations with match scores"""
        
        # Get all approved jobs
        jobs = self.db.query(Job).filter(Job.status == 'approved').all()
        
        recommendations = []
        for job in jobs:
            # Calculate match score
            match_score, breakdown = self._calculate_job_match(
                normalized_data, job, interview_score
            )
            
            if match_score >= settings.MIN_RECOMMENDATION_SCORE:
                # Get or create recommendation record
                rec = self.db.query(JobRecommendation).filter(
                    JobRecommendation.applicant_id == applicant.id,
                    JobRecommendation.job_id == job.id
                ).first()
                
                if not rec:
                    rec = JobRecommendation(
                        applicant_id=applicant.id,
                        job_id=job.id,
                        score=match_score,
                        scoring_breakdown=breakdown,
                        explain=breakdown
                    )
                    self.db.add(rec)
                else:
                    # Update score
                    rec.score = match_score
                    rec.scoring_breakdown = breakdown
                
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
        self.db.commit()
        
        # Sort by match score and limit
        recommendations.sort(key=lambda x: x['match_score'], reverse=True)
        return recommendations[:settings.MAX_RECOMMENDATIONS]
    
    def _calculate_job_match(
        self, normalized_data: Dict, job: Job, interview_score: Optional[float]
    ) -> Tuple[float, Dict]:
        """Calculate match score for a job"""
        
        skills = normalized_data.get('skills', [])
        education = normalized_data.get('education', [])
        experience = normalized_data.get('experience', [])
        
        # Calculate individual scores
        skills_score = self._calculate_job_skills_match(skills, job)
        education_score = self._calculate_job_education_match(education, job)
        experience_score = self._calculate_job_experience_match(experience, job)
        
        # Get weights
        skills_weight = settings.RECOMMENDATION_SKILLS_WEIGHT
        education_weight = settings.RECOMMENDATION_EDUCATION_WEIGHT
        experience_weight = settings.RECOMMENDATION_EXPERIENCE_WEIGHT
        interview_weight = settings.RECOMMENDATION_INTERVIEW_WEIGHT
        
        # Calculate final score
        if interview_score is not None:
            final_score = (
                skills_score * skills_weight +
                education_score * education_weight +
                experience_score * experience_weight +
                interview_score * interview_weight
            )
        else:
            total_weight = skills_weight + education_weight + experience_weight
            final_score = (
                skills_score * (skills_weight + interview_weight * 0.5) / total_weight +
                education_score * (education_weight + interview_weight * 0.3) / total_weight +
                experience_score * (experience_weight + interview_weight * 0.2) / total_weight
            ) * total_weight
        
        breakdown = {
            'skills_score': round(skills_score, 2),
            'education_score': round(education_score, 2),
            'experience_score': round(experience_score, 2),
            'interview_score': round(interview_score, 2) if interview_score else None
        }
        
        return final_score, breakdown
    
    def _calculate_job_skills_match(self, applicant_skills: List, job: Job) -> float:
        """Calculate skill match for job"""
        if not applicant_skills or not job.required_skills:
            return 0.3
        
        # Extract applicant skill names
        applicant_skill_names = set()
        for skill in applicant_skills:
            if isinstance(skill, dict):
                applicant_skill_names.add(skill.get('name', '').lower())
            elif isinstance(skill, str):
                applicant_skill_names.add(skill.lower())
        
        # Extract required skill names
        required_skills = set()
        for skill in job.required_skills:
            if isinstance(skill, dict):
                required_skills.add(skill.get('name', '').lower())
            elif isinstance(skill, str):
                required_skills.add(skill.lower())
        
        if not required_skills:
            return 0.5
        
        # Calculate match ratio
        matches = len(applicant_skill_names & required_skills)
        return min(1.0, matches / len(required_skills))
    
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
        
        if breakdown['skills_score'] > 0.7:
            reasons.append("strong skill match")
        if breakdown['experience_score'] > 0.7:
            reasons.append("relevant experience")
        if breakdown.get('interview_score') and breakdown['interview_score'] > 0.7:
            reasons.append("excellent interview performance")
        
        if not reasons:
            reasons.append("good profile match")
        
        return f"Recommended based on {' and '.join(reasons)} for {job.title}"
