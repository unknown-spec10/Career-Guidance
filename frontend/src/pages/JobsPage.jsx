import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
} from 'lucide-react'
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
  const [fetchError, setFetchError] = useState(null)

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

  const activeFilterCount = [filters.q, filters.location, filters.work_type, filters.skills].filter(Boolean).length

  const JobCard = ({ job }) => {
    const getStableMatchPercentage = (jobId) => {
      const hash = jobId * 12345 % 100
      return Math.max(60, (hash * 1.5) % 40 + 60)
    }

    const matchPercentage = job.match_score || Math.round(getStableMatchPercentage(job.id))

    const getMatchColor = (percentage) => {
      if (percentage >= 80) return 'bg-green-600'
      if (percentage >= 60) return 'bg-primary-600'
      return 'bg-yellow-600'
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
        className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md hover:border-primary-200 transition-all flex flex-col h-full"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-10 h-10 bg-primary-50 border border-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-5 h-5 text-primary-700" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{job.title}</h3>
                <p className="text-sm text-gray-600">{job.company}</p>
              </div>
            </div>
          </div>
          <div className={`${getMatchColor(matchPercentage)} text-white px-3 py-1 rounded-full text-xs font-bold flex-shrink-0`}>
            {matchPercentage}% MATCH
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <div className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-700">
            <MapPin className="w-3 h-3" />
            <span>{job.location_city || 'Remote'}{job.location_state ? `, ${job.location_state}` : ''}</span>
          </div>
          <div className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-700">
            <Clock className="w-3 h-3" />
            <span className="capitalize">{job.work_type || 'Full-time'}</span>
          </div>
          {job.min_experience_years !== null && (
            <div className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-700">
              <Sparkles className="w-3 h-3" />
              <span>{job.min_experience_years}+ years</span>
            </div>
          )}
          {job.min_cgpa && (
            <div className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-700">
              <Award className="w-3 h-3" />
              <span>CGPA {job.min_cgpa}+</span>
            </div>
          )}
        </div>

        {job.description && (
          <p className="text-sm text-gray-700 mb-4 line-clamp-3">
            {job.description}
          </p>
        )}

        {(job.min_salary || job.max_salary) && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-600 mb-1">Salary Range</p>
            <p className="text-sm font-bold text-primary-600">
              {job.min_salary ? `INR ${(job.min_salary / 100000).toFixed(1)}L` : 'Competitive'}
              {job.max_salary ? ` - INR ${(job.max_salary / 100000).toFixed(1)}L` : ''}
            </p>
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-gray-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center px-2 py-1 rounded-full bg-primary-50 border border-primary-200 text-primary-700 font-semibold">
              Learning Path
            </span>
            <span className="text-primary-700 font-semibold">2 Credits</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleOpenDetails}
              className="py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
            >
              Details
            </button>

            <Link
              to={`/job/${job.id}`}
              className="py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 text-center"
            >
              View/Apply
            </Link>

            <button
              onClick={() => handleGenerateLearningPath(job)}
              disabled={learningPathState.loadingId === job.id}
              className="inline-flex items-center justify-center gap-1 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 transition-colors"
            >
              {learningPathState.loadingId === job.id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  ...
                </>
              ) : (
                'Path'
              )}
            </button>
          </div>

          <button
            onClick={() => handleGenerateLearningPath(job)}
            disabled={learningPathState.loadingId === job.id}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-primary-200 text-primary-700 text-sm font-semibold hover:bg-primary-50 disabled:opacity-60 transition-colors"
          >
            {learningPathState.loadingId === job.id ? (
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
        </div>

        {learningPathState.success && learningPathState.successJobId === job.id && (
          <div className="mt-3 flex items-center gap-2 text-green-700 text-xs bg-green-50 border border-green-200 px-3 py-2 rounded">
            <CheckCircle className="w-4 h-4" />
            <span>{learningPathState.success}</span>
          </div>
        )}
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
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Keyword, title, or company"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                className="w-full bg-white border border-gray-300 rounded-lg px-10 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
              />
            </div>

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

            <select
              value={filters.work_type}
              onChange={(e) => setFilters({ ...filters, work_type: e.target.value })}
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
              onChange={(e) => setFilters({ ...filters, skills: e.target.value })}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
            />

            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
            >
              <option value="popular">Sort: Popular</option>
              <option value="recent">Sort: Recent</option>
              <option value="title">Sort: A-Z</option>
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              {total} results
              {activeFilterCount > 0 && <span className="ml-2 text-primary-700">({activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''})</span>}
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/dashboard/learning-paths"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:border-primary-400 hover:text-primary-700 transition-colors"
              >
                Learning Paths
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition-colors"
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
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="sticky top-0 bg-primary-600 text-white p-6 flex items-start justify-between gap-4">
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

              <div className="p-6 space-y-6">
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
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">About This Role</h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedJob.description}</p>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex gap-3">
                <button
                  onClick={() => {
                    handleGenerateLearningPath(selectedJob)
                    setTimeout(() => setSelectedJob(null), 500)
                  }}
                  disabled={learningPathState.loadingId === selectedJob.id}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-60 transition-colors"
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
