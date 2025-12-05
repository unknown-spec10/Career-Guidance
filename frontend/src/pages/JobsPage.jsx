import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Briefcase, MapPin, Clock, TrendingUp, Filter, AlertTriangle, Search, SortAsc, Sparkles, Zap, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDebounce } from '../hooks/useDebounce'
import api from '../config/api'
import { PAGINATION, DEBOUNCE_DELAYS, ANIMATION_DELAYS } from '../config/constants'
import ScrollToTop from '../components/ScrollToTop'
import { ListSkeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { NewBadge } from '../components/StatusBadge'

export default function JobsPage() {
  const [jobs, setJobs] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [recommendedJobIds, setRecommendedJobIds] = useState(new Set())
  const [highMatchRecs, setHighMatchRecs] = useState([])
  const [mediumMatchRecs, setMediumMatchRecs] = useState([])
  const [lowMatchRecs, setLowMatchRecs] = useState([])
  const [skillGaps, setSkillGaps] = useState([])
  const [showAllJobs, setShowAllJobs] = useState(false)
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

  // Fetch recommendations on mount
  useEffect(() => {
    fetchRecommendations()
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [debouncedFilters, page])

  const fetchRecommendations = async () => {
    try {
      // First get current student's applicant profile
      const studentRes = await api.get('/api/student/applicant')
      const applicantId = studentRes.data?.id

      if (!applicantId) {
        console.log('No applicant profile found')
        setShowAllJobs(true)
        return
      }

      // Then fetch recommendations
      const response = await api.get(`/api/recommendations/${applicantId}`)
      const jobRecs = response.data?.job_recommendations || []

      // Transform data with robust fallback for different API versions
      const transformedRecs = jobRecs.map(rec => {
        // Handle "Old" Format (Nested object, decimal score 0-1)
        if (rec.job) {
          return {
            job_id: rec.job.id,
            job_name: rec.job.title,
            score: rec.score * 100, // Convert 0.54 -> 54
            recommend_score: rec.score * 100,
            explain: rec.explain,
            company: rec.job.company,
            status: rec.status
          }
        }

        // Handle "New" Format (Flat object, percentage score 0-100)
        return {
          job_id: rec.id,
          job_name: rec.title,
          score: rec.match_score,
          recommend_score: rec.match_score,
          explain: { reasons: [rec.recommendation_reason] },
          company: rec.company,
          status: 'recommended'
        }
      })

      // Categorize by match score
      const high = transformedRecs.filter(r => r.score >= 80)
      const medium = transformedRecs.filter(r => r.score >= 50 && r.score < 80)
      const low = transformedRecs.filter(r => r.score >= 20 && r.score < 50)

      setHighMatchRecs(high.sort((a, b) => b.score - a.score))
      setMediumMatchRecs(medium.sort((a, b) => b.score - a.score))
      setLowMatchRecs(low.sort((a, b) => b.score - a.score))

      setRecommendations(transformedRecs)
      setRecommendedJobIds(new Set(transformedRecs.map(r => r.job_id)))

      // Extract skill gaps from explain reasons
      const gaps = new Set()
      transformedRecs.forEach(rec => {
        if (rec.explain?.reasons) {
          rec.explain.reasons.forEach(reason => {
            if (reason.toLowerCase().includes('missing') || reason.toLowerCase().includes('skill')) {
              gaps.add(reason)
            }
          })
        }
      })
      setSkillGaps(Array.from(gaps).slice(0, 5))

      // Only show all jobs if no recommendations found
      if (transformedRecs.length === 0) {
        setShowAllJobs(true)
      }
    } catch (error) {
      // Silently fail if user hasn't uploaded resume yet
      console.error('No recommendations available yet:', error)
      setShowAllJobs(true)
    }
  }

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
      setJobs(response.data?.jobs || [])
      setTotal(response.data?.total || 0)
    } catch (error) {
      console.error('Error fetching jobs:', error)
      setError(error.response?.data?.detail || 'Failed to load jobs. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading && jobs.length === 0) {
    return (
      <div className="min-h-screen bg-dark-900 pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="h-10 bg-dark-800 rounded w-64 mb-2 animate-pulse"></div>
            <div className="h-6 bg-dark-800 rounded w-96 animate-pulse"></div>
          </div>
          <ListSkeleton count={5} />
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
          className="mb-6"
        >
          <div className="bg-dark-800/50 backdrop-blur-sm border border-dark-700/50 rounded-xl p-4">
            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search title or company..."
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                className="w-full bg-dark-900/80 border border-dark-600 rounded-lg px-10 py-2.5 text-sm focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-colors"
              />
            </div>

            {/* Inline Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="flex-1 min-w-[140px]">
                <input
                  type="text"
                  placeholder="Location"
                  value={filters.location}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                  className="w-full bg-dark-900/60 border border-dark-600/60 rounded-lg px-3 py-2 text-sm focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-colors"
                />
              </div>
              <select
                value={filters.work_type}
                onChange={(e) => setFilters({ ...filters, work_type: e.target.value })}
                className="flex-1 min-w-[120px] bg-dark-900/60 border border-dark-600/60 rounded-lg px-3 py-2 text-sm focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-colors"
              >
                <option value="">All Types</option>
                <option value="remote">Remote</option>
                <option value="on-site">On-site</option>
                <option value="hybrid">Hybrid</option>
              </select>
              <input
                type="text"
                placeholder="Skills (comma separated)"
                value={filters.skills}
                onChange={(e) => setFilters({ ...filters, skills: e.target.value })}
                className="flex-1 min-w-[180px] bg-dark-900/60 border border-dark-600/60 rounded-lg px-3 py-2 text-sm focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-colors"
              />
              <div className="relative flex-1 min-w-[120px]">
                <SortAsc className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={filters.sort}
                  onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                  className="w-full bg-dark-900/60 border border-dark-600/60 rounded-lg pl-8 pr-3 py-2 text-sm focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-colors appearance-none"
                >
                  <option value="popular">Popular</option>
                  <option value="recent">Recent</option>
                  <option value="title">A-Z</option>
                </select>
              </div>
              <button
                onClick={() => setFilters({ location: '', work_type: '', q: '', skills: '', sort: 'popular', min_popularity: '' })}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-dark-600/60 hover:border-dark-500 rounded-lg transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </motion.div>

        {/* Personalized Recommendations - Progressive Matching */}
        {!showAllJobs && recommendations.length > 0 && (
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
                <p className="text-gray-400 mb-4">These jobs are an excellent fit for your profile:</p>

                <div className="grid gap-3">
                  {highMatchRecs.slice(0, 5).map((rec, idx) => {
                    const jobData = jobs.find(j => j.id === rec.job_id)
                    return (
                      <motion.div
                        key={rec.job_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <Link to={`/job/${rec.job_id}`}>
                          <div className="bg-dark-800/50 hover:bg-dark-800 border border-green-500/20 hover:border-green-500/50 rounded-lg p-4 transition-all cursor-pointer">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold">{jobData?.title || rec.job_name}</h3>
                                  <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs font-bold rounded">
                                    {Math.round(rec.recommend_score)}% match
                                  </span>
                                </div>
                                <p className="text-sm text-gray-400 mb-2">{jobData?.company || rec.company}</p>
                                {rec.explain?.reasons && (
                                  <p className="text-xs text-gray-500">{rec.explain.reasons[0]}</p>
                                )}
                              </div>
                              <button className="btn-primary text-xs px-3 py-1 whitespace-nowrap">Apply Now</button>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
                {highMatchRecs.length > 5 && (
                  <p className="text-xs text-gray-500 mt-3">+{highMatchRecs.length - 5} more perfect matches</p>
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
                <p className="text-gray-400 mb-4">You meet most requirements for these roles. Consider upskilling in areas noted below:</p>

                <div className="grid gap-3">
                  {mediumMatchRecs.slice(0, 5).map((rec, idx) => {
                    const jobData = jobs.find(j => j.id === rec.job_id)
                    return (
                      <motion.div
                        key={rec.job_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <Link to={`/job/${rec.job_id}`}>
                          <div className="bg-dark-800/50 hover:bg-dark-800 border border-blue-500/20 hover:border-blue-500/50 rounded-lg p-4 transition-all cursor-pointer">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold">{jobData?.title || rec.job_name}</h3>
                                  <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold rounded">
                                    {Math.round(rec.recommend_score)}% match
                                  </span>
                                </div>
                                <p className="text-sm text-gray-400 mb-2">{jobData?.company || rec.company}</p>
                                {rec.explain?.reasons && (
                                  <p className="text-xs text-gray-500">{rec.explain.reasons[0]}</p>
                                )}
                              </div>
                              <button className="btn-secondary text-xs px-3 py-1 whitespace-nowrap">View</button>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
                {mediumMatchRecs.length > 5 && (
                  <p className="text-xs text-gray-500 mt-3">+{mediumMatchRecs.length - 5} more strong matches</p>
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
                <p className="text-gray-400 mb-4">With some skill development, you could qualify for these roles:</p>

                <div className="grid gap-3 mb-6">
                  {lowMatchRecs.slice(0, 3).map((rec, idx) => {
                    const jobData = jobs.find(j => j.id === rec.job_id)
                    return (
                      <motion.div
                        key={rec.job_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <Link to={`/job/${rec.job_id}`}>
                          <div className="bg-dark-800/50 hover:bg-dark-800 border border-orange-500/20 hover:border-orange-500/50 rounded-lg p-4 transition-all cursor-pointer">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-sm">{jobData?.title || rec.job_name}</h3>
                                  <span className="px-2 py-1 bg-orange-500/20 text-orange-300 text-xs font-bold rounded">
                                    {Math.round(rec.recommend_score)}% match
                                  </span>
                                </div>
                                <p className="text-sm text-gray-400">{jobData?.company || rec.company}</p>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>

                {/* Learning Path Suggestions */}
                <div className="bg-dark-900/50 border border-orange-500/10 rounded-lg p-4">
                  <h3 className="font-semibold text-orange-300 mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Recommended Skills to Learn
                  </h3>
                  <div className="space-y-2">
                    {skillGaps.length > 0 ? (
                      skillGaps.map((gap, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-orange-400 mt-1">•</span>
                          <span className="text-gray-300">{gap}</span>
                        </div>
                      ))
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-sm">
                          <span className="text-orange-400 mt-1">•</span>
                          <span className="text-gray-300">Take courses in required job skills</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <span className="text-orange-400 mt-1">•</span>
                          <span className="text-gray-300">Build portfolio projects demonstrating your expertise</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <span className="text-orange-400 mt-1">•</span>
                          <span className="text-gray-300">Join skill assessment tests to validate knowledge</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <Link to="/learning-paths">
                    <button className="mt-4 w-full btn-secondary text-xs py-2">
                      View Learning Paths & Resources
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* No Recommendations - Show All Jobs */}
        {showAllJobs && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg"
          >
            <p className="text-blue-300 text-sm">
              📋 Upload your resume to get personalized job recommendations matching your skills and experience!
            </p>
          </motion.div>
        )}

        {/* All Jobs - Only show if no personalized recommendations or user chooses to browse all */}
        {showAllJobs && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Browse All Jobs</h2>
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
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-xl">{job.title}</h3>
                              {recommendedJobIds.has(job.id) && (
                                <motion.div
                                  title="Recommended for you"
                                  animate={{ scale: [1, 1.1, 1] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                >
                                  <Sparkles className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                                </motion.div>
                              )}
                              {idx < 3 && job.popularity >= 0.7 && <NewBadge />}
                              {job.popularity >= 0.8 && !recommendedJobIds.has(job.id) && (
                                <motion.div
                                  animate={{ rotate: [0, 10, -10, 0] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                >
                                  <Sparkles className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                </motion.div>
                              )}
                            </div>
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
          </div>
        )}

        {jobs.length === 0 && !loading && (
          <EmptyState
            icon="search"
            title="No Jobs Found"
            message={filters.q || filters.location || filters.skills
              ? "Try adjusting your filters or search terms to find more opportunities."
              : "No job opportunities are currently available. Check back soon!"}
            actionLabel={filters.q || filters.location || filters.skills ? "Clear Filters" : undefined}
            onAction={filters.q || filters.location || filters.skills ? () => {
              setFilters({
                location: '',
                work_type: '',
                q: '',
                skills: '',
                sort: 'popular',
                min_popularity: ''
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
