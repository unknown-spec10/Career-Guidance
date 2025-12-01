import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, GraduationCap, MapPin, Users, Award, TrendingUp, ExternalLink, BookOpen 
} from 'lucide-react'
import api from '../config/api'

export default function CollegeDetailsPage() {
  const { collegeId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [collegeId])

  const fetchData = async () => {
    try {
      const response = await api.get(`/api/college/${collegeId}`)
      setData(response.data)
    } catch (error) {
      console.error('Error fetching college:', error)
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

  const college = data?.college
  const eligibility = data?.eligibility
  const programs = data?.programs || []
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
            onClick={() => navigate('/colleges')}
            className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors duration-200 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Colleges</span>
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6">
            {/* College Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="card"
            >
              <div className="w-16 h-16 bg-primary-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                <GraduationCap className="w-8 h-8 text-primary-400" />
              </div>
              <h1 className="text-2xl font-bold text-center mb-4">{college?.name}</h1>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-gray-400">
                  <MapPin className="w-4 h-4" />
                  <span>{college?.location_city}, {college?.location_state}</span>
                </div>
                
                {college?.website && (
                  <a
                    href={college.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Visit Website</span>
                  </a>
                )}
              </div>

              {college?.description && (
                <p className="text-gray-400 text-sm mt-4 pt-4 border-t border-dark-700">
                  {college.description}
                </p>
              )}
            </motion.div>

            {/* Eligibility */}
            {eligibility && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="card"
              >
                <div className="flex items-center space-x-2 mb-4">
                  <Award className="w-5 h-5 text-primary-400" />
                  <h2 className="text-xl font-semibold">Eligibility</h2>
                </div>
                <div className="space-y-3">
                  {eligibility.min_jee_rank && (
                    <div>
                      <p className="text-sm text-gray-400">Min JEE Rank</p>
                      <p className="text-lg font-semibold text-primary-400">{eligibility.min_jee_rank}</p>
                    </div>
                  )}
                  {eligibility.min_cgpa && (
                    <div>
                      <p className="text-sm text-gray-400">Min CGPA</p>
                      <p className="text-lg font-semibold text-primary-400">{eligibility.min_cgpa}</p>
                    </div>
                  )}
                  {eligibility.seats && (
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{eligibility.seats} seats available</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Metadata */}
            {metadata && metadata.popularity_score > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="card"
              >
                <div className="flex items-center space-x-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-primary-400" />
                  <h2 className="text-xl font-semibold">Popularity</h2>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary-400 mb-2">
                    {metadata.popularity_score.toFixed(0)}
                  </div>
                  <p className="text-sm text-gray-400">Popularity Score</p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column - Programs */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card"
            >
              <div className="flex items-center space-x-2 mb-6">
                <BookOpen className="w-6 h-6 text-primary-400" />
                <h2 className="text-2xl font-semibold">Programs Offered</h2>
              </div>

              {programs.length > 0 ? (
                <div className="space-y-4">
                  {programs.map((program) => (
                    <div
                      key={program.id}
                      className="p-4 bg-dark-800 rounded-lg border border-dark-700"
                    >
                      <h3 className="font-semibold text-lg mb-2">{program.program_name}</h3>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-400 mb-3">
                        <span>Duration: {program.duration_months} months</span>
                      </div>

                      {program.description && (
                        <p className="text-gray-400 text-sm mb-3">{program.description}</p>
                      )}

                      {program.required_skills && program.required_skills.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-400 mb-2">Required Skills:</p>
                          <div className="flex flex-wrap gap-2">
                            {program.required_skills.map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-primary-900/30 border border-primary-500/30 rounded text-xs"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-8">No programs listed</p>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
