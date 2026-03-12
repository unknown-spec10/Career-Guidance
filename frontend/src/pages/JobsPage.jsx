import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Briefcase, MapPin, Clock, DollarSign, Award, Building2, ExternalLink, Sparkles, Search, SortAsc, Loader2, CheckCircle } from 'lucide-react'
import { useDebounce } from '../hooks/useDebounce'
import api from '../config/api'
import { DEBOUNCE_DELAYS } from '../config/constants'

export default function JobsPage() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedJob, setSelectedJob] = useState(null)
  const pageSize = 9 // 3x3 grid = 9 jobs per page
  const observerTarget = useRef(null)
  const hasMoreRef = useRef(hasMore)
  const loadingRef = useRef(loading)
  const [learningPathState, setLearningPathState] = useState({
    loadingId: null,
    error: null,
    success: null,
    path: null
  })
  const [filters, setFilters] = useState({
    q: '',
    location: '',
    work_type: '',
    skills: '',
    sort: 'popular'
  })
  const debouncedFilters = useDebounce(filters, DEBOUNCE_DELAYS.FILTER)

  // Update refs when state changes
  useEffect(() => {
    hasMoreRef.current = hasMore
    loadingRef.current = loading
  }, [hasMore, loading])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
    setJobs([])
    setHasMore(true)
  }, [debouncedFilters])

  // Fetch jobs when page changes
  useEffect(() => {
    fetchJobs()
  }, [page, debouncedFilters])

  // Infinite scroll observer - set up once
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMoreRef.current && !loadingRef.current) {
          console.log('Intersection detected - loading more jobs')
          setPage(p => p + 1)
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
      const response = await api.get('/api/jobs', {
        params: {
          skip: (page - 1) * pageSize,
          limit: pageSize,
          q: debouncedFilters.q,
          location: debouncedFilters.location,
          work_type: debouncedFilters.work_type,
          skills: debouncedFilters.skills,
          sort: debouncedFilters.sort
        }
      })
      const newJobs = response.data?.jobs || response.data || []
      setTotal(response.data?.total || 0)
      
      if (page === 1) {
        setJobs(newJobs)
      } else {
        setJobs(prev => [...prev, ...newJobs])
      }
      
      setHasMore(newJobs.length === pageSize)
    } catch (error) {
      console.error('Error fetching jobs:', error)
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateLearningPath = async (job) => {
    if (!job?.id) return
    setLearningPathState({ loadingId: job.id, error: null, success: null, path: null })
    try {
      const response = await api.post(`/api/jobs/${job.id}/learning-path`)
      const alreadyExists = response?.data?.already_exists
      setLearningPathState({
        loadingId: null,
        error: null,
        success: alreadyExists ? 'Learning path already exists for this job' : 'Learning path generated successfully (2 credits used)',
        path: response.data
      })
    } catch (error) {
      const detail = error?.response?.data?.detail || 'Failed to generate learning path'
      const status = error?.response?.status
      if (status === 402) {
        setLearningPathState({ loadingId: null, error: 'Insufficient credits. ' + detail, success: null, path: null })
      } else {
        setLearningPathState({ loadingId: null, error: detail, success: null, path: null })
      }
    }
  }

  const JobCard = ({ job }) => {
    const getStableMatchPercentage = (jobId) => {
      const hash = jobId * 12345 % 100
      return Math.max(60, (hash * 1.5) % 40 + 60)
    }
    const matchPercentage = job.match_score || Math.round(getStableMatchPercentage(job.id))
    const getMatchColor = (percentage) => {
      if (percentage >= 80) return 'bg-green-500'
      if (percentage >= 60) return 'bg-primary-500'
      return 'bg-yellow-500'
    }

    const handleCardClick = async () => {
      try {
        // Fetch full job details
        const response = await api.get(`/api/job/${job.id}`)
        setSelectedJob(response.data.job)
      } catch (error) {
        console.error('Error fetching job details:', error)
        // Fallback to card data if API fails
        setSelectedJob(job)
      }
    }

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        onClick={handleCardClick}
        className="bg-white border border-primary-200 rounded-xl p-6 hover:shadow-lg hover:scale-105 transition-all cursor-pointer"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-6 h-6 text-primary-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{job.title}</h3>
                <p className="text-sm text-gray-600">{job.company}</p>
              </div>
            </div>
          </div>
          <div className={`${getMatchColor(matchPercentage)} text-white px-3 py-1 rounded-lg text-sm font-bold flex-shrink-0`}>
            {matchPercentage}%
          </div>
        </div>

        {/* Meta Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-primary-400" />
            <span className="text-gray-700">{job.location_city}, {job.location_state}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-primary-400" />
            <span className="text-gray-700 capitalize">{job.work_type}</span>
          </div>
          {job.min_experience_years !== null && (
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-primary-400" />
              <span className="text-gray-700">{job.min_experience_years}+ years</span>
            </div>
          )}
          {job.min_cgpa && (
            <div className="flex items-center gap-2 text-sm">
              <Award className="w-4 h-4 text-primary-400" />
              <span className="text-gray-700">CGPA {job.min_cgpa}+</span>
            </div>
          )}
        </div>

        {/* Description */}
        {job.description && (
          <p className="text-sm text-gray-700 mb-4 line-clamp-3">
            {job.description}
          </p>
        )}

        {/* Salary Range */}
        {(job.min_salary || job.max_salary) && (
          <div className="mb-4 pb-4 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-600 mb-1">Salary Range</p>
            <p className="text-sm font-bold text-primary-600">
              {job.min_salary ? `₹${(job.min_salary / 100000).toFixed(1)}L` : 'Competitive'}
              {job.max_salary ? ` - ₹${(job.max_salary / 100000).toFixed(1)}L` : ''}
            </p>
          </div>
        )}

        {/* Skills */}
        {job.required_skills && job.required_skills.length > 0 && (
          <div className="mb-4 pb-4 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-600 mb-2">Required Skills</p>
            <div className="flex flex-wrap gap-2">
              {job.required_skills.slice(0, 4).map((skill, idx) => {
                const skillName = skill.name || skill
                return (
                  <span key={idx} className="bg-primary-50 border border-primary-200 text-primary-700 px-2 py-1 rounded text-xs font-medium">
                    {skillName}
                  </span>
                )
              })}
              {job.required_skills.length > 4 && (
                <span className="text-xs text-gray-600">+{job.required_skills.length - 4} more</span>
              )}
            </div>
          </div>
        )}

        {/* Optional Skills */}
        {job.optional_skills && job.optional_skills.length > 0 && (
          <div className="mb-4 pb-4 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-600 mb-2">Nice to Have</p>
            <div className="flex flex-wrap gap-2">
              {job.optional_skills.slice(0, 3).map((skill, idx) => {
                const skillName = skill.name || skill
                return (
                  <span key={idx} className="bg-gray-100 border border-gray-300 text-gray-700 px-2 py-1 rounded text-xs font-medium">
                    {skillName}
                  </span>
                )
              })}
              {job.optional_skills.length > 3 && (
                <span className="text-xs text-gray-600">+{job.optional_skills.length - 3} more</span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleGenerateLearningPath(job)}
            disabled={learningPathState.loadingId === job.id}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 disabled:opacity-60 transition-colors"
          >
            {learningPathState.loadingId === job.id ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Learning Path
              </>
            )}
          </button>
          {job.company_website && (
            <a
              href={job.company_website}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg border border-primary-300 text-primary-600 hover:bg-primary-50 text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>

        {/* Status Messages */}
        {learningPathState.success && (
          <div className="mt-3 flex items-center gap-2 text-green-600 text-xs bg-green-50 border border-green-200 px-3 py-2 rounded">
            <CheckCircle className="w-4 h-4" />
            <span>{learningPathState.success}</span>
          </div>
        )}
        {learningPathState.error && (
          <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
            {learningPathState.error}
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">Job Opportunities</h1>
          <p className="text-gray-600">Browse {total} job listings tailored for you</p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 bg-white border border-primary-200 rounded-xl p-4 shadow-sm"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search title or company..."
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                className="w-full bg-white border border-gray-300 rounded-lg px-10 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
              />
            </div>

            {/* Location */}
            <div className="relative">
              <MapPin className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Location"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
              />
            </div>

            {/* Work Type */}
            <select
              value={filters.work_type}
              onChange={(e) => setFilters({ ...filters, work_type: e.target.value })}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
            >
              <option value="">All Types</option>
              <option value="remote">Remote</option>
              <option value="on-site">On-site</option>
              <option value="hybrid">Hybrid</option>
            </select>

            {/* Sort */}
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
            >
              <option value="popular">Popular</option>
              <option value="recent">Recent</option>
              <option value="title">A-Z</option>
            </select>
          </div>
        </motion.div>

        {/* Jobs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </AnimatePresence>
        </div>

        {/* Loading more indicator */}
        {loading && (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(9).fill(0).map((_, i) => (
              <div key={i} className="h-80 bg-gray-200 border border-gray-300 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Infinite scroll trigger */}
        <div ref={observerTarget} className="mt-12 text-center">
          {!hasMore && jobs.length > 0 && (
            <p className="text-gray-600">No more jobs to load</p>
          )}
        </div>

        {/* Empty state */}
        {!loading && jobs.length === 0 && (
          <div className="text-center py-12">
            <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No jobs found. Try adjusting your filters.</p>
          </div>
        )}
      </div>

      {/* Job Details Modal */}
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
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{selectedJob.title}</h2>
                  <p className="text-primary-100 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {selectedJob.company}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors flex-shrink-0"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Job Details */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Job Details</h3>
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
                </div>

                {/* Description */}
                {selectedJob.description && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">About This Role</h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedJob.description}</p>
                  </div>
                )}

                {/* Required Skills */}
                {selectedJob.required_skills && selectedJob.required_skills.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Required Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedJob.required_skills.map((skill, idx) => {
                        const skillName = skill.name || skill
                        return (
                          <span key={idx} className="bg-primary-50 border border-primary-200 text-primary-700 px-3 py-1.5 rounded-full text-sm font-medium">
                            {skillName}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Optional Skills */}
                {selectedJob.optional_skills && selectedJob.optional_skills.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Optional Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedJob.optional_skills.map((skill, idx) => {
                        const skillName = skill.name || skill
                        return (
                          <span key={idx} className="bg-gray-100 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-full text-sm font-medium">
                            {skillName}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Employer Info */}
                {selectedJob.employer && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Company</h3>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="font-bold text-gray-900 mb-2">{selectedJob.employer.company_name}</p>
                      {selectedJob.employer.location_city && (
                        <p className="text-sm text-gray-700 flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {selectedJob.employer.location_city}
                        </p>
                      )}
                      {selectedJob.employer.website && (
                        <a
                          href={selectedJob.employer.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary-600 hover:underline flex items-center gap-2 mt-2"
                        >
                          <Globe className="w-4 h-4" />
                          Visit Company Website
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex gap-3">
                <button
                  onClick={() => {
                    handleGenerateLearningPath(selectedJob)
                    setTimeout(() => setSelectedJob(null), 500)
                  }}
                  disabled={learningPathState.loadingId === selectedJob.id}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary-500 text-white font-semibold hover:bg-primary-600 disabled:opacity-60 transition-colors"
                >
                  {learningPathState.loadingId === selectedJob.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Learning Path
                    </>
                  )}
                </button>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-300 text-gray-900 font-semibold hover:bg-gray-100 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
