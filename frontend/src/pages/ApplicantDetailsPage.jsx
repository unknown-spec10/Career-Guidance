import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
  ArrowLeft, User, MapPin, GraduationCap, Briefcase, Target, TrendingUp 
} from 'lucide-react'
import api from '../config/api'

export default function ApplicantDetailsPage() {
  const { applicantId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [recommendations, setRecommendations] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      setLoading(true)
      const apiUrl = `/api/applicant/${applicantId}`
      console.log('Fetching applicant details from:', apiUrl)
      console.log('API base URL:', api.defaults.baseURL)

      // First fetch applicant details to get the DB ID
      const detailsRes = await api.get(apiUrl)
      console.log('Applicant details received:', detailsRes.data)
      setData(detailsRes.data)
      
      // Then fetch recommendations using the numeric DB ID
      const dbId = detailsRes.data?.applicant?.id
      console.log('Using DB ID for recommendations:', dbId)
      
      if (dbId) {
        const recsRes = await api.get(`/api/recommendations/${dbId}`)
        console.log('Recommendations received:', recsRes.data)
        setRecommendations(recsRes.data)
      } else {
        console.warn('No DB ID found, skipping recommendations')
        setRecommendations({ college_recommendations: [], job_recommendations: [] })
      }
    } catch (error) {
      console.error('Error fetching applicant data:', error)
      console.error('Error details:', error.response?.data || error.message)
      // Set null data to trigger error UI
      setData(null)
      setRecommendations({ college_recommendations: [], job_recommendations: [] })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicantId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Add null check for data and applicant
  if (!data || !data.applicant) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate('/applicants')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Applicants</span>
          </button>
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg mb-2">Unable to load applicant data.</p>
            <p className="text-gray-500 text-sm">The applicant may not exist or there was an error fetching the data.</p>
            <button
              onClick={() => navigate('/applicants')}
              className="mt-4 btn-primary"
            >
              Back to Applicants List
            </button>
          </div>
        </div>
      </div>
    )
  }

  const applicant = data.applicant
  const parsed = data.parsed_data || {}
  // Support both `personal` and `personal_info` keys from different parser outputs
  const personal = parsed.personal || parsed.personal_info || {}
  const education = parsed.education || []
  const skills = parsed.skills || []

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate('/applicants')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Applicants</span>
          </button>
          <h1 className="text-3xl md:text-4xl font-bold">
            {applicant?.display_name || 'Applicant Details'}
          </h1>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6">
            {/* Personal Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="card"
            >
              <div className="flex items-center space-x-2 mb-4">
                <User className="w-5 h-5 text-primary-400" />
                <h2 className="text-xl font-semibold">Personal Information</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-medium">{personal.name || applicant?.display_name}</p>
                </div>
                {personal.email && (
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{personal.email}</p>
                  </div>
                )}
                {applicant?.location_city && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <p className="text-sm">{applicant.location_city}, {applicant.country}</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Education */}
            {education.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="card"
              >
                <div className="flex items-center space-x-2 mb-4">
                  <GraduationCap className="w-5 h-5 text-primary-400" />
                  <h2 className="text-xl font-semibold">Education</h2>
                </div>
                <div className="space-y-4">
                  {education.map((edu, idx) => (
                    <div key={idx} className="pb-4 border-b border-gray-200 last:border-0 last:pb-0">
                      <p className="font-medium">{edu.institution}</p>
                      <p className="text-sm text-gray-600">{edu.degree}</p>
                      {(edu.cgpa || edu.grade) && (
                        <p className="text-sm text-primary-400 mt-1">
                          {edu.cgpa ? `CGPA: ${edu.cgpa}` : `Grade: ${edu.grade}`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Skills */}
            {skills.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="card"
              >
                <div className="flex items-center space-x-2 mb-4">
                  <Target className="w-5 h-5 text-primary-400" />
                  <h2 className="text-xl font-semibold">Skills</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-primary-900/30 border border-primary-500/30 rounded-full text-sm"
                    >
                      {skill.name}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column - Recommendations */}
          <div className="lg:col-span-2 space-y-6">
            {/* College Recommendations */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card"
            >
              <div className="flex items-center space-x-2 mb-4">
                <GraduationCap className="w-6 h-6 text-primary-400" />
                <h2 className="text-2xl font-semibold">College Recommendations</h2>
              </div>
              <div className="space-y-4">
                {recommendations?.college_recommendations?.map((rec) => (
                  <Link
                    key={rec.id}
                    to={`/college/${rec.college.id}`}
                    className="block p-4 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-500/50 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{rec.college.name}</h3>
                        <p className="text-sm text-gray-600">
                          {rec.college.location_city}, {rec.college.location_state}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-1">
                          <TrendingUp className="w-4 h-4 text-primary-400" />
                          <span className="text-xl font-bold text-primary-400">
                            {rec.recommend_score.toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">Match Score</p>
                      </div>
                    </div>
                    {rec.explain && (
                      <p className="text-sm text-gray-600 mt-2">
                        {Array.isArray(rec.explain.reasons) 
                          ? rec.explain.reasons.join(', ') 
                          : rec.explain.reasoning || rec.explain.match_details || 'Good match based on profile'}
                      </p>
                    )}
                  </Link>
                ))}
                {recommendations?.college_recommendations?.length === 0 && (
                  <p className="text-gray-600 text-center py-4">No college recommendations yet</p>
                )}
              </div>
            </motion.div>

            {/* Job Recommendations */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="card"
            >
              <div className="flex items-center space-x-2 mb-4">
                <Briefcase className="w-6 h-6 text-green-400" />
                <h2 className="text-2xl font-semibold">Job Recommendations</h2>
              </div>
              <div className="space-y-4">
                {recommendations?.job_recommendations?.map((rec) => (
                  <Link
                    key={rec.id}
                    to={`/job/${rec.job.id}`}
                    className="block p-4 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-green-500/50 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{rec.job.title}</h3>
                        <p className="text-sm text-gray-600">{rec.job.company}</p>
                        <p className="text-sm text-gray-500">
                          {rec.job.location_city} • {rec.job.work_type}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-1">
                          <TrendingUp className="w-4 h-4 text-green-400" />
                          <span className="text-xl font-bold text-green-400">
                            {rec.score.toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">Match Score</p>
                      </div>
                    </div>
                    {rec.explain && (
                      <p className="text-sm text-gray-600 mt-2">
                        {typeof rec.explain === 'string' 
                          ? rec.explain 
                          : (rec.explain.reasons?.join(', ') || rec.explain.reasoning || rec.explain.match_details || 'Good match')}
                      </p>
                    )}
                  </Link>
                ))}
                {recommendations?.job_recommendations?.length === 0 && (
                  <p className="text-gray-600 text-center py-4">No job recommendations yet</p>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
