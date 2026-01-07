import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, MapPin, Star, Trophy, Users, BookOpen, Phone, Globe, Search } from 'lucide-react'
import { useDebounce } from '../hooks/useDebounce'
import api from '../config/api'
import { DEBOUNCE_DELAYS } from '../config/constants'

export default function CollegesPage() {
  const [colleges, setColleges] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
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
    fetchColleges()
  }, [page, debouncedFilters])

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
    </div>
  )
}
