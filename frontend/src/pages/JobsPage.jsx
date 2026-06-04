import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import {
  Briefcase,
  MapPin,
  Clock,
  Award,
  Building2,
  Sparkles,
  Search,
  Loader2,
  CheckCircle,
  AlertTriangle,
  FilterX,
  ArrowRight,
  Check,
} from 'lucide-react'
import { useDebounce } from '../hooks/useDebounce'
import api from '../config/api'
import { DEBOUNCE_DELAYS } from '../config/constants'
import secureStorage from '../utils/secureStorage'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

const normalizeMatchScore = (rawScore) => {
  const numericScore = Number(rawScore)
  if (!Number.isFinite(numericScore)) return null
  if (numericScore <= 1) return numericScore * 100
  if (numericScore > 100) return numericScore / 100
  return numericScore
}

const formatMatchLabel = (percentage) => {
  if (percentage >= 85) return 'Good'
  if (percentage >= 70) return 'Good'
  if (percentage >= 55) return 'Avg'
  return 'Weak'
}

const formatBreakdownLabel = (key) =>
  String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())

const checkSkillMatch = (candidateSkills, requiredSkillName) => {
  if (!candidateSkills || !requiredSkillName) return false
  const reqName = requiredSkillName.toLowerCase().trim()
  return candidateSkills.some(cand => {
    const candName = String(cand).toLowerCase().trim()
    if (candName === reqName) return true
    if (reqName.length >= 3 || candName.length >= 3) {
      try {
        const escapedReq = reqName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
        const escapedCand = candName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
        const regexReq = new RegExp(`\\b${escapedReq}\\b`, 'i')
        const regexCand = new RegExp(`\\b${escapedCand}\\b`, 'i')
        return regexReq.test(candName) || regexCand.test(reqName)
      } catch (e) {
        return candName.includes(reqName) || reqName.includes(candName)
      }
    }
    return false
  })
}

const jobMarkdownComponents = {
  h1: ({ children }) => <h1 className="text-sm font-bold text-slate-900 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold text-slate-900 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-800 mb-1.5">{children}</h3>,
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-inherit">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 ml-4 space-y-1 list-disc text-inherit">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 space-y-1 list-decimal text-inherit">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  code: ({ inline, children }) => {
    if (inline) {
      return <code className="bg-white text-primary-700 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[10px]">{children}</code>
    }

    return (
      <pre className="bg-slate-950 text-slate-100 p-3 rounded-xl overflow-x-auto text-[10px] leading-relaxed border border-slate-800 mb-2">
        <code>{children}</code>
      </pre>
    )
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 underline font-semibold">
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className="border-l-4 border-primary-200 pl-3 italic text-slate-600 mb-2">{children}</blockquote>,
}

