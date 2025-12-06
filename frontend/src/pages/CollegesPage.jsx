import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GraduationCap, MapPin, Users, Award, Building2, Globe, ExternalLink, Sparkles, Search, SortAsc } from 'lucide-react'
import { useDebounce } from '../hooks/useDebounce'
import api from '../config/api'
import { PAGINATION, DEBOUNCE_DELAYS } from '../config/constants'
import EmptyState from '../components/EmptyState'

export default function CollegesPage() {
  const [colleges, setColleges] = useState([])
  const [selectedCollege, setSelectedCollege] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize] = useState(20)
  const [filters, setFilters] = useState({
    q: '',
    location: '',
    min_jee_rank: '',
    sort: 'popular'
  })
  const debouncedFilters = useDebounce(filters, DEBOUNCE_DELAYS.FILTER)

  useEffect(() => {
    fetchColleges()
  }, [debouncedFilters, page])

  const fetchColleges = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/colleges', {
        params: {
          skip: (page - 1) * pageSize,
          limit: pageSize,
          q: debouncedFilters.q,
          location: debouncedFilters.location,
          min_jee_rank: debouncedFilters.min_jee_rank,
          sort: debouncedFilters.sort
        }
      })
      setColleges(response.data?.colleges || response.data || [])
      setTotal(response.data?.total || 0)
      if (response.data?.colleges?.length > 0 && !selectedCollege) {
        setSelectedCollege(response.data.colleges[0])
      }
    } catch (error) {
      console.error('Error fetching colleges:', error)
      setColleges([])
    } finally {
      setLoading(false)
    }
  }

  const handleCollegeSelect = (college) => {
    setSelectedCollege(college)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const CollegeCard = ({ college, isSelected, onClick }) => {
    // Calculate match percentage (mock calculation)
    const matchPercentage = college.match_score || Math.floor(Math.random() * 40 + 60)
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
            <GraduationCap className="w-5 h-5 text-primary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="font-semibold text-sm line-clamp-1">{college.name}</h3>
              <div className={`${getMatchColor(matchPercentage)} text-white px-2 py-0.5 rounded text-xs font-bold flex-shrink-0`}>
                {matchPercentage}%
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{college.location_city}, {college.location_state}</span>
            </div>
            {college.nirf_ranking && (
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <Award className="w-3 h-3" />
                <span>NIRF #{college.nirf_ranking}</span>
              </div>
            )}
          </div>
          {isSelected && (
            <Sparkles className="w-4 h-4 text-primary-400 flex-shrink-0" />
          )}
        </div>
      </motion.div>
    )
  }

  const CollegeDetails = ({ college }) => {
    if (!college) {
      return (
        <div className="flex items-center justify-center h-full">
          <EmptyState icon="search" title="Select a college" message="Choose a college from the list to view details" />
        </div>
      )
    }

    return (
      <motion.div
        key={college.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-900/30 to-primary-800/30 border border-primary-500/20 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-primary-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-8 h-8 text-primary-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2">{college.name}</h2>
              <p className="text-lg text-gray-700 mb-4">{college.location_city}, {college.location_state}</p>
              <div className="flex flex-wrap gap-4">
                {college.nirf_ranking && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Award className="w-4 h-4" />
                    <span>NIRF Rank: {college.nirf_ranking}</span>
                  </div>
                )}
                {college.established_year && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Building2 className="w-4 h-4" />
                    <span>Est. {college.established_year}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Key Information Grid */}
        <div className="grid grid-cols-2 gap-4">
          {college.total_seats && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Total Seats</p>
              <p className="text-lg font-bold text-primary-400">{college.total_seats}</p>
            </div>
          )}
          {college.jee_cutoff_general && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">JEE Cutoff (General)</p>
              <p className="text-lg font-bold text-primary-400">{college.jee_cutoff_general}</p>
            </div>
          )}
          {college.acceptance_rate && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Acceptance Rate</p>
              <p className="text-lg font-bold text-primary-400">{college.acceptance_rate}%</p>
            </div>
          )}
          {college.student_faculty_ratio && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Student-Faculty Ratio</p>
              <p className="text-lg font-bold text-primary-400">{college.student_faculty_ratio}</p>
            </div>
          )}
        </div>

        {/* Programs Offered */}
        {college.programs && college.programs.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary-400" />
              Programs Offered
            </h3>
            <div className="space-y-2">
              {college.programs.map((program, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white border border-gray-200 rounded-lg p-3 flex items-start gap-3 hover:border-primary-300 transition-colors"
                >
                  <div className="w-8 h-8 bg-primary-500/20 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary-400">{idx + 1}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{program.name || program}</p>
                    {program.duration && (
                      <p className="text-xs text-gray-500 mt-1">Duration: {program.duration} years</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* College Description */}
        {college.description && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary-400" />
              About College
            </h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">
                {college.description}
              </p>
            </div>
          </div>
        )}

        {/* Campus Infrastructure */}
        {college.infrastructure && college.infrastructure.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary-400" />
              Campus Infrastructure
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {college.infrastructure.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3 text-center"
                >
                  <p className="text-sm font-medium text-primary-300">{item}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Contact Information */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary-400" />
            Contact & Website
          </h3>
          <div className="space-y-3 text-sm text-gray-600\">
            {college.website && (
              <a
                href={college.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary-400 hover:text-primary-300 transition-colors break-all"
              >
                <ExternalLink className="w-4 h-4 flex-shrink-0" />
                {college.website}
              </a>
            )}
            {college.phone && (
              <div className="flex items-start gap-2">
                <span className="text-gray-600 flex-shrink-0">📞</span>
                <span>{college.phone}</span>
              </div>
            )}
            {college.email && (
              <div className="flex items-start gap-2">
                <span className="text-gray-600 flex-shrink-0">📧</span>
                <a href={`mailto:${college.email}`} className="text-primary-400 hover:text-primary-300 transition-colors break-all">
                  {college.email}
                </a>
              </div>
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
          <h1 className="text-4xl font-bold mb-2">Colleges & Universities</h1>
          <p className="text-gray-400">Browse {total} colleges | Page {page} of {Math.ceil(total / pageSize)}</p>
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
                placeholder="Search college name..."
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
              <option value="nirf">NIRF Rank</option>
              <option value="name">A-Z</option>
            </select>
          </div>
        </motion.div>

        {/* Split View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - College List */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="sticky top-24">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">
                {loading ? 'Loading colleges...' : `${colleges.length} Colleges`}
              </h2>
              <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <div key={i} className="h-24 bg-gray-100 border border-gray-200 rounded-lg animate-pulse" />
                  ))
                ) : colleges.length > 0 ? (
                  <AnimatePresence>
                    {colleges.map((college) => (
                      <CollegeCard
                        key={college.id}
                        college={college}
                        isSelected={selectedCollege?.id === college.id}
                        onClick={() => handleCollegeSelect(college)}
                      />
                    ))}
                  </AnimatePresence>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No colleges found. Try adjusting your filters.</p>
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

          {/* Right Panel - College Details */}
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
                  <CollegeDetails college={selectedCollege} />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
