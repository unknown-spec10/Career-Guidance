import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Briefcase, MapPin, Clock, TrendingUp, Filter, AlertTriangle, Search, SortAsc } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDebounce } from '../hooks/useDebounce'
import api from '../config/api'
import { PAGINATION, DEBOUNCE_DELAYS, ANIMATION_DELAYS } from '../config/constants'

export default function JobsPage() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize] = useState(PAGINATION.JOBS_PAGE_SIZE)
  const [filters, setFilters] = useState({
    location: '',
    work_type: '',
    q: '',
    skills: '',
    sort: 'popular',
    min_popularity: ''
  })

  const debouncedFilters = useDebounce(filters, DEBOUNCE_DELAYS.FILTER)

  useEffect(() => {
    fetchJobs()
  }, [debouncedFilters, page])

  const fetchJobs = async () => {
    try {
      setError(null)
      setLoading(true)
      const response = await api.get('/api/jobs', {
        params: {
          skip: (page - 1) * pageSize,
          limit: pageSize,
          ...debouncedFilters
        }
      })
      setJobs(response.data.jobs)
      setTotal(response.data.total)
    } catch (error) {
      console.error('Error fetching jobs:', error)
      setError(error.response?.data?.detail || 'Failed to load jobs. Please try again.')
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

  return (
    <div className="min-h-screen bg-dark-900 pt-24 pb-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Job Opportunities</h1>
          <p className="text-gray-400">Discover {total} approved job listings | Page {page} of {Math.ceil(total / pageSize)}</p>
        </motion.div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mb-8"
        >
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-semibold">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="block text-sm text-gray-400 mb-2">Search</label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search title or company"
                  value={filters.q}
                  onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                  className="input pl-9"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Location</label>
              <input
                type="text"
                placeholder="e.g. Bangalore"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Work Type</label>
              <select
                value={filters.work_type}
                onChange={(e) => setFilters({ ...filters, work_type: e.target.value })}
                className="select"
              >
                <option value="">All Types</option>
                <option value="remote">Remote</option>
                <option value="on-site">On-site</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Required Skills</label>
              <input
                type="text"
                placeholder="e.g. Python, React"
                value={filters.skills}
                onChange={(e) => setFilters({ ...filters, skills: e.target.value })}
                className="input"
              />
              <p className="text-xs text-gray-500 mt-1">Comma-separated for multiple skills</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Sort By</label>
              <div className="relative">
                <SortAsc className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={filters.sort}
                  onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                  className="select pl-9"
                >
                  <option value="popular">Popularity</option>
                  <option value="recent">Recently Posted</option>
                  <option value="title">Title</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Min Popularity</label>
              <input
                type="number"
                placeholder="e.g. 50"
                value={filters.min_popularity}
                onChange={(e) => setFilters({ ...filters, min_popularity: e.target.value })}
                className="input"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ location: '', work_type: '', q: '', skills: '', sort: 'popular', min_popularity: '' })}
                className="btn-secondary w-full"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </motion.div>

        <div className="space-y-4">
          {jobs.map((job, idx) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * ANIMATION_DELAYS.CARD_STAGGER_FAST }}
            >
              <Link to={`/job/${job.id}`}>
                <div className="card hover:border-primary-500/50 transition-all duration-300 cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Briefcase className="w-6 h-6 text-green-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-xl mb-1">{job.title}</h3>
                        <p className="text-gray-400 mb-3">{job.company}</p>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-4 h-4" />
                            <span>{job.location_city}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4" />
                            <span className="capitalize">{job.work_type}</span>
                          </div>
                          {job.min_experience_years > 0 && (
                            <div className="flex items-center space-x-1">
                              <TrendingUp className="w-4 h-4" />
                              <span>{job.min_experience_years}+ years</span>
                            </div>
                          )}
                        </div>

                        {job.required_skills && job.required_skills.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {job.required_skills.slice(0, 5).map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-primary-900/30 border border-primary-500/30 rounded text-xs"
                              >
                                {skill.name || skill}
                              </span>
                            ))}
                            {job.required_skills.length > 5 && (
                              <span className="px-2 py-1 text-xs text-gray-500">
                                +{job.required_skills.length - 5} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right ml-4">
                      {job.min_cgpa && (
                        <div className="mb-2">
                          <p className="text-xs text-gray-500">Min CGPA</p>
                          <p className="text-lg font-bold text-primary-400">{job.min_cgpa}</p>
                        </div>
                      )}
                      <button className="btn-primary text-sm px-4 py-2">
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {jobs.length === 0 && !loading && (
          <div className="text-center py-12">
            <Briefcase className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No jobs found</p>
          </div>
        )}

        {/* Pagination */}
        {Math.ceil(total / pageSize) > 1 && (
          <div className="flex justify-center items-center space-x-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-gray-400">
              Page {page} of {Math.ceil(total / pageSize)}
            </span>
            <button
              onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
              disabled={page === Math.ceil(total / pageSize)}
              className="px-4 py-2 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
