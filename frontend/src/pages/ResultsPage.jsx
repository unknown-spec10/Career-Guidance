import React, { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, User, Mail, Phone, GraduationCap, Briefcase, 
  Award, TrendingUp, AlertTriangle, CheckCircle
} from 'lucide-react'
import api from '../config/api'
import { getApiError } from '../utils/apiError'

export default function ResultsPage() {
  const { applicantId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [data, setData] = useState(location.state?.parseResult || null)
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!data && applicantId) {
      // Fetch data if not provided via navigation state
      fetchResults()
    }
  }, [applicantId])

  const fetchResults = async () => {
    try {
      setLoading(true)
      setError(null)
      // Fixed endpoint: use /api/applicant instead of /api/results
      const response = await api.get(`/api/applicant/${applicantId}`)
      setData(response.data)
    } catch (error) {
      console.error('Error fetching results:', error)
      setError(getApiError(error, 'Failed to load applicant data'))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-pill animate-spin mx-auto mb-4"></div>
          <p className="text-ink-muted">Loading results...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="surface-card p-6 max-w-md">
          <div className="flex items-center space-x-3 text-red-600 mb-4">
            <AlertTriangle className="w-8 h-8" />
            <h2 className="font-display text-title font-semibold text-red-600">Error Loading Results</h2>
          </div>
          <p className="text-ink-muted mb-4">{error}</p>
          <button onClick={() => navigate('/')} className="app-btn-primary w-full">
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  const parsed = data?.parsed_data || {}
  // Parser schema uses `personal_info`; frontend historically used `personal`.
  // Support both keys and provide sensible fallbacks so student views work.
  const personal = parsed.personal || parsed.personal_info || {}
  const education = parsed.education || []
  const skills = parsed.skills || []
  const experience = parsed.experience || []
  const projects = parsed.projects || []
  // Flags may be returned at top-level or inside parsed_data depending on backend.
  const flags = data?.flags || parsed.flags || data?.parse_flags || []
  const needsReview = data?.needs_review || parsed.needs_review || false
  const llm_confidence = parsed.llm_confidence ?? data?.llm_confidence ?? 0

  return (
    <div className="relative pb-8">
      <div className="mx-auto w-full max-w-container-max">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate('/')}
            className="mb-4 inline-flex items-center gap-2 text-caption font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Back to Home</span>
          </button>
          <div className="flex items-center justify-between">
            <h1 className="app-page-title">Resume Analysis Results</h1>
          </div>
        </motion.div>

        {/* Parse Flags Display */}
        {flags && flags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-card bg-amber-50 border border-amber-200 p-6 mb-8"
          >
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 mb-2">Parse Issues Detected</h3>
                <ul className="space-y-1">
                  {flags.map((flag, idx) => (
                    <li key={idx} className="text-caption text-ink-muted flex items-start space-x-2">
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span>{flag}</span>
                    </li>
                  ))}
                </ul>
                {needsReview && (
                  <p className="text-caption text-ink-muted mt-3 italic">
                    Manual review recommended for accuracy
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Personal & Education — sticky rail on lg+ (static below lg where the layout stacks) */}
          <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-6 self-start">
            {/* Personal Information */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="surface-card p-6"
            >
              <div className="flex items-center space-x-2 mb-4">
                <User className="w-5 h-5 text-primary-600" />
                <h2 className="app-section-title">Personal Information</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-caption text-ink-muted">Name</p>
                  <p className="font-medium text-ink">{personal.name || 'N/A'}</p>
                </div>
                {personal.email && (
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-ink-subtle" />
                    <p className="text-caption text-ink">{personal.email}</p>
                  </div>
                )}
                {personal.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-ink-subtle" />
                    <p className="text-caption text-ink">{personal.phone}</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Education */}
            {education.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="surface-card p-6"
              >
                <div className="flex items-center space-x-2 mb-4">
                  <GraduationCap className="w-5 h-5 text-primary-600" />
                  <h2 className="app-section-title">Education</h2>
                </div>
                <div className="space-y-4">
                  {education.map((edu, idx) => (
                    <div key={idx} className="pb-4 border-b border-hairline last:border-0 last:pb-0">
                      <p className="font-medium text-ink">{edu.institution}</p>
                      <p className="text-caption text-ink-muted">{edu.degree}</p>
                      {edu.cgpa && (
                        <div className="flex items-center space-x-2 mt-2">
                          <Award className="w-4 h-4 text-primary-400" />
                          <p className="text-caption text-ink">CGPA: {edu.cgpa}</p>
                        </div>
                      )}
                      {edu.year_start && (
                        <p className="text-caption text-ink-muted mt-1">
                          {edu.year_start} - {edu.year_end || 'Present'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Confidence Score */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="surface-card p-6"
            >
              <div className="flex items-center space-x-2 mb-4">
                <TrendingUp className="w-5 h-5 text-primary-600" />
                <h2 className="app-section-title">Analysis Confidence</h2>
              </div>
              <div className="text-center">
                <div className="font-display text-display-lg font-bold text-primary-400 mb-2">
                  {((llm_confidence || 0) * 100).toFixed(0)}%
                </div>
                <p className="text-caption text-ink-muted">Overall Accuracy</p>
              </div>
            </motion.div>
          </div>

          {/* Right Column - Skills, Experience, Projects */}
          <div className="lg:col-span-2 space-y-6">
            {/* Skills */}
            {skills.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="surface-card p-6"
              >
                <div className="flex items-center space-x-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-primary-600" />
                  <h2 className="app-section-title">Skills</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-surface-sunken border border-hairline rounded-pill text-caption text-ink"
                    >
                      {skill.name}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Experience */}
            {experience.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="surface-card p-6"
              >
                <div className="flex items-center space-x-2 mb-4">
                  <Briefcase className="w-5 h-5 text-primary-600" />
                  <h2 className="app-section-title">Experience</h2>
                </div>
                <div className="space-y-4">
                  {experience.map((exp, idx) => (
                    <div key={idx} className="pb-4 border-b border-hairline last:border-0 last:pb-0">
                      <p className="font-medium text-ink">{exp.title}</p>
                      <p className="text-caption text-ink-muted">{exp.company}</p>
                      <p className="text-caption text-ink-subtle mt-1">{exp.duration}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Projects */}
            {projects.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="surface-card p-6"
              >
                <div className="flex items-center space-x-2 mb-4">
                  <Award className="w-5 h-5 text-primary-600" />
                  <h2 className="app-section-title">Projects</h2>
                </div>
                <div className="space-y-4">
                  {projects.map((project, idx) => (
                    <div key={idx} className="pb-4 border-b border-hairline last:border-0 last:pb-0">
                      <p className="font-medium text-ink">{project.name}</p>
                      <p className="text-caption text-ink-muted mt-1">{project.description}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
