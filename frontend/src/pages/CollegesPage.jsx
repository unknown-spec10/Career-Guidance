import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, MapPin, TrendingUp, Users, ExternalLink, AlertTriangle, Filter, Search, SortAsc } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../config/api'
import { PAGINATION, ANIMATION_DELAYS, DEBOUNCE_DELAYS } from '../config/constants'
import { useDebounce } from '../hooks/useDebounce'

export default function CollegesPage() {
  const [colleges, setColleges] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize] = useState(PAGINATION.COLLEGES_PAGE_SIZE)
  const [filters, setFilters] = useState({
    location: '',
    min_jee_rank: '',
    min_cgpa: '',
    programs_min: '',
    q: '',
    sort: 'popular'
  })
  const debouncedFilters = useDebounce(filters, DEBOUNCE_DELAYS.FILTER)

  useEffect(() => {
    fetchColleges()
  }, [page, debouncedFilters])

  const fetchColleges = async () => {
    try {
      setError(null)
      setLoading(true)
      const response = await api.get('/api/colleges', {
        params: { skip: (page - 1) * pageSize, limit: pageSize, ...debouncedFilters }
      })
      setColleges(response.data.colleges)
      setTotal(response.data.total)
    } catch (error) {
      console.error('Error fetching colleges:', error)
      setError(error.response?.data?.detail || 'Failed to load colleges. Please try again.')
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
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Colleges & Universities</h1>
          <p className="text-gray-400">Browse through {total} institutions | Page {page} of {Math.ceil(total / pageSize)}</p>
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
                  placeholder="Search college name"
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
                placeholder="e.g. Pune"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Min JEE Rank</label>
              <input
                type="number"
                placeholder="e.g. 5000"
                value={filters.min_jee_rank}
                onChange={(e) => setFilters({ ...filters, min_jee_rank: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Min CGPA</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 7.5"
                value={filters.min_cgpa}
                onChange={(e) => setFilters({ ...filters, min_cgpa: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Min Programs</label>
              <input
                type="number"
                placeholder="e.g. 5"
                value={filters.programs_min}
                onChange={(e) => setFilters({ ...filters, programs_min: e.target.value })}
                className="input"
              />
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
                  <option value="name">Name</option>
                </select>
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ location: '', min_jee_rank: '', min_cgpa: '', programs_min: '', q: '', sort: 'popular' })}
                className="btn-secondary w-full"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {colleges.map((college, idx) => (
            <motion.div
              key={college.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * ANIMATION_DELAYS.CARD_STAGGER }}
            >
              <Link to={`/college/${college.id}`}>
                <div className="card hover:border-primary-500/50 transition-all duration-300 cursor-pointer h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
                        <GraduationCap className="w-6 h-6 text-primary-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg leading-tight">{college.name}</h3>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                      <MapPin className="w-4 h-4" />
                      <span>{college.location_city}, {college.location_state}</span>
                    </div>
                    {college.min_jee_rank && (
                      <div className="flex items-center space-x-2 text-sm text-gray-400">
                        <TrendingUp className="w-4 h-4" />
                        <span>JEE Cutoff: {college.min_jee_rank}</span>
                      </div>
                    )}
                    {college.seats && (
                      <div className="flex items-center space-x-2 text-sm text-gray-400">
                        <Users className="w-4 h-4" />
                        <span>{college.seats} seats</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-dark-700">
                    <div>
                      {college.min_cgpa && (
                        <p className="text-sm text-gray-400">
                          Min CGPA: <span className="text-primary-400 font-semibold">{college.min_cgpa}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 text-primary-400">
                      <span className="text-sm">View Details</span>
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </div>

                  {college.programs_count > 0 && (
                    <div className="mt-3 text-xs text-gray-500">
                      {college.programs_count} program{college.programs_count > 1 ? 's' : ''} available
                    </div>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {colleges.length === 0 && !loading && (
          <div className="text-center py-12">
            <GraduationCap className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No colleges found</p>
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
