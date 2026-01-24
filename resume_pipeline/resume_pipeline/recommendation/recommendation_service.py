"""
Recommendation Service for Colleges and Jobs
Implements weighted scoring algorithm with separate weights for college (academic-focused)
and job (skills/experience-focused) recommendations following industry best practices.

College Recommendations: Prioritize academic performance, entrance exams, research
Job Recommendations: Prioritize skills match, experience, location, industry fit
"""
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session, joinedload
from ..config import settings
from ..constants import COLLEGE_RECOMMENDATION_WEIGHTS, JOB_RECOMMENDATION_WEIGHTS
from ..db import (
    Applicant, LLMParsedRecord, College, CollegeProgram, CollegeEligibility,
    Job, InterviewSession, CollegeApplicabilityLog, JobRecommendation
)
import logging

logger = logging.getLogger(__name__)


class RecommendationService:
    """
    Generate personalized recommendations using industry-standard scoring algorithms.
    
    College Scoring (Academic-focused):
    - CGPA: 25% - Primary academic indicator
    - JEE/Entrance Rank: 20% - Competitive exam performance
    - Academic Achievements: 15% - Research, publications, awards
    - Skills: 15% - Technical skills relevant to programs
    - Projects: 10% - Academic/research projects
    - Interview: 10% - Mock interview performance
    - Certifications: 5% - Relevant certifications
    
    Job Scoring (Skills-focused):
    - Skills Match: 35% - Primary hiring criterion
    - Experience: 20% - Work experience relevance
    - Certifications: 10% - Industry certifications
    - Location: 10% - Geographic preference match
    - Interview: 8% - Mock interview performance
    - Projects: 5% - Portfolio/practical work
    - Work Type: 5% - Full-time/remote preference
    - Salary: 5% - Compensation alignment
    - Education: 2% - Basic degree requirements
    """
    
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
        """Generate college recommendations with match scores using academic-focused weights"""
        
        colleges = self.db.query(College).all()
        
        recommendations = []
        min_score = settings.MIN_COLLEGE_REC_SCORE  # Use college-specific minimum
        
        for college in colleges:
            match_score, breakdown = self._calculate_college_match(
                normalized_data, college, interview_score
            )
            
            if match_score >= min_score:
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
        Calculate match score for a college using academic-focused weights.
        
        Follows industry best practices for higher education recommendations:
        - Academic performance is primary (CGPA, entrance ranks)
        - Research potential and academic projects valued
        - Skills relevant to academic programs
        
        Returns:
            (match_score, breakdown_dict) where match_score is 0-1
        """
        # Extract applicant data
        skills = normalized_data.get('skills', [])
        education = normalized_data.get('education', [])
        projects = normalized_data.get('projects', [])
        certifications = normalized_data.get('certifications', [])
        jee_rank = normalized_data.get('jee_rank')
        
        # Get college-specific weights from settings
        cgpa_weight = settings.COLLEGE_REC_CGPA_WEIGHT
        jee_weight = settings.COLLEGE_REC_JEE_RANK_WEIGHT
        academic_weight = settings.COLLEGE_REC_ACADEMIC_WEIGHT
        skills_weight = settings.COLLEGE_REC_SKILLS_WEIGHT
        projects_weight = settings.COLLEGE_REC_PROJECTS_WEIGHT
        interview_weight = settings.COLLEGE_REC_INTERVIEW_WEIGHT
        cert_weight = settings.COLLEGE_REC_CERTIFICATIONS_WEIGHT
        
        # Calculate individual component scores (0-1 scale)
        cgpa_score = self._calculate_cgpa_score(education)
        jee_score = self._calculate_jee_rank_score(jee_rank, college)
        academic_score = self._calculate_academic_achievements_score(normalized_data)
        skills_score = self._calculate_skills_match(skills, college)
        projects_score = self._calculate_projects_score(projects, is_academic=True)
        cert_score = self._calculate_certifications_score(certifications)
        
        # Calculate weighted score
        if interview_score is not None:
            final_score = (
                cgpa_score * cgpa_weight +
                jee_score * jee_weight +
                academic_score * academic_weight +
                skills_score * skills_weight +
                projects_score * projects_weight +
                interview_score * interview_weight +
                cert_score * cert_weight
            )
        else:
            # Redistribute interview weight to academic factors when no interview
            redistributed_to_cgpa = interview_weight * 0.5  # 50% to CGPA
            redistributed_to_jee = interview_weight * 0.3   # 30% to JEE
            redistributed_to_skills = interview_weight * 0.2  # 20% to skills
            
            final_score = (
                cgpa_score * (cgpa_weight + redistributed_to_cgpa) +
                jee_score * (jee_weight + redistributed_to_jee) +
                academic_score * academic_weight +
                skills_score * (skills_weight + redistributed_to_skills) +
                projects_score * projects_weight +
                cert_score * cert_weight
            )
        
        # Build detailed breakdown for transparency
        breakdown = {
            'cgpa_score': round(cgpa_score, 3),
            'jee_rank_score': round(jee_score, 3),
            'academic_score': round(academic_score, 3),
            'skills_score': round(skills_score, 3),
            'projects_score': round(projects_score, 3),
            'certifications_score': round(cert_score, 3),
            'interview_score': round(interview_score, 3) if interview_score else None,
            'weights_used': {
                'cgpa': cgpa_weight,
                'jee_rank': jee_weight,
                'academic': academic_weight,
                'skills': skills_weight,
                'projects': projects_weight,
                'interview': interview_weight if interview_score else 0,
                'certifications': cert_weight
            },
            'recommendation_type': 'college'
        }
        
        return final_score, breakdown
    
    def _calculate_cgpa_score(self, education: List[Dict]) -> float:
        """Calculate CGPA score using bracket-based scoring (0-1)"""
        if not education:
            return 0.3  # Default for no education data
        
        # Find highest CGPA/grade
        max_grade = 0.0
        for edu in education:
            grade = edu.get('grade') or edu.get('cgpa') or 0
            if isinstance(grade, (int, float)) and grade > max_grade:
                max_grade = float(grade)
        
        if max_grade == 0:
            return 0.3
        
        # Normalize to 10-point scale if needed
        if max_grade > 10:
            max_grade = max_grade / 10  # Assume percentage
        
        # Use bracket-based scoring from constants
        brackets = COLLEGE_RECOMMENDATION_WEIGHTS.get('CGPA_BRACKETS', {})
        if max_grade >= 9.0:
            return 1.0
        elif max_grade >= 8.0:
            return 0.85
        elif max_grade >= 7.0:
            return 0.7
        elif max_grade >= 6.0:
            return 0.5
        elif max_grade >= 5.0:
            return 0.3
        else:
            return 0.1
    
    def _calculate_jee_rank_score(self, jee_rank: Optional[int], college: College) -> float:
        """Calculate JEE/entrance rank score using bracket-based scoring (0-1)"""
        if not jee_rank or jee_rank <= 0:
            return 0.5  # Neutral score if no rank
        
        # Use bracket-based scoring
        brackets = COLLEGE_RECOMMENDATION_WEIGHTS.get('JEE_RANK_BRACKETS', {})
        
        if jee_rank <= 1000:
            return 1.0  # Excellent
        elif jee_rank <= 5000:
            return 0.9  # Very good
        elif jee_rank <= 15000:
            return 0.75  # Good
        elif jee_rank <= 50000:
            return 0.5  # Average
        elif jee_rank <= 100000:
            return 0.3  # Below average
        else:
            return 0.15  # Low rank
    
    def _calculate_academic_achievements_score(self, normalized_data: Dict) -> float:
        """Calculate academic achievements score (0-1)"""
        score = 0.3  # Base score
        
        # Check for publications/research
        if normalized_data.get('publications'):
            score += 0.3
        
        # Check for awards/honors
        if normalized_data.get('awards') or normalized_data.get('achievements'):
            score += 0.2
        
        # Check for extracurriculars related to academics
        if normalized_data.get('extracurriculars'):
            score += 0.1
        
        # Check for high-quality projects
        projects = normalized_data.get('projects', [])
        if len(projects) >= 3:
            score += 0.1
        
        return min(1.0, score)
    
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
        """Generate human-readable recommendation reason for college"""
        reasons = []
        
        # Check academic factors first (most important for colleges)
        if breakdown.get('cgpa_score', 0) > 0.7:
            reasons.append("excellent academic performance")
        if breakdown.get('jee_rank_score', 0) > 0.7:
            reasons.append("strong entrance exam rank")
        if breakdown.get('academic_score', 0) > 0.6:
            reasons.append("impressive academic achievements")
        if breakdown.get('skills_score', 0) > 0.7:
            reasons.append("relevant technical skills")
        if breakdown.get('projects_score', 0) > 0.6:
            reasons.append("quality academic projects")
        if breakdown.get('interview_score') and breakdown['interview_score'] > 0.7:
            reasons.append("strong interview performance")
        
        if not reasons:
            reasons.append("good overall academic profile")
        
        return f"Recommended based on {', '.join(reasons[:3])} for admission to {college.name}"
    
    def _generate_job_recommendations(
        self, applicant: Applicant, normalized_data: Dict, interview_score: Optional[float]
    ) -> List[Dict]:
        """Generate job recommendations with match scores using skills-focused weights"""
        
        # Get all approved jobs
        jobs = self.db.query(Job).filter(Job.status == 'approved').all()
        
        recommendations = []
        min_score = settings.MIN_JOB_REC_SCORE  # Use job-specific minimum
        
        for job in jobs:
            # Calculate match score with applicant context for location matching
            match_score, breakdown = self._calculate_job_match(
                normalized_data, job, interview_score, applicant
            )
            
            if match_score >= min_score:
                # Get or create recommendation record
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
                        score=match_score,
                        scoring_breakdown=breakdown,
                        explain=explanation
                    )
                    self.db.add(rec)
                else:
                    # Update score
                    rec.score = match_score
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
        self.db.commit()
        
        # Sort by match score and limit
        recommendations.sort(key=lambda x: x['match_score'], reverse=True)
        return recommendations[:settings.MAX_RECOMMENDATIONS]
    
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
        
        # Calculate individual component scores (0-1 scale)
        skills_score = self._calculate_job_skills_match(skills, job)
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
        # If no salary info available, return neutral
        if not job.min_salary and not job.max_salary:
            return 0.7
        
        # For now, jobs with visible salary are preferred
        # Can be enhanced with actual salary expectation matching
        if job.min_salary and job.max_salary:
            return 0.9  # Transparent salary = good match
        
        return 0.6
    
    def _calculate_job_certifications_match(self, certifications: List[Dict], job: Job) -> float:
        """Calculate certification match for job (0-1)"""
        if not certifications:
            # No penalty for missing certifications unless required
            return 0.5
        
        # Check if job has preferred certifications
        job_certs = job.preferred_certifications or []
        if not job_certs:
            # Has certifications but job doesn't require any
            return 0.8 if certifications else 0.5
        
        # Calculate match
        applicant_certs = set()
        for cert in certifications:
            name = cert.get('name', '') if isinstance(cert, dict) else str(cert)
            applicant_certs.add(name.lower())
        
        job_certs_lower = set(c.lower() for c in job_certs)
        matches = len(applicant_certs & job_certs_lower)
        
        if job_certs_lower:
            return min(1.0, matches / len(job_certs_lower) + 0.3)
        
        return 0.7
    
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
