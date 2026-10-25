import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import SafeMarkdown from '../components/SafeMarkdown'
import {
  Briefcase,
  MapPin,
  Clock,
  Award,
  Building2,
  Sparkles,
  AlertTriangle,
  FilterX,
  Check,
  CheckCircle,
  Loader2,
  RefreshCcw,
  ArrowRight,
  X,
  Zap,
  Send
} from 'lucide-react'
import { useDebounce } from '../hooks/useDebounce'
import { useJobs } from '../hooks/useJobs'
import { useRecommendations } from '../hooks/useRecommendations'
import api from '../config/api'
import { DEBOUNCE_DELAYS } from '../config/constants'
import secureStorage from '../utils/secureStorage'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import { getApiError } from '../utils/apiError'
import { checkSkillMatch, formatBreakdownLabel } from '../utils/skillMatch'
import JobCard, { jobMarkdownComponents } from '../components/JobCard'
import FilterBar from '../components/FilterBar'
import BypassModal, { CooldownTimer } from '../components/BypassModal'

export default function JobsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const currentUser = secureStorage.getItem('user')
  const showApplicantFeatures = currentUser?.role === 'student'

  const [selectedJob, setSelectedJob] = useState(null)

  // Student application tracking
  const [appliedJobIds, setAppliedJobIds] = useState(new Set())
  const [applyingId, setApplyingId] = useState(null)

  const [filters, setFilters] = useState({
    q: '',
    location: '',
    work_type: '',
    sort: showApplicantFeatures ? 'relevance' : 'popular',
  })
  const debouncedFilters = useDebounce(filters, DEBOUNCE_DELAYS.FILTER)

  const pageSize = 9
  const [page, setPage] = useState(1)

  // Client-side batching for the combined student list (recommended first,
  // then more_matches): 21 per batch keeps the 3-column grid aligned.

  const BATCH_SIZE = 21
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)

  // Public listings (non-students) and personalized recommendations (students).
  // Only one path is ever active per role; the combined flags below preserve
  // the original single loading/error/hasMore semantics exactly.
  const {
    jobs,
    hasMore: jobsHasMore,
    loading: jobsLoading,
    fetchError: jobsError,
  } = useJobs({ enabled: !showApplicantFeatures, debouncedFilters, page, setPage, pageSize })

  const {
    rawRecommendations,
    recommendationDetailsByJobId,
    moreMatches,
    canLoadMoreMatches,
    moreLoading,
    loadMoreMatches,
    hasMore: recsHasMore,
    loading: recsLoading,
    fetchError: recsError,
    candidateSkills,
    candidateCity,
    cooldownActive,
    cooldownExpiresAt,
    bypassCost,
    showBypassModal,
    setShowBypassModal,
    creditsBalance,
    recalcLoading,
    handleCooldownEnd,
    handleRecomputeRecommendations,
  } = useRecommendations({ enabled: showApplicantFeatures, toast })

  const loading = jobsLoading || recsLoading
  const fetchError = jobsError || recsError
  const hasMore = showApplicantFeatures ? recsHasMore : jobsHasMore

  const observerTarget = useRef(null)
  const hasMoreRef = useRef(hasMore)
  const loadingRef = useRef(loading)

  useEffect(() => {
    hasMoreRef.current = hasMore
    loadingRef.current = loading
  }, [hasMore, loading])

  // Fetch student application tracking list
  useEffect(() => {
    const fetchAppliedJobs = async () => {
      if (currentUser?.role === 'student') {
        try {
          const response = await api.get('/api/student/applications/jobs')
          const ids = (response.data?.applications || []).map(app => app.job_id)
          setAppliedJobIds(new Set(ids))
        } catch (error) {
          console.error('Error fetching student applications:', error)
        }
      }
    }
    fetchAppliedJobs()
  }, [currentUser?.email])

  const handleApply = useCallback(async (jobId) => {
    if (!currentUser) {
      navigate('/login')
      return
    }
    if (currentUser.role !== 'student') {
      toast.error('Only students can apply to jobs.')
      return
    }

    setApplyingId(jobId)
    try {
      await api.post(`/api/jobs/${jobId}/apply`, { job_id: jobId })
      toast.success('Successfully applied! Your profile has been shared with the recruiter.')
      setAppliedJobIds(prev => new Set([...prev, jobId]))
    } catch (error) {
      const errorMsg = getApiError(error, 'Failed to apply')
      toast.error(errorMsg)
    } finally {
      setApplyingId(null)
    }
  }, [currentUser, navigate, toast])

  const handleOpenDetails = useCallback(async (job) => {
    try {
      const response = await api.get(`/api/job/${job.id}`)
      setSelectedJob(response.data.job)
    } catch (error) {
      console.error('Error fetching job details:', error)
      setSelectedJob(job)
    }
  }, [setSelectedJob])

  const resetFilters = () => {
    setFilters({
      q: '',
      location: '',
      work_type: '',
      sort: showApplicantFeatures ? 'relevance' : 'popular',
    })
  }

  const updateFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const activeFilterCount = [filters.q, filters.location, filters.work_type].filter(Boolean).length

  // Filter + sort shared by the `recommended` cards and the `more_matches`
  // show-more section (no per-list slicing constants — counts come from the API).
  //
  // The single keyword covers the old `q` field (title/company/description)
  // AND the old `skills` field (comma-separated skill tokens) with UNION
  // semantics: a job matches when EITHER the old title/company/description
  // substring check OR the old per-token skill check would have matched.
  const matchesFilters = useCallback((rec) => {
    const job = rec.job || rec
    if (!job) return false

    // Keyword: old `q` title / company / description check first.
    if (filters.q) {
      const q = filters.q.toLowerCase()
      const title = (job.title || '').toLowerCase()
      const company = (job.company || '').toLowerCase()
      const desc = (job.description || '').toLowerCase()
      if (title.includes(q) || company.includes(q) || desc.includes(q)) {
        // Title/company/description hit — union short-circuit, skip skills.
      } else {
        // Keyword: old `skills` check — every comma-separated token must
        // match some job skill (either direction substring). An empty token
        // list preserves the old skills-field pass-through (union hit).
        const skillTokens = q.split(',').map(s => s.trim()).filter(Boolean)
        if (skillTokens.length > 0) {
          const requiredSkills = Array.isArray(job.required_skills)
            ? job.required_skills.map(s => (typeof s === 'object' && s !== null ? String(s.name || '') : String(s)).toLowerCase().trim())
            : []
          const matchedSkills = rec.scoring_breakdown?.skills_breakdown?.matched_skills || []
          const partialSkills = rec.scoring_breakdown?.skills_breakdown?.partial_matches || []
          const recSkills = [...new Set([...matchedSkills, ...partialSkills])].map(s => String(s).toLowerCase().trim())

          const allJobSkills = [...new Set([...requiredSkills, ...recSkills])]

          const hasAllSkills = skillTokens.every(sf =>
            allJobSkills.some(js => js.includes(sf) || sf.includes(js))
          )
          if (!hasAllSkills) return false
        }
      }
    }

    // Location filter
    if (filters.location) {
      const locFilter = filters.location.toLowerCase()
      const city = (job.location_city || '').toLowerCase()
      const state = (job.location_state || '').toLowerCase()
      if (!city.includes(locFilter) && !state.includes(locFilter)) {
        return false
      }
    }

    // Work type filter
    if (filters.work_type) {
      if (job.work_type !== filters.work_type) {
        return false
      }
    }

    return true
  }, [filters.q, filters.location, filters.work_type])

  const compareRecs = useCallback((a, b) => {
    const jobA = a.job || a
    const jobB = b.job || b

    if (filters.sort === 'recent') {
      const dateA = new Date(jobA.created_at || 0)
      const dateB = new Date(jobB.created_at || 0)
      return dateB - dateA
    } else if (filters.sort === 'title') {
      return (jobA.title || '').localeCompare(jobB.title || '')
    } else {
      // Relevance (score desc)
      const scoreA = a.match_score ?? a.score ?? 0
      const scoreB = b.match_score ?? b.score ?? 0
      return scoreB - scoreA
    }
  }, [filters.sort])

  // Filter recommendations locally
  const filteredRecommendations = useMemo(() => {
    return rawRecommendations.filter(matchesFilters)
  }, [rawRecommendations, matchesFilters])

  // Sort recommendations locally
  const sortedRecommendations = useMemo(() => {
    return [...filteredRecommendations].sort(compareRecs)
  }, [filteredRecommendations, compareRecs])

  const sortedMoreMatches = useMemo(() => {
    return moreMatches.filter(matchesFilters).sort(compareRecs)
  }, [moreMatches, matchesFilters, compareRecs])

  // Combined student list: recommended first, then more_matches. Existing
  // filter/sort is applied to each slice before concatenation, then the
  // combined list is batched client-side in groups of 21.
  const combinedSortedRecs = useMemo(() => {
    return [...sortedRecommendations, ...sortedMoreMatches]
  }, [sortedRecommendations, sortedMoreMatches])

  // Reset batching whenever the filter/sort changes so the first 21 of the
  // newly filtered list is shown.
  useEffect(() => {
    setVisibleCount(BATCH_SIZE)
  }, [debouncedFilters])

  const hasMoreBatched = visibleCount < combinedSortedRecs.length

  const visibleRecs = useMemo(() => {
    return combinedSortedRecs.slice(0, visibleCount)
  }, [combinedSortedRecs, visibleCount])

  const displayJobs = useMemo(() => {
    return showApplicantFeatures
      ? visibleRecs.map(rec => rec.job).filter(Boolean)
      : jobs
  }, [showApplicantFeatures, visibleRecs, jobs])

  // "See more" is available while unshown client items remain, or while the
  // server still holds unfetched more_matches pages (offset paging in
  // useRecommendations stays intact; purpose=browse is preserved there).
  const showSeeMore = showApplicantFeatures && (hasMoreBatched || canLoadMoreMatches)
  const studentExhausted = showApplicantFeatures && !hasMoreBatched && !canLoadMoreMatches

  const handleSeeMore = useCallback(async () => {
    if (hasMoreBatched) {
      setVisibleCount((c) => c + BATCH_SIZE)
    } else if (canLoadMoreMatches) {
      await loadMoreMatches()
      setVisibleCount((c) => c + BATCH_SIZE)
    }
  }, [hasMoreBatched, canLoadMoreMatches, loadMoreMatches])

  // Infinite Scroll Hook
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



  return (
    <div className="relative">
      <div className="max-w-container-max mx-auto">

        {/* Header Row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="app-page-title mb-xs">
              {showApplicantFeatures ? 'Recommended Match Roles' : 'Browse Listings'}
            </h1>
            <p className="app-page-subtitle">
              {showApplicantFeatures
                ? 'Personalized career matches sorted by algorithmic suitability.'
                : 'Discover opportunities that align with your career specifications.'}
            </p>
          </motion.div>

          {showApplicantFeatures && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <Link
                to="/dashboard/learning-paths"
                className="app-btn-secondary app-btn-sm inline-flex items-center gap-2"
              >
                <span>Learning Paths</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
              {cooldownActive ? (
                <button
                  onClick={() => handleRecomputeRecommendations(false)}
                  disabled={recalcLoading}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-card font-bold transition-all text-sm shadow-soft-sm border duration-200 active:scale-95 cursor-pointer ${
                    recalcLoading
                      ? 'bg-surface-sunken border-hairline text-ink-subtle cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-600 hover:via-orange-600 hover:to-yellow-600 border-amber-400 text-white shadow-amber-500/20 hover:shadow-amber-500/30'
                  }`}
                >
                  <span>{recalcLoading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Zap className="h-4 w-4 shrink-0 text-white" />}</span>
                  <span>Refresh Now ({bypassCost}c)</span>
                  <CooldownTimer
                    expiresAt={cooldownExpiresAt}
                    onCooldownEnd={handleCooldownEnd}
                    className="ml-1 text-[10px] font-medium bg-black/25 px-2 py-0.5 rounded-pill font-mono text-amber-100"
                  />
                </button>
              ) : (
                <button
                  onClick={() => handleRecomputeRecommendations(false)}
                  disabled={recalcLoading}
                  className={`inline-flex items-center gap-2 font-semibold transition-all shadow-soft-xs cursor-pointer ${ recalcLoading ? 'bg-surface-sunken border-hairline text-ink-subtle cursor-not-allowed rounded-card border text-sm' : 'app-btn-secondary app-btn-sm !rounded-card !text-sm' }`}
                >
                  <RefreshCcw className={`h-4 w-4 shrink-0 ${recalcLoading ? 'animate-spin' : ''}`} />
                  <span>Re-run AI</span>
                </button>
              )}
            </motion.div>
          )}
        </div>

        <FilterBar
          filters={filters}
          updateFilter={updateFilter}
          resetFilters={resetFilters}
          activeFilterCount={activeFilterCount}
          showApplicantFeatures={showApplicantFeatures}
        />

        {fetchError && (
          <div className="mb-4 rounded-card border border-red-200 bg-red-50 p-3 text-caption text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>{fetchError}</span>
          </div>
        )}

        {/* scroll-mt keeps anchored/programmatic scrolls clear of the
            sticky header + FilterBar so the first row never clips underneath. */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 scroll-mt-24 pt-1">
          <AnimatePresence>
            {displayJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                rec={recommendationDetailsByJobId[job.id] || null}
                candidateCity={candidateCity}
                candidateSkills={candidateSkills}
                isApplied={appliedJobIds.has(job.id)}
                isApplying={applyingId === job.id}
                showApplicantFeatures={showApplicantFeatures}
                onApply={handleApply}
                onOpenDetails={handleOpenDetails}
              />
            ))}
          </AnimatePresence>
        </div>

        {loading && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-72 bg-surface-sunken border border-hairline rounded-panel animate-pulse" />
            ))}
          </div>
        )}

        <div ref={observerTarget} className="mt-12 text-center">
          {(showApplicantFeatures ? studentExhausted : !hasMore) && displayJobs.length > 0 && (
            <p className="text-caption text-ink-muted">No more jobs to load</p>
          )}
        </div>

        {showSeeMore && (
          <div className="mt-8 text-center">
            <button
              onClick={handleSeeMore}
              disabled={moreLoading}
 className="app-btn-secondary app-btn-sm inline-flex items-center gap-2 disabled:opacity-50"
            >
              {moreLoading ? 'Loading...' : 'See more'}
            </button>
          </div>
        )}

        {!loading && displayJobs.length === 0 && !fetchError && (
          <div className="surface-card mt-10 p-10 text-center">
            <Briefcase className="w-12 h-12 text-ink-subtle mx-auto mb-3" />
            <h3 className="app-section-title">No Recommendations / Jobs Found</h3>
            <p className="text-body text-ink-muted mt-2">Try adjusting your filters or clearing them to broaden results.</p>
            <button
              onClick={resetFilters}
 className="app-btn-secondary app-btn-sm mt-5 inline-flex items-center gap-2"
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
              className="rounded-panel border border-hairline bg-surface-overlay shadow-soft-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto text-left"
            >
              <div className="sticky top-0 z-10 relative overflow-hidden border-b border-hairline bg-surface-overlay p-6 flex items-start justify-between gap-4">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-50/70 via-surface-overlay to-surface-overlay" />
                <div className="relative flex-1">
                  <div className="inline-flex items-center gap-2 rounded-pill border border-primary-100 bg-primary-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-700 mb-3">
                    <Building2 className="w-3.5 h-3.5" />
                    Job Details
                  </div>
                  <h2 className="font-display text-title-lg text-ink mb-2">{selectedJob.title}</h2>
                  <p className="text-caption font-semibold text-ink-muted flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary-500" />
                    {selectedJob.company}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
 className="relative text-ink-muted hover:text-ink border border-hairline bg-surface-raised p-2.5 rounded-card transition-all flex-shrink-0 shadow-soft-xs"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6 bg-surface-sunken">
                {(() => {
                  const recommendation = recommendationDetailsByJobId[selectedJob.id] || null
                  const explanationText = recommendation?.explanation || recommendation?.explain
                  const breakdownEntries = recommendation?.scoring_breakdown && typeof recommendation.scoring_breakdown === 'object'
                    ? Object.entries(recommendation.scoring_breakdown).filter(([, value]) => value !== null && value !== undefined)
                    : []

                  const explanationLines = recommendation?.explanation
                    ? [recommendation.explanation]
                    : Array.isArray(explanationText)
                      ? explanationText.filter(Boolean)
                      : typeof explanationText === 'string'
                        ? explanationText.split(/\n+/).map((line) => line.trim()).filter(Boolean)
                        : typeof explanationText === 'object' && explanationText !== null
                          ? (explanationText.reasons || [explanationText.summary || '']).filter(Boolean)
                          : []

                  if (!recommendation) return null

                  return (
                    <div className={`border rounded-panel p-5 space-y-4 ${recommendation?.is_fallback ? 'bg-amber-50/50 border-amber-200' : 'bg-surface-raised border-hairline'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="app-label">
                              Recommendation Insights
                            </p>
                          </div>
                          <h3 className="app-section-title">Why this job is recommended</h3>
                        </div>
                      </div>

                      {explanationLines.length > 0 ? (
                        <ul className="space-y-2">
                          {explanationLines.slice(0, 4).map((line) => (
                            <li key={line} className="flex items-start gap-2 text-sm text-ink-muted">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-ink-muted">
                          This role is aligned with your skills, location, and experience profile.
                        </p>
                      )}

                      {breakdownEntries.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          {breakdownEntries.slice(0, 6).map(([key, value]) => (
                            <div key={key} className="rounded-card border border-hairline bg-surface-raised p-3">
                              <p className="app-label">{formatBreakdownLabel(key)}</p>
                              <p className="mt-1 text-sm font-semibold text-ink break-words">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {
                        // Render key skills: prefer explicit job.required_skills, fallback to recommendation matched/partial skills
                        (() => {
                          const explicit = Array.isArray(selectedJob.required_skills) && selectedJob.required_skills.length > 0
                          const matched = recommendation?.scoring_breakdown?.skills_breakdown?.matched_skills || []
                          const partial = recommendation?.scoring_breakdown?.skills_breakdown?.partial_matches || []
                          const fallbackSkills = [...new Set([...matched, ...partial])]
                          const skillsToRender = explicit ? selectedJob.required_skills.slice(0, 8) : fallbackSkills.slice(0, 8)

                          if (!skillsToRender || skillsToRender.length === 0) {
                            return (
                              <div className="rounded-card border border-yellow-100 bg-yellow-50 p-4">
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 text-sm text-yellow-800">
                                    <div className="font-medium">No role-specific skills available</div>
                                    <div className="text-xs text-yellow-800/90 mt-1">We couldn't find explicit skills for this job. You can re-run recommendations or update your profile to surface skill matches.</div>
                                    <div className="mt-3 flex gap-2">
                                      <button
                                        onClick={() => handleRecomputeRecommendations(false)}
                                        className="px-3 py-1 bg-yellow-100 border border-yellow-200 rounded-card text-yellow-800 text-xs font-bold"
                                      >
                                        Re-run Recommendations
                                      </button>
                                      <Link to="/student/profile" className="px-3 py-1 bg-surface-raised border border-hairline rounded-card text-xs text-ink font-bold">Update Profile</Link>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          }

                          return (
                            <div>
                              <h3 className="text-sm font-semibold text-ink">Key Skills</h3>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {skillsToRender.map((skill, idx) => {
                                  const skillName = typeof skill === 'string' ? skill : (skill?.name || skill?.skill || `Skill ${idx + 1}`)
                                  const reqName = skillName.toLowerCase().trim()
                                  const isMatched = checkSkillMatch(candidateSkills, reqName) ||
                                                    matched.some(m => checkSkillMatch([m], reqName)) ||
                                                    partial.some(p => checkSkillMatch([p], reqName))
                                  return (
                                    <span
                                      key={skillName}
                                      className={`px-3 py-1 rounded-pill text-xs font-medium border transition-all inline-flex items-center ${
                                        isMatched
                                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-soft-xs'
                                          : 'bg-primary-50 border-primary-100 text-primary-700'
                                      }`}
                                    >
                                      {isMatched && <Check className="w-3 h-3 mr-1 text-emerald-600 flex-shrink-0" />}
                                      {skillName}
                                    </span>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })()
                      }
                    </div>
                  )
                })()}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {selectedJob.location_city && selectedJob.location_state && (
                    <div className="bg-blue-50 border border-blue-200 rounded-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-5 h-5 text-blue-500" />
                        <span className="text-caption text-ink-muted">Location</span>
                      </div>
                      <p className="text-sm font-bold text-ink">{selectedJob.location_city}, {selectedJob.location_state}</p>
                    </div>
                  )}
                  {selectedJob.work_type && (
                    <div className="bg-green-50 border border-green-200 rounded-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-green-500" />
                        <span className="text-caption text-ink-muted">Work Type</span>
                      </div>
                      <p className="text-sm font-bold text-ink capitalize">{selectedJob.work_type}</p>
                    </div>
                  )}
                  {selectedJob.min_experience_years !== null && selectedJob.min_experience_years !== undefined && selectedJob.min_experience_years > 0 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        <span className="text-caption text-ink-muted">Experience</span>
                      </div>
                      <p className="text-sm font-bold text-ink">{selectedJob.min_experience_years}+ years</p>
                    </div>
                  )}
                  {selectedJob.min_cgpa && (
                    <div className="bg-amber-50 border border-amber-200 rounded-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Award className="w-5 h-5 text-amber-500" />
                        <span className="text-caption text-ink-muted">Min CGPA</span>
                      </div>
                      <p className="text-sm font-bold text-ink">{selectedJob.min_cgpa}</p>
                    </div>
                  )}
                  {selectedJob.expires_at && (
                    <div className="bg-red-50 border border-red-200 rounded-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-red-500" />
                        <span className="text-caption text-ink-muted">Expires</span>
                      </div>
                      <p className="text-sm font-bold text-ink">{new Date(selectedJob.expires_at).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>

                {selectedJob.description && (
                  <div className="surface-card p-5">
                    <h3 className="app-section-title mb-3">About This Role</h3>
                    <div className="text-body text-ink-muted leading-relaxed">
                      <SafeMarkdown components={jobMarkdownComponents}>
                        {selectedJob.description}
                      </SafeMarkdown>
                    </div>
                  </div>
                )}

                <div className="surface-card p-5">
                  <h3 className="app-section-title mb-2">Useful next steps</h3>
                  <p className="text-sm text-ink-muted leading-relaxed">
                    Open the job application and review the required skills. To build a gap-focused study plan, complete a mock interview from your dashboard — the skill-gap analysis will generate a personalized learning path for the areas you missed.
                  </p>
                </div>
              </div>

              <div className="sticky bottom-0 z-10 bg-surface-overlay border-t border-hairline p-6 flex gap-3 shadow-soft-sm">
                {appliedJobIds.has(selectedJob.id) ? (
                  <button
                    disabled
                    className="h-11 flex-1 inline-flex items-center justify-center gap-2 px-4 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-card cursor-not-allowed text-center shadow-soft-xs"
                  >
                    <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
                    <span>Applied</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleApply(selectedJob.id)}
                    disabled={applyingId === selectedJob.id}
                    aria-busy={applyingId === selectedJob.id}
                    className="app-btn-primary inline-flex flex-1 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {applyingId === selectedJob.id
                      ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                      : <Send className="h-5 w-5 shrink-0" />}
                    <span>Apply Now</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedJob(null)}
 className="app-btn-secondary"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BypassModal
        open={showBypassModal}
        onClose={() => setShowBypassModal(false)}
        cooldownExpiresAt={cooldownExpiresAt}
        onCooldownEnd={handleCooldownEnd}
        creditsBalance={creditsBalance}
        bypassCost={bypassCost}
        recalcLoading={recalcLoading}
        onConfirmBypass={() => handleRecomputeRecommendations(true)}
      />

      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
