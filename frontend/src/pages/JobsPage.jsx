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

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white border border-primary-200 rounded-xl p-6 hover:shadow-lg transition-shadow"
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

        {/* Skills */}
        {job.required_skills && job.required_skills.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">Required Skills</p>
            <div className="flex flex-wrap gap-2">
              {job.required_skills.slice(0, 5).map((skill, idx) => {
                const skillName = skill.name || skill
                return (
                  <span key={idx} className="bg-primary-50 border border-primary-200 text-primary-700 px-2.5 py-1 rounded-full text-xs font-medium">
                    {skillName}
                  </span>
                )
              })}
              {job.required_skills.length > 5 && (
                <span className="text-xs text-gray-600">+{job.required_skills.length - 5} more</span>
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
    </div>
  )
}
