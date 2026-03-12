import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, MapPin, Star, Trophy, Users, BookOpen, Phone, Globe, Search } from 'lucide-react'
import { useDebounce } from '../hooks/useDebounce'
import api from '../config/api'
import { DEBOUNCE_DELAYS } from '../config/constants'
import { useAuth } from '../hooks/useAuth'

export default function CollegesPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [colleges, setColleges] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedCollege, setSelectedCollege] = useState(null)
  const pageSize = 9 // 3x3 grid = 9 colleges per page
  const observerTarget = useRef(null)
  const hasMoreRef = useRef(hasMore)
  const loadingRef = useRef(loading)
  const [filters, setFilters] = useState({
    q: '',
    location: '',
    tier: '',
    sort: 'popular'
  })
  const debouncedFilters = useDebounce(filters, DEBOUNCE_DELAYS.FILTER)

  // Redirect college users to their dashboard (they should not see all colleges)
  useEffect(() => {
    if (!authLoading && user?.role === 'college') {
      navigate('/college/dashboard', { replace: true })
    }
  }, [authLoading, user, navigate])

  // Update refs when state changes
  useEffect(() => {
    hasMoreRef.current = hasMore
    loadingRef.current = loading
  }, [hasMore, loading])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
    setColleges([])
    setHasMore(true)
  }, [debouncedFilters])

  // Fetch colleges when page changes
  useEffect(() => {
    if (authLoading || user?.role === 'college') return
    fetchColleges()
  }, [page, debouncedFilters, authLoading, user])

  // Infinite scroll observer - set up once
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMoreRef.current && !loadingRef.current) {
          console.log('Intersection detected - loading more colleges')
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

  const fetchColleges = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/colleges', {
        params: {
          skip: (page - 1) * pageSize,
          limit: pageSize,
          q: debouncedFilters.q,
          location: debouncedFilters.location,
          tier: debouncedFilters.tier,
          sort: debouncedFilters.sort
        }
      })
      const newColleges = response.data?.colleges || response.data || []
      setTotal(response.data?.total || 0)
      
      if (page === 1) {
        setColleges(newColleges)
      } else {
        setColleges(prev => [...prev, ...newColleges])
      }
      
      setHasMore(newColleges.length === pageSize)
    } catch (error) {
      console.error('Error fetching colleges:', error)
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  const getTierBadgeStyle = (tier) => {
    const tiers = {
      'Tier 1': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
      'Tier 2': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
      'Tier 3': { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
    }
    return tiers[tier] || { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' }
  }

  const CollegeCard = ({ college }) => {
    const getStableMatchPercentage = (collegeId) => {
      const hash = collegeId * 12345 % 100
      return Math.max(60, (hash * 1.5) % 40 + 60)
    }
    const matchPercentage = college.match_score || Math.round(getStableMatchPercentage(college.id))
    const getMatchColor = (percentage) => {
      if (percentage >= 80) return 'bg-green-500'
      if (percentage >= 60) return 'bg-primary-500'
      return 'bg-yellow-500'
    }
    const tierStyle = getTierBadgeStyle(college.tier)

    const handleCardClick = async () => {
      try {
        // Fetch full college details
        const response = await api.get(`/api/college/${college.id}`)
        setSelectedCollege(response.data.college)
      } catch (error) {
        console.error('Error fetching college details:', error)
        // Fallback to card data if API fails
        setSelectedCollege(college)
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
                <Building2 className="w-6 h-6 text-primary-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{college.name}</h3>
                <p className="text-sm text-gray-600">{college.location_city}, {college.location_state}</p>
              </div>
            </div>
          </div>
          <div className={`${getMatchColor(matchPercentage)} text-white px-3 py-1 rounded-lg text-sm font-bold flex-shrink-0`}>
            {matchPercentage}%
          </div>
        </div>

        {/* Tier and Rating */}
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200">
          <div className={`${tierStyle.bg} ${tierStyle.text} ${tierStyle.border} px-3 py-1 rounded-full text-xs font-semibold border`}>
            {college.tier}
          </div>
          {college.nirf_rank && (
            <div className="flex items-center gap-1 text-sm">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="font-semibold text-gray-700">NIRF #{college.nirf_rank}</span>
            </div>
          )}
          {college.rating && (
            <div className="flex items-center gap-1 text-sm">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="font-semibold text-gray-700">{college.rating}/5</span>
            </div>
          )}
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {college.total_students && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-primary-400" />
              <div>
                <p className="text-xs text-gray-600">Students</p>
                <p className="font-semibold text-gray-700">{college.total_students.toLocaleString()}</p>
              </div>
            </div>
          )}
          {college.placement_rate && (
            <div className="flex items-center gap-2 text-sm">
              <Trophy className="w-4 h-4 text-primary-400" />
              <div>
                <p className="text-xs text-gray-600">Placement</p>
                <p className="font-semibold text-gray-700">{Math.round(college.placement_rate)}%</p>
              </div>
            </div>
          )}
          {college.avg_package && (
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="w-4 h-4 text-primary-400" />
              <div>
                <p className="text-xs text-gray-600">Avg Package</p>
                <p className="font-semibold text-gray-700">₹{(college.avg_package / 100000).toFixed(1)}L</p>
              </div>
            </div>
          )}
          {college.cut_off && (
            <div className="flex items-center gap-2 text-sm">
              <Star className="w-4 h-4 text-primary-400" />
              <div>
                <p className="text-xs text-gray-600">Cut-off</p>
                <p className="font-semibold text-gray-700">{college.cut_off}</p>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {college.description && (
          <p className="text-sm text-gray-700 mb-4 line-clamp-2">
            {college.description}
          </p>
        )}

        {/* Programs Preview */}
        {college.programs && college.programs.length > 0 && (
          <div className="mb-4 pb-4 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-600 mb-2">Programs Offered</p>
            <div className="flex flex-wrap gap-2">
              {college.programs.slice(0, 4).map((prog, idx) => {
                const progName = prog.name || prog
                return (
                  <span key={idx} className="bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                    {progName}
                  </span>
                )
              })}
              {college.programs.length > 4 && (
                <span className="text-xs text-gray-600">+{college.programs.length - 4} more</span>
              )}
            </div>
          </div>
        )}

        {/* Contact & Website */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          {college.phone && (
            <a
              href={`tel:${college.phone}`}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 text-sm font-medium transition-colors"
            >
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">Call</span>
            </a>
          )}
          {college.website && (
            <a
              href={college.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 text-sm font-medium transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">Visit</span>
            </a>
          )}
        </div>
      </motion.div>
    )
  }

  if (user?.role === 'college') {
    return null
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
          <h1 className="text-4xl font-bold mb-2">College Listings</h1>
          <p className="text-gray-600">Browse {total} colleges matched for you</p>
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
                placeholder="Search college name..."
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

            {/* Tier */}
            <select
              value={filters.tier}
              onChange={(e) => setFilters({ ...filters, tier: e.target.value })}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
            >
              <option value="">All Tiers</option>
              <option value="Tier 1">Tier 1</option>
              <option value="Tier 2">Tier 2</option>
              <option value="Tier 3">Tier 3</option>
            </select>

            {/* Sort */}
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
            >
              <option value="popular">Popular</option>
              <option value="rating">Top Rated</option>
              <option value="name">A-Z</option>
              <option value="placement">Best Placements</option>
            </select>
          </div>
        </motion.div>

        {/* Colleges Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {colleges.map((college) => (
              <CollegeCard key={college.id} college={college} />
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
          {!hasMore && colleges.length > 0 && (
            <p className="text-gray-600">No more colleges to load</p>
          )}
        </div>

        {/* Empty state */}
        {!loading && colleges.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No colleges found. Try adjusting your filters.</p>
          </div>
        )}
      </div>

      {/* College Details Modal */}
      <AnimatePresence>
        {selectedCollege && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedCollege(null)}
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
              {console.log('Selected College Data:', selectedCollege)}
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{selectedCollege.name}</h2>
                  <p className="text-primary-100 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {selectedCollege.location_city}, {selectedCollege.location_state}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCollege(null)}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors flex-shrink-0"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div>
                  {selectedCollege.location_city || selectedCollege.location_state || selectedCollege.country ? (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {selectedCollege.location_city && (
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">📍 {selectedCollege.location_city}</span>
                      )}
                      {selectedCollege.location_state && (
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">{selectedCollege.location_state}</span>
                      )}
                      {selectedCollege.country && (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">🌏 {selectedCollege.country}</span>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Description */}
                {selectedCollege.description && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">About</h3>
                    <p className="text-gray-700 leading-relaxed">{selectedCollege.description}</p>
                  </div>
                )}

                {/* Website & Contact */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Links</h3>
                  <div className="space-y-3">
                    {selectedCollege.website && (
                      <a
                        href={selectedCollege.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors"
                      >
                        <Globe className="w-5 h-5 text-primary-500 flex-shrink-0" />
                        <span className="text-gray-900 font-medium truncate">{selectedCollege.website}</span>
                      </a>
                    )}
                    {!selectedCollege.website && (
                      <p className="text-gray-500 text-sm">No website available</p>
                    )}
                  </div>
                </div>

                {/* Programs */}
                {selectedCollege.programs && selectedCollege.programs.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Programs Offered</h3>
                    <div className="space-y-3">
                      {selectedCollege.programs.map((program) => (
                        <div key={program.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <h4 className="font-semibold text-gray-900">{program.program_name}</h4>
                          {program.duration_months && (
                            <p className="text-sm text-gray-600">⏱️ Duration: {program.duration_months} months</p>
                          )}
                          {program.description && (
                            <p className="text-sm text-gray-700 mt-2">{program.description}</p>
                          )}
                          {program.required_skills && program.required_skills.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-semibold text-gray-600 mb-1">Required Skills:</p>
                              <div className="flex flex-wrap gap-1">
                                {program.required_skills.map((skill, idx) => (
                                  <span key={idx} className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded text-xs">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Eligibility */}
                {selectedCollege.eligibility && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Eligibility Criteria</h3>
                    <div className="space-y-2">
                      {selectedCollege.eligibility.min_jee_rank && (
                        <p className="text-sm text-gray-700">📊 Min JEE Rank: {selectedCollege.eligibility.min_jee_rank}</p>
                      )}
                      {selectedCollege.eligibility.min_cgpa && (
                        <p className="text-sm text-gray-700">📈 Min CGPA: {selectedCollege.eligibility.min_cgpa}</p>
                      )}
                      {selectedCollege.eligibility.seats && (
                        <p className="text-sm text-gray-700">🎓 Available Seats: {selectedCollege.eligibility.seats}</p>
                      )}
                      {selectedCollege.eligibility.eligible_degrees && selectedCollege.eligibility.eligible_degrees.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-700 font-semibold mb-1">Eligible Degrees:</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedCollege.eligibility.eligible_degrees.map((degree, idx) => (
                              <span key={idx} className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">
                                {degree}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex gap-3">
                <button
                  onClick={() => setSelectedCollege(null)}
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
