import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { 
  ArrowLeft, Briefcase, MapPin, Clock, TrendingUp, Award, Building2, ExternalLink,
  Check, AlertCircle, Loader2, CheckCircle
} from 'lucide-react'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

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

export default function JobDetailsPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [candidateSkills, setCandidateSkills] = useState([])
  const [hasApplied, setHasApplied] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    fetchData()
  }, [jobId])

  const fetchData = async () => {
    try {
      const response = await api.get(`/api/job/${jobId}`)
      setData(response.data)

      const user = secureStorage.getItem('user')
      if (user?.role === 'student') {
        const profileResponse = await api.get('/api/student/profile')
        const skillsData = profileResponse.data?.skills || []
        const skillNames = skillsData.map(s => {
          if (typeof s === 'object' && s !== null) {
            return (s.name || s.canonical_name || '').toLowerCase().trim()
          }
          return String(s).toLowerCase().trim()
        })
        setCandidateSkills(skillNames)

        // Fetch applications to check if already applied
        try {
          const appResponse = await api.get('/api/student/applications/jobs')
          const apps = appResponse.data?.applications || []
          const alreadyApplied = apps.some(app => app.job_id === Number(jobId))
          setHasApplied(alreadyApplied)
        } catch (appErr) {
          console.error('Error fetching applications for check:', appErr)
        }
      }
    } catch (error) {
      console.error('Error fetching job:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    const user = secureStorage.getItem('user')
    if (!user) {
      navigate('/login')
      return
    }
    if (user.role !== 'student') {
      toast.error('Only students can apply to jobs.')
      return
    }

    setApplying(true)
    try {
      await api.post(`/api/jobs/${jobId}/apply`, { job_id: Number(jobId) })
      toast.success('Successfully applied! Your profile has been shared with the recruiter and a confirmation email has been sent.')
      setHasApplied(true)
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to apply'
      toast.error(errorMsg)
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const job = data?.job
  const employer = data?.employer
  const metadata = data?.metadata

  const user = secureStorage.getItem('user')
  const isStudent = user?.role === 'student'

  const matchedCount = job?.required_skills?.filter(skill => {
    const reqName = (typeof skill === 'object' && skill !== null)
      ? (skill.name || '').toLowerCase().trim()
      : String(skill).toLowerCase().trim()
    return checkSkillMatch(candidateSkills, reqName)
  }).length || 0
  
  const totalCount = job?.required_skills?.length || 0

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate('/jobs')}
            className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors duration-200 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Jobs</span>
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6">
            {/* Job Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="card"
            >
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                <Briefcase className="w-8 h-8 text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-center mb-2">{job?.title}</h1>
              
              {employer && (
                <div className="text-center mb-4">
                  <p className="text-lg text-gray-400">{employer.company_name}</p>
                  {employer.website && (
                    <a
                      href={employer.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-sm text-primary-400 hover:text-primary-300 transition-colors mt-2"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Company Website</span>
                    </a>
                  )}
                </div>
              )}
              
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-2 text-gray-400">
                  <MapPin className="w-4 h-4" />
                  <span>{job?.location_city}</span>
                </div>
                
                <div className="flex items-center space-x-2 text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span className="capitalize">{job?.work_type}</span>
                </div>

                {job?.min_experience_years > 0 && (
                  <div className="flex items-center space-x-2 text-gray-400">
                    <TrendingUp className="w-4 h-4" />
                    <span>{job.min_experience_years}+ years experience</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Requirements */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="card"
            >
              <div className="flex items-center space-x-2 mb-4">
                <Award className="w-5 h-5 text-primary-400" />
                <h2 className="text-xl font-semibold">Requirements</h2>
              </div>
              <div className="space-y-3">
                {job?.min_cgpa && (
                  <div>
                    <p className="text-sm text-gray-400">Min CGPA</p>
                    <p className="text-lg font-semibold text-primary-400">{job.min_cgpa}</p>
                  </div>
                )}
                {job?.expires_at && (
                  <div>
                    <p className="text-sm text-gray-400">Application Deadline</p>
                    <p className="text-sm text-white">
                      {new Date(job.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Employer Info */}
            {employer && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="card"
              >
                <div className="flex items-center space-x-2 mb-4">
                  <Building2 className="w-5 h-5 text-primary-400" />
                  <h2 className="text-xl font-semibold">About Company</h2>
                </div>
                <div className="space-y-2">
                  <p className="font-semibold">{employer.company_name}</p>
                  {employer.location_city && (
                    <p className="text-sm text-gray-400">Based in {employer.location_city}</p>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card"
            >
              <h2 className="text-2xl font-bold mb-4 text-slate-900">Job Description</h2>
              <div className="text-slate-650 text-sm leading-relaxed bg-slate-50/50 rounded-2xl p-5 border border-slate-100/80">
                <ReactMarkdown components={jobMarkdownComponents}>
                  {job?.description || 'No description available.'}
                </ReactMarkdown>
              </div>
            </motion.div>

            {/* Required Skills */}
            {job?.required_skills && job.required_skills.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="card"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Required Skills</h2>
                  {isStudent && totalCount > 0 && (
                    <span className="text-sm font-semibold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
                      {matchedCount} / {totalCount} Matched
                    </span>
                  )}
                </div>

                {isStudent && (
                  <div className="flex items-center space-x-4 mb-4 text-xs">
                    <span className="flex items-center text-emerald-600 font-medium">
                      <Check className="w-4 h-4 mr-1 text-emerald-600 flex-shrink-0" /> Matched Skill
                    </span>
                    <span className="flex items-center text-gray-500 font-medium">
                      <AlertCircle className="w-4 h-4 mr-1 text-gray-400 flex-shrink-0" /> Missing Skill
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2.5">
                  {job.required_skills.map((skill, idx) => {
                    const skillName = (typeof skill === 'object' && skill !== null)
                      ? (skill.name || '')
                      : String(skill)
                    const skillLevel = (typeof skill === 'object' && skill !== null)
                      ? skill.level
                      : null
                    
                    const reqName = skillName.toLowerCase().trim()
                    const matched = isStudent && checkSkillMatch(candidateSkills, reqName)
                    
                    return (
                      <span
                        key={idx}
                        className={`inline-flex items-center px-3 py-2 border rounded-lg text-sm font-medium transition-all ${
                          !isStudent 
                            ? 'bg-primary-50 border-primary-100 text-primary-700' 
                            : matched
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm'
                              : 'bg-gray-50 border-gray-200 text-gray-500'
                        }`}
                      >
                        {isStudent && (
                          matched 
                            ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600 flex-shrink-0" />
                            : <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-gray-400 flex-shrink-0" />
                        )}
                        <span>{skillName}</span>
                        {skillLevel && (
                          <span className="ml-1.5 text-xs opacity-80 font-normal">({skillLevel})</span>
                        )}
                      </span>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* Optional Skills */}
            {job?.optional_skills && job.optional_skills.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="card"
              >
                <h2 className="text-xl font-semibold mb-4">Nice to Have</h2>
                <div className="flex flex-wrap gap-2">
                  {job.optional_skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Tags */}
            {metadata?.tags && metadata.tags.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="card"
              >
                <h2 className="text-xl font-semibold mb-4">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {metadata.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-green-900/30 border border-green-500/30 rounded-full text-sm text-green-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Apply Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              {hasApplied ? (
                <button
                  disabled
                  className="w-full text-lg py-4 bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold rounded-lg cursor-not-allowed text-center flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  Applied for this Position
                </button>
              ) : (
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="btn-primary w-full text-lg py-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {applying ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    'Apply for this Position'
                  )}
                </button>
              )}
            </motion.div>
          </div>
        </div>
      </div>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
