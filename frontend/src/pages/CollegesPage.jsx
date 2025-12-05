import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, MapPin, TrendingUp, Users, ExternalLink, AlertTriangle, Filter, Search, SortAsc, Award, Sparkles, Zap, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../config/api'
import { PAGINATION, ANIMATION_DELAYS, DEBOUNCE_DELAYS } from '../config/constants'
import { useDebounce } from '../hooks/useDebounce'
import ScrollToTop from '../components/ScrollToTop'
import { GridSkeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { NewBadge } from '../components/StatusBadge'

export default function CollegesPage() {
  const [colleges, setColleges] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [recommendedCollegeIds, setRecommendedCollegeIds] = useState(new Set())
  const [highMatchRecs, setHighMatchRecs] = useState([])
  const [mediumMatchRecs, setMediumMatchRecs] = useState([])
  const [lowMatchRecs, setLowMatchRecs] = useState([])
  const [eligibilityGaps, setEligibilityGaps] = useState([])
  const [showAllColleges, setShowAllColleges] = useState(false)
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

  // Fetch recommendations on mount
  useEffect(() => {
    fetchRecommendations()
  }, [])

  useEffect(() => {
    fetchColleges()
  }, [page, debouncedFilters])

  const fetchRecommendations = async () => {
    try {
      // First get current student's applicant profile
      const studentRes = await api.get('/api/student/applicant')
      const applicantId = studentRes.data?.id

      if (!applicantId) {
        console.log('No applicant profile found')
        setShowAllColleges(true)
        return
      }

      // Then fetch recommendations
      const response = await api.get(`/api/recommendations/${applicantId}`)
      const collegeRecs = response.data?.college_recommendations || []

      // Transform data with robust fallback for different API versions
      const transformedRecs = collegeRecs.map(rec => {
        // Handle "Old" Format (Nested object, decimal score 0-1)
        if (rec.college) {
          return {
            college_id: rec.college.id,
            college_name: rec.college.name,
            recommend_score: rec.recommend_score * 100, // Convert 0.54 -> 54
            explain: rec.explain,
            location_city: rec.college.location_city,
            location_state: rec.college.location_state,
            status: rec.status
          }
        }

        // Handle "New" Format (Flat object, percentage score 0-100)
        return {
          college_id: rec.id,
          college_name: rec.name,
          recommend_score: rec.match_score,
          explain: { reasons: [rec.recommendation_reason] },
          location_city: rec.location ? rec.location.split(',')[0].trim() : '',
          location_state: rec.location && rec.location.includes(',') ? rec.location.split(',')[1].trim() : '',
          status: 'recommended'
        }
      })

      // Categorize by match score
      const high = transformedRecs.filter(r => r.recommend_score >= 80)
      const medium = transformedRecs.filter(r => r.recommend_score >= 50 && r.recommend_score < 80)
      const low = transformedRecs.filter(r => r.recommend_score >= 20 && r.recommend_score < 50)

      setHighMatchRecs(high.sort((a, b) => b.recommend_score - a.recommend_score))
      setMediumMatchRecs(medium.sort((a, b) => b.recommend_score - a.recommend_score))
      setLowMatchRecs(low.sort((a, b) => b.recommend_score - a.recommend_score))

      setRecommendations(transformedRecs)
      setRecommendedCollegeIds(new Set(transformedRecs.map(r => r.college_id)))

      // Extract eligibility gaps from explain reasons
      const gaps = new Set()
      transformedRecs.forEach(rec => {
        if (rec.explain?.reasons) {
          rec.explain.reasons.forEach(reason => {
            if (reason.toLowerCase().includes('cgpa') || reason.toLowerCase().includes('jee')) {
              gaps.add(reason)
            }
          })
        }
      })
      setEligibilityGaps(Array.from(gaps).slice(0, 5))

      // Only show all colleges if no recommendations found
      if (transformedRecs.length === 0) {
        setShowAllColleges(true)
      }
    } catch (error) {
      // Silently fail if user hasn't uploaded resume yet
      console.error('No recommendations available yet:', error)
      setShowAllColleges(true)
    }
  }

  const fetchColleges = async () => {
    try {
      setError(null)
      setLoading(true)
      const response = await api.get('/api/colleges', {
        params: { skip: (page - 1) * pageSize, limit: pageSize, ...debouncedFilters }
      })
      setColleges(response.data?.colleges || [])
      setTotal(response.data?.total || 0)
    } catch (error) {
      console.error('Error fetching colleges:', error)
      setError(error.response?.data?.detail || 'Failed to load colleges. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading && colleges.length === 0) {
    return (
      <div className="min-h-screen bg-dark-900 pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="h-10 bg-dark-800 rounded w-80 mb-2 animate-pulse"></div>
            <div className="h-6 bg-dark-800 rounded w-96 animate-pulse"></div>
          </div>
          <GridSkeleton count={9} columns={3} />
        </div>
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
          className="mb-6"
        >
          <div className="bg-dark-800/50 backdrop-blur-sm border border-dark-700/50 rounded-xl p-4">
            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search college name..."
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                className="w-full bg-dark-900/80 border border-dark-600 rounded-lg px-10 py-2.5 text-sm focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-colors"
              />
            </div>

            {/* Inline Filters */}
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Location"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                className="flex-1 min-w-[130px] bg-dark-900/60 border border-dark-600/60 rounded-lg px-3 py-2 text-sm focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-colors"
              />
              <input
                type="number"
                placeholder="Max JEE Rank"
                value={filters.min_jee_rank}
                onChange={(e) => setFilters({ ...filters, min_jee_rank: e.target.value })}
                className="flex-1 min-w-[130px] bg-dark-900/60 border border-dark-600/60 rounded-lg px-3 py-2 text-sm focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-colors"
              />
              <input
                type="number"
                step="0.1"
                placeholder="Min CGPA"
                value={filters.min_cgpa}
                onChange={(e) => setFilters({ ...filters, min_cgpa: e.target.value })}
                className="flex-1 min-w-[110px] bg-dark-900/60 border border-dark-600/60 rounded-lg px-3 py-2 text-sm focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-colors"
              />
              <input
                type="number"
                placeholder="Min Programs"
                value={filters.programs_min}
                onChange={(e) => setFilters({ ...filters, programs_min: e.target.value })}
                className="flex-1 min-w-[130px] bg-dark-900/60 border border-dark-600/60 rounded-lg px-3 py-2 text-sm focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-colors"
              />
              <div className="relative flex-1 min-w-[110px]">
                <SortAsc className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={filters.sort}
                  onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                  className="w-full bg-dark-900/60 border border-dark-600/60 rounded-lg pl-8 pr-3 py-2 text-sm focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-colors appearance-none"
                >
                  <option value="popular">Popular</option>
                  <option value="name">A-Z</option>
                </select>
              </div>
              <button
                onClick={() => setFilters({ location: '', min_jee_rank: '', min_cgpa: '', programs_min: '', q: '', sort: 'popular' })}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-dark-600/60 hover:border-dark-500 rounded-lg transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </motion.div>

        {/* Personalized Recommendations - Progressive Matching */}
        {!showAllColleges && recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 mb-12"
          >
            {/* High Match (80%+) */}
            {highMatchRecs.length > 0 && (
              <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-6 h-6 text-green-400 fill-green-400" />
                  <h2 className="text-xl font-bold text-green-300">Perfect Matches (80%+)</h2>
                </div>
                <p className="text-gray-400 mb-4">You meet the eligibility criteria for these institutions:</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {highMatchRecs.slice(0, 6).map((rec, idx) => {
                    const collegeData = colleges.find(c => c.id === rec.college_id)
                    return (
                      <motion.div
                        key={rec.college_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <Link to={`/college/${rec.college_id}`}>
                          <div className="bg-dark-800/50 hover:bg-dark-800 border border-green-500/20 hover:border-green-500/50 rounded-lg p-4 transition-all cursor-pointer h-full flex flex-col">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex-1">
                                <h3 className="font-semibold text-sm leading-tight">{collegeData?.name || 'College'}</h3>
                              </div>
                              {rec.recommend_score && (
                                <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs font-bold rounded whitespace-nowrap">
                                  {Math.round(rec.recommend_score)}%
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mb-2">
                              {collegeData?.location_city && `${collegeData.location_city}, ${collegeData.location_state || ''}`}
                            </p>
                            {rec.explain?.reasons && (
                              <p className="text-xs text-gray-500 flex-1">{rec.explain.reasons[0]}</p>
                            )}
                            <button className="btn-primary text-xs px-3 py-1.5 mt-3 w-full">Apply Now</button>
                          </div>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
                {highMatchRecs.length > 6 && (
                  <p className="text-xs text-gray-500 mt-3">+{highMatchRecs.length - 6} more perfect matches</p>
                )}
              </div>
            )}

            {/* Medium Match (50-80%) */}
            {mediumMatchRecs.length > 0 && (
              <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-6 h-6 text-blue-300" />
                  <h2 className="text-xl font-bold text-blue-300">Strong Matches (50-80%)</h2>
                </div>
                <p className="text-gray-400 mb-4">You're close! Improve your scores slightly to become eligible:</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {mediumMatchRecs.slice(0, 6).map((rec, idx) => {
                    const collegeData = colleges.find(c => c.id === rec.college_id)
                    return (
                      <motion.div
                        key={rec.college_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <Link to={`/college/${rec.college_id}`}>
                          <div className="bg-dark-800/50 hover:bg-dark-800 border border-blue-500/20 hover:border-blue-500/50 rounded-lg p-4 transition-all cursor-pointer h-full flex flex-col">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex-1">
                                <h3 className="font-semibold text-sm leading-tight">{collegeData?.name || 'College'}</h3>
                              </div>
                              {rec.recommend_score && (
                                <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold rounded whitespace-nowrap">
                                  {Math.round(rec.recommend_score)}%
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mb-2">
                              {collegeData?.location_city && `${collegeData.location_city}, ${collegeData.location_state || ''}`}
                            </p>
                            {rec.explain?.reasons && (
                              <p className="text-xs text-gray-500 flex-1">{rec.explain.reasons[0]}</p>
                            )}
                            <button className="btn-secondary text-xs px-3 py-1.5 mt-3 w-full">View</button>
                          </div>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
                {mediumMatchRecs.length > 6 && (
                  <p className="text-xs text-gray-500 mt-3">+{mediumMatchRecs.length - 6} more strong matches</p>
                )}
              </div>
            )}

            {/* Low Match (20-50%) + Learning Path */}
            {lowMatchRecs.length > 0 && (
              <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-6 h-6 text-orange-300" />
                  <h2 className="text-xl font-bold text-orange-300">Growth Opportunities (20-50%)</h2>
                </div>
                <p className="text-gray-400 mb-4">With improved academics, you could get into these colleges:</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                  {lowMatchRecs.slice(0, 3).map((rec, idx) => {
                    const collegeData = colleges.find(c => c.id === rec.college_id)
                    return (
                      <motion.div
                        key={rec.college_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <Link to={`/college/${rec.college_id}`}>
                          <div className="bg-dark-800/50 hover:bg-dark-800 border border-orange-500/20 hover:border-orange-500/50 rounded-lg p-4 transition-all cursor-pointer h-full flex flex-col">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <h3 className="font-semibold text-sm leading-tight">{collegeData?.name || 'College'}</h3>
                              </div>
                              {rec.recommend_score && (
                                <span className="px-2 py-1 bg-orange-500/20 text-orange-300 text-xs font-bold rounded whitespace-nowrap">
                                  {Math.round(rec.recommend_score)}%
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-2">
                              {collegeData?.location_city && `${collegeData.location_city}, ${collegeData.location_state || ''}`}
                            </p>
                          </div>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>

                {/* Eligibility Improvement Path */}
                <div className="bg-dark-900/50 border border-orange-500/10 rounded-lg p-4">
                  <h3 className="font-semibold text-orange-300 mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    How to Improve Your Eligibility
                  </h3>
                  <div className="space-y-2">
                    {eligibilityGaps.length > 0 ? (
                      eligibilityGaps.map((gap, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-orange-400 mt-1">•</span>
                          <span className="text-gray-300">{gap}</span>
                        </div>
                      ))
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-sm">
                          <span className="text-orange-400 mt-1">•</span>
                          <span className="text-gray-300">Improve CGPA: Focus on coursework and academics</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <span className="text-orange-400 mt-1">•</span>
                          <span className="text-gray-300">Retake JEE: With dedicated preparation, improve your rank</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <span className="text-orange-400 mt-1">•</span>
                          <span className="text-gray-300">Develop Additional Skills: Take online courses in required specializations</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <Link to="/learning-paths">
                    <button className="mt-4 w-full btn-secondary text-xs py-2">
                      View Academic Support & Resources
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* No Recommendations - Show All Colleges */}
        {showAllColleges && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg"
          >
            <p className="text-blue-300 text-sm">
              🎓 Upload your resume to get personalized college recommendations based on your academic profile!
            </p>
          </motion.div>
        )}

        {/* All Colleges - Only show if no personalized recommendations or user chooses to browse all */}
        {showAllColleges && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Browse All Colleges</h2>
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
                        <div className="flex items-center space-x-3 flex-1">
                          <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <GraduationCap className="w-6 h-6 text-primary-400" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg leading-tight">{college.name}</h3>
                              {recommendedCollegeIds.has(college.id) && (
                                <motion.div
                                  title="Recommended for you"
                                  animate={{ scale: [1, 1.1, 1] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                >
                                  <Sparkles className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                </motion.div>
                              )}
                            </div>
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
          </div>
        )}

        {colleges.length === 0 && !loading && (
          <EmptyState
            icon="search"
            title="No Colleges Found"
            message={filters.q || filters.location || filters.min_jee_rank
              ? "Try adjusting your filters to discover more institutions."
              : "No colleges are currently listed. Check back soon!"}
            actionLabel={filters.q || filters.location || filters.min_jee_rank ? "Clear Filters" : undefined}
            onAction={filters.q || filters.location || filters.min_jee_rank ? () => {
              setFilters({
                location: '',
                min_jee_rank: '',
                min_cgpa: '',
                programs_min: '',
                q: '',
                sort: 'popular'
              })
              setPage(1)
            } : undefined}
          />
        )}

        {/* Pagination */}
        {Math.ceil(total / pageSize) > 1 && (
          <div className="flex justify-center items-center space-x-2 mt-8">
            <button
              onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              disabled={page === 1}
              className="px-4 py-2 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-gray-400">
              Page {page} of {Math.ceil(total / pageSize)}
            </span>
            <button
              onClick={() => { setPage(p => Math.min(Math.ceil(total / pageSize), p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              disabled={page === Math.ceil(total / pageSize)}
              className="px-4 py-2 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
        <ScrollToTop />
      </div>
    </div>
  )
}
