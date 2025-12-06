import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Briefcase, MapPin, Clock, DollarSign, TrendingUp, Award, Building2, ExternalLink, Sparkles, X, Search, SortAsc } from 'lucide-react'
import { useDebounce } from '../hooks/useDebounce'
import api from '../config/api'
import { PAGINATION, DEBOUNCE_DELAYS } from '../config/constants'
import EmptyState from '../components/EmptyState'

export default function JobsPage() {
  const [jobs, setJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize] = useState(20)
  const [filters, setFilters] = useState({
    q: '',
    location: '',
    work_type: '',
    skills: '',
    sort: 'popular'
  })
  const debouncedFilters = useDebounce(filters, DEBOUNCE_DELAYS.FILTER)

  useEffect(() => {
    fetchJobs()
  }, [debouncedFilters, page])

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
      setJobs(response.data?.jobs || response.data || [])
      setTotal(response.data?.total || 0)
      if (response.data?.jobs?.length > 0 && !selectedJob) {
        setSelectedJob(response.data.jobs[0])
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
      setJobs([])
    } finally {
      setLoading(false)
    }
  }

  const handleJobSelect = (job) => {
    setSelectedJob(job)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const JobCard = ({ job, isSelected, onClick }) => {
    // Calculate match percentage (mock calculation - can be replaced with API data)
    const matchPercentage = job.match_score || Math.floor(Math.random() * 40 + 60)
    const getMatchColor = (percentage) => {
      if (percentage >= 80) return 'bg-green-500'
      if (percentage >= 60) return 'bg-primary-500'
      return 'bg-yellow-500'
    }

    return (
      <motion.div
        layout
        whileHover={{ scale: 1.02 }}
        onClick={onClick}
        className={`p-4 rounded-lg border cursor-pointer transition-all duration-300 ${
          isSelected
            ? 'bg-primary-500/10 border-primary-500 shadow-lg shadow-primary-500/20'
            : 'bg-white border-gray-200 hover:border-primary-500 hover:shadow-md'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-5 h-5 text-primary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="font-semibold text-sm line-clamp-1">{job.title}</h3>
              <div className={`${getMatchColor(matchPercentage)} text-white px-2 py-0.5 rounded text-xs font-bold flex-shrink-0`}>
                {matchPercentage}%
              </div>
            </div>
            <p className="text-xs text-gray-400 line-clamp-1">{job.company}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{job.location_city}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span className="capitalize">{job.work_type}</span>
            </div>
          </div>
          {isSelected && (
            <Sparkles className="w-4 h-4 text-primary-400 flex-shrink-0" />
          )}
        </div>
      </motion.div>
    )
  }

  const JobDetails = ({ job }) => {
    if (!job) {
      return (
        <div className="flex items-center justify-center h-full">
          <EmptyState icon="search" title="Select a job" message="Choose a job from the list to view details" />
        </div>
      )
    }

    return (
      <motion.div
        key={job.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-900/30 to-primary-800/30 border border-primary-500/20 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-primary-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-8 h-8 text-primary-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2">{job.title}</h2>
              <p className="text-lg text-gray-700 mb-4">{job.company}</p>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 text-gray-400">
                  <MapPin className="w-4 h-4" />
                  <span>{job.location_city}, {job.location_state}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span className="capitalize">{job.work_type}</span>
                </div>
              </div>
            </div>
            {job.posted_days_ago && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Posted</p>
                <p className="text-sm font-semibold">{job.posted_days_ago} days ago</p>
              </div>
            )}
          </div>
        </div>

        {/* Key Information Grid */}
        <div className="grid grid-cols-2 gap-4">
          {job.min_experience_years !== null && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Experience Required</p>
              <p className="text-lg font-bold text-primary-400">{job.min_experience_years}+ years</p>
            </div>
          )}
          {job.min_cgpa && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Min CGPA</p>
              <p className="text-lg font-bold text-primary-400">{job.min_cgpa}</p>
            </div>
          )}
        </div>

        {/* Skills Required */}
        {job.required_skills && job.required_skills.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-primary-400" />
              Required Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {job.required_skills.map((skill, idx) => {
                // Check if skill is matched (70% chance for demo)
                const isMatched = Math.random() > 0.3
                const skillName = skill.name || skill
                
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <span className={`px-3 py-1 border text-sm rounded-full font-medium transition-colors ${
                      isMatched
                        ? 'bg-green-500/20 border-green-500/50 text-green-300'
                        : 'bg-primary-500/10 border-primary-500/30 text-primary-300'
                    }`}>
                      {isMatched && <span className="mr-1">✓</span>}
                      {skillName}
                    </span>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {/* Job Description */}
        {job.description && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary-400" />
              Job Description
            </h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">
                {job.description}
              </p>
            </div>
          </div>
        )}

        {/* Company Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary-400" />
            About Company
          </h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              <span className="text-gray-900 font-semibold">Company:</span> {job.company}
            </p>
            {job.company_website && (
              <a
                href={job.company_website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary-400 hover:text-primary-300 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Visit Company Website
              </a>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-primary py-3 font-semibold rounded-lg transition-all hover:shadow-lg">
            Apply Now
          </button>
          <button className="btn-secondary py-3 font-semibold rounded-lg transition-all hover:shadow-lg">
            Know More
          </button>
        </div>
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
          <p className="text-gray-400">Browse {total} job listings | Page {page} of {Math.ceil(total / pageSize)}</p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search title or company..."
                value={filters.q}
                onChange={(e) => {
                  setFilters({ ...filters, q: e.target.value })
                  setPage(1)
                }}
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
                onChange={(e) => {
                  setFilters({ ...filters, location: e.target.value })
                  setPage(1)
                }}
                className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
              />
            </div>

            {/* Work Type */}
            <select
              value={filters.work_type}
              onChange={(e) => {
                setFilters({ ...filters, work_type: e.target.value })
                setPage(1)
              }}
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
              onChange={(e) => {
                setFilters({ ...filters, sort: e.target.value })
                setPage(1)
              }}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
            >
              <option value="popular">Popular</option>
              <option value="recent">Recent</option>
              <option value="title">A-Z</option>
            </select>
          </div>
        </motion.div>

        {/* Split View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Job List */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="sticky top-24">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">
                {loading ? 'Loading jobs...' : `${jobs.length} Jobs`}
              </h2>
              <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <div key={i} className="h-24 bg-gray-100 border border-gray-200 rounded-lg animate-pulse" />
                  ))
                ) : jobs.length > 0 ? (
                  <AnimatePresence>
                    {jobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        isSelected={selectedJob?.id === job.id}
                        onClick={() => handleJobSelect(job)}
                      />
                    ))}
                  </AnimatePresence>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No jobs found. Try adjusting your filters.</p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {Math.ceil(total / pageSize) > 1 && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex-1 btn-secondary text-sm py-2 disabled:opacity-50"
                  >
                    ← Prev
                  </button>
                  <span className="flex items-center px-2 text-sm text-gray-400">
                    {page}/{Math.ceil(total / pageSize)}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
                    disabled={page === Math.ceil(total / pageSize)}
                    className="flex-1 btn-secondary text-sm py-2 disabled:opacity-50"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Right Panel - Job Details */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div className="sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto pr-2">
              <AnimatePresence mode="wait">
                {detailsLoading ? (
                  <div className="space-y-4">
                    {Array(4).fill(0).map((_, i) => (
                      <div key={i} className="h-20 bg-gray-100 border border-gray-200 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <JobDetails job={selectedJob} />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
