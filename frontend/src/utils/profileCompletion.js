const PERSONAL_INFO_WEIGHT = 25
const ACADEMIC_WEIGHT = 20
const SKILLS_WEIGHT = 30
const EXPERIENCE_WEIGHT = 15
const PROJECTS_WEIGHT = 5
const CERTIFICATIONS_WEIGHT = 5

const isFilled = (value) => {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim().length > 0
  return Boolean(value)
}

const normalizeList = (value) => (Array.isArray(value) ? value : [])

const getPersonalInfo = (profileData) => {
  const data = profileData || {}
  const personalInfo = data.personal_info && typeof data.personal_info === 'object'
    ? data.personal_info
    : {}

  return {
    name: personalInfo.name || data.full_name || data.name || data.display_name || '',
    email: personalInfo.email || data.email || '',
    phone: personalInfo.phone || data.phone || '',
    location: personalInfo.location || data.location || data.location_city || '',
  }
}

const scoreFromPresence = (items, weight) => {
  const filledCount = items.filter(isFilled).length
  if (filledCount === 0) return 0
  return Math.min((filledCount / items.length) * weight, weight)
}

const scoreFromCount = (count, weight, maxCount) => {
  if (!count) return 0
  return Math.min((count / maxCount) * weight, weight)
}

export const calculateProfileCompletion = (profileData) => {
  const data = profileData || {}
  const personalInfo = getPersonalInfo(data)
  const skills = normalizeList(data.skills)
  const education = normalizeList(data.education)
  const experience = normalizeList(data.experience)
  const projects = normalizeList(data.projects)
  const certifications = normalizeList(data.certifications)

  const personalScore = scoreFromPresence([
    personalInfo.name,
    personalInfo.email,
    personalInfo.phone,
    personalInfo.location,
  ], PERSONAL_INFO_WEIGHT)

  const academicFields = [
    education.length > 0,
    isFilled(data.cgpa),
    isFilled(data.jee_rank),
  ]
  const academicScore = scoreFromPresence(academicFields, ACADEMIC_WEIGHT)

  const skillsScore = scoreFromCount(Math.min(skills.length, 10), SKILLS_WEIGHT, 10)
  const experienceScore = scoreFromCount(Math.min(experience.length, 2), EXPERIENCE_WEIGHT, 2)
  const projectsScore = scoreFromCount(Math.min(projects.length, 2), PROJECTS_WEIGHT, 2)
  const certificationsScore = scoreFromCount(Math.min(certifications.length, 1), CERTIFICATIONS_WEIGHT, 1)

  const total = personalScore + academicScore + skillsScore + experienceScore + projectsScore + certificationsScore
  return Math.max(0, Math.min(100, Math.round(total)))
}

export const getProfileCompletionDetails = (profileData) => {
  const data = profileData || {}
  return {
    personalInfo: getPersonalInfo(data),
    skills: normalizeList(data.skills),
    education: normalizeList(data.education),
    experience: normalizeList(data.experience),
    projects: normalizeList(data.projects),
    certifications: normalizeList(data.certifications),
    completion: calculateProfileCompletion(data),
  }
}