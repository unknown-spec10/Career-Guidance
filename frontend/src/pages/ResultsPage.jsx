import React, { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, User, Mail, Phone, GraduationCap, Briefcase, 
  Award, TrendingUp, AlertTriangle, CheckCircle, Download
} from 'lucide-react'
import api from '../config/api'

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
      setError(error.response?.data?.detail || 'Failed to load applicant data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading results...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="card max-w-md">
          <div className="flex items-center space-x-3 text-red-400 mb-4">
            <AlertTriangle className="w-8 h-8" />
            <h2 className="text-xl font-semibold">Error Loading Results</h2>
          </div>
          <p className="text-gray-400 mb-4">{error}</p>
          <button onClick={() => navigate('/')} className="btn-primary w-full">
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  const parsed = data?.parsed_data || {}
  const personal = parsed.personal || {}
  const education = parsed.education || []
  const skills = parsed.skills || []
  const experience = parsed.experience || []
  const projects = parsed.projects || []
  const flags = data?.flags || []
  const needsReview = data?.needs_review || false

  return (
    <div className="min-h-screen bg-dark-900 pt-24 pb-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors duration-200 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl md:text-4xl font-bold">Resume Analysis Results</h1>
            <button className="btn-secondary flex items-center space-x-2">
              <Download className="w-5 h-5" />
              <span>Export Report</span>
            </button>
          </div>
        </motion.div>

        {/* Parse Flags Display */}
        {flags && flags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card bg-yellow-900/20 border-yellow-500/30 mb-8"
          >
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-400 mb-2">Parse Issues Detected</h3>
                <ul className="space-y-1">
                  {flags.map((flag, idx) => (
                    <li key={idx} className="text-sm text-gray-400 flex items-start space-x-2">
                      <span className="text-yellow-400 mt-0.5">•</span>
                      <span>{flag}</span>
                    </li>
                  ))}
                </ul>
                {needsReview && (
                  <p className="text-sm text-gray-400 mt-3 italic">
                    Manual review recommended for accuracy
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Personal & Education */}
          <div className="lg:col-span-1 space-y-6">
            {/* Personal Information */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="card"
            >
              <div className="flex items-center space-x-2 mb-4">
                <User className="w-5 h-5 text-primary-400" />
                <h2 className="text-xl font-semibold">Personal Information</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-400">Name</p>
                  <p className="font-medium">{personal.name || 'N/A'}</p>
                </div>
                {personal.email && (
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <p className="text-sm">{personal.email}</p>
                  </div>
                )}
                {personal.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <p className="text-sm">{personal.phone}</p>
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
                className="card"
              >
                <div className="flex items-center space-x-2 mb-4">
                  <GraduationCap className="w-5 h-5 text-primary-400" />
                  <h2 className="text-xl font-semibold">Education</h2>
                </div>
                <div className="space-y-4">
                  {education.map((edu, idx) => (
                    <div key={idx} className="pb-4 border-b border-dark-700 last:border-0 last:pb-0">
                      <p className="font-medium">{edu.institution}</p>
                      <p className="text-sm text-gray-400">{edu.degree}</p>
                      {edu.cgpa && (
                        <div className="flex items-center space-x-2 mt-2">
                          <Award className="w-4 h-4 text-primary-400" />
                          <p className="text-sm">CGPA: {edu.cgpa}</p>
                        </div>
                      )}
                      {edu.year_start && (
                        <p className="text-sm text-gray-400 mt-1">
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
              className="card"
            >
              <div className="flex items-center space-x-2 mb-4">
                <TrendingUp className="w-5 h-5 text-primary-400" />
                <h2 className="text-xl font-semibold">Analysis Confidence</h2>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-primary-400 mb-2">
                  {((data?.llm_confidence || 0) * 100).toFixed(0)}%
                </div>
                <p className="text-sm text-gray-400">Overall Accuracy</p>
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
                className="card"
              >
                <div className="flex items-center space-x-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-primary-400" />
                  <h2 className="text-xl font-semibold">Skills</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-primary-900/30 border border-primary-500/30 rounded-full text-sm text-primary-300"
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
                className="card"
              >
                <div className="flex items-center space-x-2 mb-4">
                  <Briefcase className="w-5 h-5 text-primary-400" />
                  <h2 className="text-xl font-semibold">Experience</h2>
                </div>
                <div className="space-y-4">
                  {experience.map((exp, idx) => (
                    <div key={idx} className="pb-4 border-b border-dark-700 last:border-0 last:pb-0">
                      <p className="font-medium">{exp.title}</p>
                      <p className="text-sm text-gray-400">{exp.company}</p>
                      <p className="text-sm text-gray-500 mt-1">{exp.duration}</p>
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
                className="card"
              >
                <div className="flex items-center space-x-2 mb-4">
                  <Award className="w-5 h-5 text-primary-400" />
                  <h2 className="text-xl font-semibold">Projects</h2>
                </div>
                <div className="space-y-4">
                  {projects.map((project, idx) => (
                    <div key={idx} className="pb-4 border-b border-dark-700 last:border-0 last:pb-0">
                      <p className="font-medium">{project.name}</p>
                      <p className="text-sm text-gray-400 mt-1">{project.description}</p>
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
