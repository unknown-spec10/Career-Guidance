import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Briefcase, MapPin, Clock, TrendingUp, Award, Building2, ExternalLink 
} from 'lucide-react'
import api from '../config/api'

export default function JobDetailsPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [jobId])

  const fetchData = async () => {
    try {
      const response = await api.get(`/api/job/${jobId}`)
      setData(response.data)
    } catch (error) {
      console.error('Error fetching job:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const job = data?.job
  const employer = data?.employer
  const metadata = data?.metadata

  return (
    <div className="min-h-screen bg-dark-900 pt-24 pb-12">
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
              
              <div className="space-y-3 pt-4 border-t border-dark-700">
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
              <h2 className="text-2xl font-semibold mb-4">Job Description</h2>
              <p className="text-gray-400 whitespace-pre-line">{job?.description}</p>
            </motion.div>

            {/* Required Skills */}
            {job?.required_skills && job.required_skills.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="card"
              >
                <h2 className="text-xl font-semibold mb-4">Required Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {job.required_skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-2 bg-primary-900/30 border border-primary-500/30 rounded-lg text-sm"
                    >
                      {skill.name || skill}
                      {skill.level && (
                        <span className="ml-2 text-xs text-gray-400">({skill.level})</span>
                      )}
                    </span>
                  ))}
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
                      className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-gray-400"
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
              <button className="btn-primary w-full text-lg py-4">
                Apply for this Position
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