export default function JobsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const currentUser = secureStorage.getItem('user')
  const showApplicantFeatures = currentUser?.role === 'student'
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedJob, setSelectedJob] = useState(null)
  const [fetchError, setFetchError] = useState(null)
  const [recommendationMatches, setRecommendationMatches] = useState({})
  const [recommendationDetailsByJobId, setRecommendationDetailsByJobId] = useState({})
  const [appliedJobIds, setAppliedJobIds] = useState(new Set())
  const [applyingId, setApplyingId] = useState(null)
  const [candidateSkills, setCandidateSkills] = useState([])
  const [candidateCity, setCandidateCity] = useState('')

  const pageSize = 9
  const observerTarget = useRef(null)
  const hasMoreRef = useRef(hasMore)
  const loadingRef = useRef(loading)

  const [learningPathState, setLearningPathState] = useState({
    loadingId: null,
    error: null,
    success: null,
    successJobId: null,
    path: null,
  })

  const [filters, setFilters] = useState({
    q: '',
    location: '',
    work_type: '',
    skills: '',
    sort: 'popular',
  })
  const debouncedFilters = useDebounce(filters, DEBOUNCE_DELAYS.FILTER)

  useEffect(() => {
    hasMoreRef.current = hasMore
    loadingRef.current = loading
  }, [hasMore, loading])

  useEffect(() => {
    setPage(1)
    setJobs([])
    setHasMore(true)
  }, [debouncedFilters])

  useEffect(() => {
    fetchJobs()
  }, [page, debouncedFilters])

  useEffect(() => {
    const fetchRecommendationMatches = async () => {
      if (!showApplicantFeatures) {
        setRecommendationMatches({})
        return
      }

      try {
        let applicantId = secureStorage.getItem('db_applicant_id')
        if (!applicantId) {
          const applicantRes = await api.get('/api/student/applicant')
          applicantId = applicantRes.data?.id
          if (applicantId) {
            secureStorage.setItem('db_applicant_id', String(applicantId))
          }
        }

        if (!applicantId) {
          setRecommendationMatches({})
          return
        }

        const recRes = await api.get(`/api/recommendations/${applicantId}`)
        const recs = Array.isArray(recRes.data?.job_recommendations) ? recRes.data.job_recommendations : []

        const nextMatches = {}
        const nextDetails = {}
        recs.forEach((rec) => {
          const jobId = rec?.job?.id
          const score = normalizeMatchScore(rec?.match_score ?? rec?.score ?? null)
          if (Number.isFinite(jobId) && score !== null) {
            nextMatches[jobId] = score
            nextDetails[jobId] = {
              ...rec,
              normalizedScore: score,
            }
          }
        })

        setRecommendationMatches(nextMatches)
        setRecommendationDetailsByJobId(nextDetails)

        // Fetch candidate skills and location
        try {
          const profileResponse = await api.get('/api/student/profile')
          const skillsData = profileResponse.data?.skills || []
          const skillNames = skillsData.map(s => {
            if (typeof s === 'object' && s !== null) {
              return (s.name || s.canonical_name || '').toLowerCase().trim()
            }
            return String(s).toLowerCase().trim()
          })
          setCandidateSkills(skillNames)

          const loc = profileResponse.data?.personal_info?.location || ''
          if (loc) {
            setCandidateCity(loc.split(',')[0].trim().toLowerCase())
          }

          // Double check with applicant details to be robust
          try {
            const applicantRes = await api.get('/api/student/applicant')
            if (applicantRes.data?.location_city) {
              setCandidateCity(applicantRes.data.location_city.trim().toLowerCase())
            }
          } catch (appErr) {
            console.error('Error fetching applicant location city in JobsPage:', appErr)
          }
        } catch (profileErr) {
          console.error('Error fetching student profile details in JobsPage:', profileErr)
        }
      } catch (error) {
        console.error('Error fetching recommendation matches:', error)
        setRecommendationMatches({})
        setRecommendationDetailsByJobId({})
      }
    }

    fetchRecommendationMatches()
  }, [showApplicantFeatures])

  useEffect(() => {
    const fetchAppliedJobs = async () => {
      if (currentUser?.role === 'student') {
        try {
          const response = await api.get('/api/student/applications/jobs')
          const ids = (response.data?.applications || []).map(app => app.job_id)
          setAppliedJobIds(new Set(ids))
        } catch (error) {
          console.error('Error fetching student applications:', error)
        }
      }
    }
    fetchAppliedJobs()
  }, [currentUser?.email])

  const handleApply = async (jobId) => {
    if (!currentUser) {
      navigate('/login')
      return
    }
    if (currentUser.role !== 'student') {
      toast.error('Only students can apply to jobs.')
      return
    }

    setApplyingId(jobId)
    try {
      await api.post(`/api/jobs/${jobId}/apply`, { job_id: jobId })
      toast.success('Successfully applied! Your profile has been shared with the recruiter and a confirmation email has been sent.')
      setAppliedJobIds(prev => new Set([...prev, jobId]))
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to apply'
      toast.error(errorMsg)
    } finally {
      setApplyingId(null)
    }
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current && !loadingRef.current) {
          setPage((p) => p + 1)
        }
      },
      { threshold: 0.01, rootMargin: '200px' }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [])

  const fetchJobs = async () => {
    try {
      setLoading(true)
      setFetchError(null)

      const response = await api.get('/api/jobs', {
        params: {
          skip: (page - 1) * pageSize,
          limit: pageSize,
          q: debouncedFilters.q,
          location: debouncedFilters.location,
          work_type: debouncedFilters.work_type,
          skills: debouncedFilters.skills,
          sort: debouncedFilters.sort,
        },
      })

      const newJobs = response.data?.jobs || response.data || []
      setTotal(response.data?.total || 0)

      if (page === 1) {
        setJobs(newJobs)
      } else {
        setJobs((prev) => [...prev, ...newJobs])
      }

      setHasMore(newJobs.length === pageSize)
    } catch (error) {
      console.error('Error fetching jobs:', error)
      setHasMore(false)
      setFetchError(error?.response?.data?.detail || 'Unable to fetch jobs right now. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateLearningPath = async (job) => {
    if (!job?.id) return

    setLearningPathState({
      loadingId: job.id,
      error: null,
      success: null,
      successJobId: null,
      path: null,
    })

    try {
      const response = await api.post(`/api/jobs/${job.id}/learning-path`)
      const alreadyExists = response?.data?.already_exists

      setLearningPathState({
        loadingId: null,
        error: null,
        success: alreadyExists ? 'Learning path already exists for this job' : 'Learning path generated successfully (2 credits used)',
        successJobId: job.id,
        path: response.data,
      })
    } catch (error) {
      const detail = error?.response?.data?.detail || 'Failed to generate learning path'
      const status = error?.response?.status
      if (status === 402) {
        setLearningPathState({ loadingId: null, error: 'Insufficient credits. ' + detail, success: null, successJobId: null, path: null })
      } else {
        setLearningPathState({ loadingId: null, error: detail, success: null, successJobId: null, path: null })
      }
    }
  }

  const resetFilters = () => {
    setFilters({
      q: '',
      location: '',
      work_type: '',
      skills: '',
      sort: 'popular',
    })
  }

  const updateFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const removeFilter = (key) => {
    const defaults = {
      q: '',
      location: '',
      work_type: '',
      skills: '',
      sort: 'popular',
    }
    setFilters((prev) => ({
      ...prev,
      [key]: defaults[key],
    }))
  }

  const activeFilterCount = [filters.q, filters.location, filters.work_type, filters.skills].filter(Boolean).length

  const JobCard = ({ job }) => {
    const matchPercentage = showApplicantFeatures
      ? recommendationMatches[job.id]
      : null

    const hasMatchData = Number.isFinite(matchPercentage)

    const getMatchColor = (percentage) => {
      if (percentage >= 85) return 'bg-green-600'
      if (percentage >= 70) return 'bg-primary-600'
      if (percentage >= 55) return 'bg-yellow-600'
      return 'bg-gray-500'
    }

    const handleOpenDetails = async () => {
      try {
        const response = await api.get(`/api/job/${job.id}`)
        setSelectedJob(response.data.job)
      } catch (error) {
        console.error('Error fetching job details:', error)
        setSelectedJob(job)
      }
    }

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="p-6 bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-100 hover:border-primary-200/80 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(15,23,42,0.06)] hover:-translate-y-1 flex flex-col h-full relative overflow-hidden group"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-primary-500 group-hover:via-indigo-500 group-hover:to-purple-500 transition-all duration-300" />

        <div className="flex justify-between items-start mb-3 gap-4">
          <div className="flex-1 mr-2">
            <div className="flex items-start gap-3 mb-1.5">
              <div className="w-11 h-11 bg-primary-50 border border-primary-100 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <Briefcase className="w-5 h-5 text-primary-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg leading-tight mb-1 text-slate-900 group-hover:text-primary-900 transition-colors line-clamp-2">{job.title}</h3>
                <p className="text-sm font-semibold text-slate-500">{job.company}</p>
              </div>
            </div>
          </div>

          {showApplicantFeatures && hasMatchData && (
            <div className={`${getMatchColor(matchPercentage)} text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-sm flex-shrink-0`}>
              {formatMatchLabel(matchPercentage)}
            </div>
          )}
        </div>

        {(() => {
          const rec = recommendationDetailsByJobId[job.id] || null
          const userCity = candidateCity || ''
          const jobCity = (job.location_city || '').toLowerCase().trim()
          const isCityMatched = userCity && jobCity && (userCity.includes(jobCity) || jobCity.includes(userCity))
          
          const showLocGreen = isCityMatched || (!job.location_city && job.work_type === 'remote')
          const showWorkTypeGreen = job.work_type === 'remote' || job.work_type === 'hybrid'
          const isExpMatched = (rec?.scoring_breakdown?.experience_fit ?? 0) >= 0.5
          const isCgpaMatched = (rec?.scoring_breakdown?.academic_score ?? 0) >= 0.5

          return (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                  showLocGreen 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                    : 'bg-slate-50 border-slate-100 text-slate-600'
                }`}>
                  <MapPin className={`w-3.5 h-3.5 ${showLocGreen ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span>{job.location_city || 'Remote'}{job.location_state ? `, ${job.location_state}` : ''}</span>
                </div>
                <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium capitalize transition-all ${
                  showWorkTypeGreen 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                    : 'bg-slate-50 border-slate-100 text-slate-600'
                }`}>
                  <Clock className={`w-3.5 h-3.5 ${showWorkTypeGreen ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span>{job.work_type || 'Full-time'}</span>
                </div>
                {job.min_experience_years !== null && job.min_experience_years !== undefined && (
                  <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                    isExpMatched 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                      : 'bg-slate-50 border-slate-100 text-slate-600'
                  }`}>
                    <Sparkles className={`w-3.5 h-3.5 ${isExpMatched ? 'text-emerald-500' : 'text-slate-400'}`} />
                    <span>{job.min_experience_years}+ years</span>
                  </div>
                )}
                {job.min_cgpa && (
                  <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                    isCgpaMatched 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                      : 'bg-slate-50 border-slate-100 text-slate-600'
                  }`}>
                    <Award className={`w-3.5 h-3.5 ${isCgpaMatched ? 'text-emerald-500' : 'text-slate-400'}`} />
                    <span>CGPA {job.min_cgpa}+</span>
                  </div>
                )}
              </div>

              {/* Job Skills Section directly inside the card */}
              {(() => {
                const explicit = Array.isArray(job.required_skills) && job.required_skills.length > 0
                const matched = rec?.scoring_breakdown?.skills_breakdown?.matched_skills || []
                const partial = rec?.scoring_breakdown?.skills_breakdown?.partial_matches || []
                const fallbackSkills = [...new Set([...matched, ...partial])]
                const skillsToRender = explicit ? job.required_skills.slice(0, 3) : fallbackSkills.slice(0, 3)
                
                if (!skillsToRender || skillsToRender.length === 0) return null
                
                return (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {skillsToRender.map((skill, idx) => {
                      const skillName = typeof skill === 'string' ? skill : skill?.name || skill?.skill || `Skill ${idx + 1}`
                      const reqName = skillName.toLowerCase().trim()
                      const isMatched = checkSkillMatch(candidateSkills, reqName) ||
                                        matched.some(m => checkSkillMatch([m], reqName)) ||
                                        partial.some(p => checkSkillMatch([p], reqName))
                      return (
                        <span
                          key={`${skillName}-${idx}`}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border transition-all inline-flex items-center ${
                            isMatched 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                              : 'bg-slate-50 border-slate-100 text-slate-500'
                          }`}
                        >
                          {isMatched && <Check className="w-2.5 h-2.5 mr-0.5 text-emerald-600 flex-shrink-0" />}
                          {skillName}
                        </span>
                      )
                    })}
                  </div>
                )
              })()}
            </>
          )
        })()}

        {rec?.is_fallback && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
              <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
              Rule-based match · AI unavailable
            </span>
          </div>
        )}

        {job.description && (
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6 bg-slate-50/50 rounded-xl p-3 border border-slate-100 line-clamp-4 overflow-hidden">
            <ReactMarkdown components={jobMarkdownComponents}>
              {job.description}
            </ReactMarkdown>
          </div>
        )}

        {(job.min_salary || job.max_salary) && (
          <div className="mb-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Salary Range</p>
            <p className="text-sm font-bold text-primary-600">
              {job.min_salary ? `INR ${(job.min_salary / 100000).toFixed(1)}L` : 'Competitive'}
              {job.max_salary ? ` - INR ${(job.max_salary / 100000).toFixed(1)}L` : ''}
            </p>
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-2">
          <div className="flex gap-2 w-full">
            <button
              onClick={handleOpenDetails}
              className="flex-1 py-2 px-3 text-xs font-bold border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-700 active:scale-95 duration-200"
            >
              Details
            </button>

            {appliedJobIds.has(job.id) ? (
              <button
                disabled
                className="flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-not-allowed text-center flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                Applied
              </button>
            ) : (
              <button
                onClick={() => handleApply(job.id)}
                disabled={applyingId === job.id}
                className="flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all active:scale-95 duration-200 bg-primary-600 hover:bg-primary-700 text-white shadow-sm shadow-primary-500/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {applyingId === job.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  'Easy Apply'
                )}
              </button>
            )}
          </div>

          {!showApplicantFeatures && (
            <button
              onClick={handleOpenDetails}
              className="text-[9px] text-primary-600 font-extrabold hover:underline self-center pt-0.5"
            >
              View full job details
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Browse Jobs</h1>
          <p className="text-gray-600">Discover opportunities that match your skills and goals.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Search and filter</p>
              <p className="text-xs text-gray-500">Refine the job list with keyword, location, type, skill, and sort controls.</p>
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Keyword, title, or company"
                value={filters.q}
                onChange={(e) => updateFilter('q', e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-10 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
              />
            </div>

            <div className="relative">
              <MapPin className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Location"
                value={filters.location}
                onChange={(e) => updateFilter('location', e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
              />
            </div>

            <select
              value={filters.work_type}
              onChange={(e) => updateFilter('work_type', e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
            >
              <option value="">All Work Types</option>
              <option value="remote">Remote</option>
              <option value="on-site">On-site</option>
              <option value="hybrid">Hybrid</option>
            </select>

            <input
              type="text"
              placeholder="Skills (React, Python)"
              value={filters.skills}
              onChange={(e) => updateFilter('skills', e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
            />

            <select
              value={filters.sort}
              onChange={(e) => updateFilter('sort', e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
            >
              <option value="popular">Sort: Popular</option>
              <option value="recent">Sort: Recent</option>
              <option value="title">Sort: A-Z</option>
            </select>
          </div>

          {activeFilterCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {filters.q && (
                <button onClick={() => removeFilter('q')} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-xs font-medium hover:bg-primary-100">
                  Keyword: {filters.q}
                  <span aria-hidden="true">×</span>
                </button>
              )}
              {filters.location && (
                <button onClick={() => removeFilter('location')} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-xs font-medium hover:bg-primary-100">
                  Location: {filters.location}
                  <span aria-hidden="true">×</span>
                </button>
              )}
              {filters.work_type && (
                <button onClick={() => removeFilter('work_type')} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-xs font-medium hover:bg-primary-100">
                  Type: {filters.work_type}
                  <span aria-hidden="true">×</span>
                </button>
              )}
              {filters.skills && (
                <button onClick={() => removeFilter('skills')} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-xs font-medium hover:bg-primary-100">
                  Skills: {filters.skills}
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-gray-500">
              Filters update automatically as you type.
            </div>

            <div className="flex items-center gap-2">
              {showApplicantFeatures && (
                <Link
                  to="/dashboard/learning-paths"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:border-primary-400 hover:text-primary-700 transition-colors"
                >
                  Learning Paths
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              <button
                onClick={resetFilters}
                disabled={activeFilterCount === 0}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FilterX className="w-4 h-4" />
                Reset Filters
              </button>
            </div>
          </div>
        </motion.div>

        {(fetchError || learningPathState.error) && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>{fetchError || learningPathState.error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </AnimatePresence>
        </div>

        {loading && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-72 bg-gray-100 border border-gray-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        <div ref={observerTarget} className="mt-12 text-center">
          {!hasMore && jobs.length > 0 && (
            <p className="text-gray-600">No more jobs to load</p>
          )}
        </div>

        {!loading && jobs.length === 0 && !fetchError && (
          <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-10 text-center">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900">No Results Found</h3>
            <p className="text-gray-600 mt-2">Try adjusting your filters or clearing them to broaden results.</p>
            <button
              onClick={resetFilters}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <FilterX className="w-4 h-4" />
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedJob && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedJob(null)}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/95 backdrop-blur-md rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-[0_30px_80px_rgba(15,23,42,0.22)] border border-slate-100"
            >
              {(() => {
                const recommendation = recommendationDetailsByJobId[selectedJob.id] || null
                const normalizedScore = recommendation?.normalizedScore ?? null
                const explanationText = recommendation?.explain
                const breakdownEntries = recommendation?.scoring_breakdown && typeof recommendation.scoring_breakdown === 'object'
                  ? Object.entries(recommendation.scoring_breakdown).filter(([, value]) => value !== null && value !== undefined)
                  : []

                const explanationLines = Array.isArray(explanationText)
                  ? explanationText.filter(Boolean)
                  : typeof explanationText === 'string'
                    ? explanationText.split(/\n+/).map((line) => line.trim()).filter(Boolean)
                    : []

                return null
              })()}
              <div className="sticky top-0 z-10 relative overflow-hidden border-b border-slate-100 bg-white/90 p-6 flex items-start justify-between gap-4">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-50/70 via-white/90 to-sky-50/70" />
                <div className="relative flex-1">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-700 mb-3">
                    <Building2 className="w-3.5 h-3.5" />
                    Job Details
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 mb-2 tracking-tight">{selectedJob.title}</h2>
                  <p className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary-500" />
                    {selectedJob.company}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="relative text-slate-500 hover:text-slate-900 hover:bg-white/80 border border-slate-200 bg-white/60 p-2.5 rounded-xl transition-all flex-shrink-0 shadow-sm"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-6 bg-slate-50/30">
                {(() => {
                  const recommendation = recommendationDetailsByJobId[selectedJob.id] || null
                  const normalizedScore = recommendation?.normalizedScore ?? null
                  const explanationText = recommendation?.explanation || recommendation?.explain
                  const breakdownEntries = recommendation?.scoring_breakdown && typeof recommendation.scoring_breakdown === 'object'
                    ? Object.entries(recommendation.scoring_breakdown).filter(([, value]) => value !== null && value !== undefined)
                    : []

                  const explanationLines = recommendation?.explanation
                    ? [recommendation.explanation]
                    : Array.isArray(explanationText)
                      ? explanationText.filter(Boolean)
                      : typeof explanationText === 'string'
                        ? explanationText.split(/\n+/).map((line) => line.trim()).filter(Boolean)
                        : typeof explanationText === 'object' && explanationText !== null
                          ? (explanationText.reasons || [explanationText.summary || '']).filter(Boolean)
                          : []

                  return (
                    <div className={`border rounded-2xl p-5 space-y-4 ${recommendation?.is_fallback ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className={`text-xs font-semibold uppercase tracking-wide ${recommendation?.is_fallback ? 'text-amber-600' : 'text-slate-500'}`}>
                              {recommendation?.is_fallback ? 'Rule-based Match' : 'Recommendation'}
                            </p>
                            {recommendation?.is_fallback && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-700">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                AI unavailable
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">Why this job is recommended</h3>
                        </div>
                        {normalizedScore !== null && (
                          <div className={`px-3 py-1 rounded-full text-xs font-bold text-white ${normalizedScore >= 85 ? 'bg-green-600' : normalizedScore >= 70 ? 'bg-primary-600' : normalizedScore >= 55 ? 'bg-yellow-600' : 'bg-gray-500'}`}>
                            {formatMatchLabel(normalizedScore)} Match
                          </div>
                        )}
                      </div>

                      {explanationLines.length > 0 ? (
                        <ul className="space-y-2">
                          {explanationLines.slice(0, 4).map((line, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-600">
                          This role is aligned with your skills, location, and experience profile.
                        </p>
                      )}

                      {breakdownEntries.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          {breakdownEntries.slice(0, 6).map(([key, value]) => (
                            <div key={key} className="rounded-xl border border-slate-200 bg-white p-3">
                              <p className="text-[11px] uppercase tracking-wide text-gray-500">{formatBreakdownLabel(key)}</p>
                              <p className="mt-1 text-sm font-semibold text-gray-900 break-words">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {
                        // Render key skills: prefer explicit job.required_skills, fallback to recommendation matched/partial skills
                        (() => {
                          const recommendation = recommendationDetailsByJobId[selectedJob.id] || null
                          const explicit = Array.isArray(selectedJob.required_skills) && selectedJob.required_skills.length > 0
                          const matched = recommendation?.scoring_breakdown?.skills_breakdown?.matched_skills || []
                          const partial = recommendation?.scoring_breakdown?.skills_breakdown?.partial_matches || []
                          const fallbackSkills = [...new Set([...matched, ...partial])]
                          const skillsToRender = explicit ? selectedJob.required_skills.slice(0, 8) : fallbackSkills.slice(0, 8)

                          if (!skillsToRender || skillsToRender.length === 0) {
                            return (
                              <div className="rounded-lg border border-yellow-100 bg-yellow-50 p-4">
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 text-sm text-yellow-800">
                                    <div className="font-medium">No role-specific skills available</div>
                                    <div className="text-xs text-yellow-800/90 mt-1">We couldn't find explicit skills for this job. You can re-run recommendations or update your profile to surface skill matches.</div>
                                    <div className="mt-3 flex gap-2">
                                      <button onClick={async () => {
                                        const applicantId = secureStorage.getItem('db_applicant_id')
                                        if (applicantId) await api.post(`/api/applicant/${applicantId}/generate-recommendations`)
                                      }} className="px-3 py-1 bg-yellow-100 border border-yellow-200 rounded text-yellow-800 text-xs">Re-run Recommendations</button>
                                      <Link to="/student/profile" className="px-3 py-1 bg-white border border-gray-200 rounded text-xs text-gray-700">Update Profile</Link>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          }

                          return (
                            <div>
                              <h3 className="text-sm font-semibold text-gray-700">Key Skills</h3>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {skillsToRender.map((skill, idx) => {
                                  const skillName = typeof skill === 'string' ? skill : (skill?.name || skill?.skill || `Skill ${idx+1}`)
                                  const reqName = skillName.toLowerCase().trim()
                                  const isMatched = checkSkillMatch(candidateSkills, reqName) ||
                                                    matched.some(m => checkSkillMatch([m], reqName)) ||
                                                    partial.some(p => checkSkillMatch([p], reqName))
                                  return (
                                    <span
                                      key={`${skill}-${idx}`}
                                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all inline-flex items-center ${
                                        isMatched
                                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm'
                                          : 'bg-primary-50 border-primary-100 text-primary-700'
                                      }`}
                                    >
                                      {isMatched && <Check className="w-3 h-3 mr-1 text-emerald-600 flex-shrink-0" />}
                                      {skillName}
                                    </span>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })()
                      }
                    </div>
                  )
                })()}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {selectedJob.location_city && selectedJob.location_state && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-5 h-5 text-blue-500" />
                        <span className="text-sm text-gray-600">Location</span>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{selectedJob.location_city}, {selectedJob.location_state}</p>
                    </div>
                  )}
                  {selectedJob.work_type && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-gray-600">Work Type</span>
                      </div>
                      <p className="text-sm font-bold text-gray-900 capitalize">{selectedJob.work_type}</p>
                    </div>
                  )}
                  {selectedJob.min_experience_years !== null && selectedJob.min_experience_years !== undefined && selectedJob.min_experience_years > 0 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        <span className="text-sm text-gray-600">Experience</span>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{selectedJob.min_experience_years}+ years</p>
                    </div>
                  )}
                  {selectedJob.min_cgpa && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Award className="w-5 h-5 text-amber-500" />
                        <span className="text-sm text-gray-600">Min CGPA</span>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{selectedJob.min_cgpa}</p>
                    </div>
                  )}
                  {selectedJob.expires_at && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-red-500" />
                        <span className="text-sm text-gray-600">Expires</span>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{new Date(selectedJob.expires_at).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>

                {selectedJob.description && (
                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-3">About This Role</h3>
                    <div className="text-slate-600 leading-relaxed">
                      <ReactMarkdown components={jobMarkdownComponents}>
                        {selectedJob.description}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                <div className="bg-white/90 border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Useful next steps</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Open the job application, review the required skills, and generate a learning path if you want a gap-focused plan before applying.
                  </p>
                </div>

                {learningPathState.success && learningPathState.successJobId === selectedJob.id && (
                  <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 px-4 py-3 rounded-xl shadow-sm mt-3 animate-fade-in">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="font-semibold">{learningPathState.success}</span>
                  </div>
                )}

                {learningPathState.error && learningPathState.successJobId === selectedJob.id && (
                  <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 px-4 py-3 rounded-xl shadow-sm mt-3 animate-fade-in">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <span className="font-semibold">{learningPathState.error}</span>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur-md border-t border-slate-100 p-6 flex gap-3 shadow-[0_-8px_30px_rgba(15,23,42,0.06)]">
                {appliedJobIds.has(selectedJob.id) ? (
                  <button
                    disabled
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-xl cursor-not-allowed text-center shadow-sm"
                  >
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    Applied
                  </button>
                ) : (
                  <button
                    onClick={() => handleApply(selectedJob.id)}
                    disabled={applyingId === selectedJob.id}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-center shadow-md shadow-primary-600/10"
                  >
                    {applyingId === selectedJob.id ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      'Apply Now'
                    )}
                  </button>
                )}
                {showApplicantFeatures && (
                  <button
                    onClick={() => {
                      handleGenerateLearningPath(selectedJob)
                    }}
                    disabled={learningPathState.loadingId === selectedJob.id}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-60 transition-colors shadow-sm"
                  >
                    {learningPathState.loadingId === selectedJob.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Path...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate Learning Path
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setSelectedJob(null)}
                  className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors bg-white shadow-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
