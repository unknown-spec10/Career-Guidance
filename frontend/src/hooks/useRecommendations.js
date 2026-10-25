import { useState, useEffect, useCallback } from 'react'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { getApiError } from '../utils/apiError'
import { normalizeMatchScore } from '../utils/skillMatch'

// Personalized recommendation pipeline for students: recommendations,
// cooldown/bypass flow, candidate attributes, and credit balance.
// Logic moved verbatim from JobsPage.jsx; only active when `enabled`.
// `toast` is injected so all toasts render in the caller's ToastContainer.
export function useRecommendations({ enabled, toast }) {
  // `rawRecommendations` is the `recommended` top slice (the cards).
  // `moreMatches` holds the paged `more_matches` remainder behind show-more.
  const [rawRecommendations, setRawRecommendations] = useState([])
  const [moreMatches, setMoreMatches] = useState([])
  const [moreTotal, setMoreTotal] = useState(0)
  const [moreOffset, setMoreOffset] = useState(0)
  const [showMoreMatches, setShowMoreMatches] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)
  const [recommendationMatches, setRecommendationMatches] = useState({})
  const [recommendationDetailsByJobId, setRecommendationDetailsByJobId] = useState({})
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(null)

  // Student attributes
  const [candidateSkills, setCandidateSkills] = useState([])
  const [candidateCity, setCandidateCity] = useState('')
  const [applicantId, setApplicantId] = useState(null)

  // Cooldown & Bypass State
  const [cooldownActive, setCooldownActive] = useState(false)
  const [cooldownExpiresAt, setCooldownExpiresAt] = useState(null)
  const [bypassCost, setBypassCost] = useState(5)
  const [showBypassModal, setShowBypassModal] = useState(false)
  const [creditsBalance, setCreditsBalance] = useState(null)
  const [recalcLoading, setRecalcLoading] = useState(false)

  const handleCooldownEnd = useCallback(() => {
    setCooldownActive(false)
    setCooldownExpiresAt(null)
  }, [])

  const fetchRecommendations = async () => {
    try {
      setLoading(true)
      setFetchError(null)
      let appDbId = applicantId || secureStorage.getItem('db_applicant_id')
      if (!appDbId) {
        try {
          const applicantRes = await api.get('/api/student/applicant')
          appDbId = applicantRes.data?.id
          if (appDbId) {
            secureStorage.setItem('db_applicant_id', String(appDbId))
            setApplicantId(appDbId)
          }
        } catch (err) {
          console.error('Error fetching applicant details:', err)
        }
      }

      if (!appDbId) {
        setRawRecommendations([])
        setMoreMatches([])
        setMoreTotal(0)
        setMoreOffset(0)
        setTotal(0)
        setHasMore(false)
        return
      }

      const recRes = await api.get(`/api/recommendations/${appDbId}?purpose=browse&t=${Date.now()}`)
      const data = recRes.data || {}
      // Presentation cut: `recommended` is the top slice, `more_matches` the
      // paged remainder. Older responses carry only `job_recommendations`,
      // which is treated as the recommended set (no slicing constants here —
      // all counts come from the API).
      const top = Array.isArray(data.recommended)
        ? data.recommended
        : (Array.isArray(data.job_recommendations) ? data.job_recommendations : [])
      const more = Array.isArray(data.more_matches) ? data.more_matches : []
      setRawRecommendations(top)
      setMoreMatches(more)
      setMoreTotal(data.more_total ?? more.length)
      setMoreOffset(data.more_offset ?? 0)
      setTotal(data.total ?? (top.length + more.length))
      setHasMore(false)

      const nextMatches = {}
      const nextDetails = {}
      ;[...top, ...more].forEach((rec) => {
        const jobId = rec?.job?.id
        const score = normalizeMatchScore(rec?.match_score ?? rec?.score ?? null)
        if (Number.isFinite(jobId)) {
          nextMatches[jobId] = score
          nextDetails[jobId] = {
            ...rec,
            normalizedScore: score,
          }
        }
      })
      setRecommendationMatches(nextMatches)
      setRecommendationDetailsByJobId(nextDetails)

      if (recRes.data.cooldown_active) {
        setCooldownActive(true)
        setCooldownExpiresAt(recRes.data.cooldown_expires_at)
        setBypassCost(recRes.data.bypass_cost || 5)
      } else {
        setCooldownActive(false)
        setCooldownExpiresAt(null)
      }

      // Fetch candidate skills and location
      try {
        const profileResponse = await api.get('/api/student/profile')
        const skillsData = profileResponse.data?.skills || []
        const skillNames = skillsData.map(s => {
          if (typeof s === 'object' && s !== null) {
            return (s.name || s.canonical_name || '').toLowerCase().trim()
          }
          return String(s).toLowerCase().trim()
        })
        setCandidateSkills(skillNames)

        const loc = profileResponse.data?.personal_info?.location || ''
        if (loc) {
          setCandidateCity(loc.split(',')[0].trim().toLowerCase())
        }

        const applicantRes = await api.get('/api/student/applicant')
        if (applicantRes.data?.location_city) {
          setCandidateCity(applicantRes.data.location_city.trim().toLowerCase())
        }
      } catch (profileErr) {
        console.error('Error fetching student profile details:', profileErr)
      }

      // Fetch Credit Balance
      try {
        const balanceRes = await api.get('/api/credits/balance')
        setCreditsBalance(balanceRes.data?.current_credits ?? 0)
      } catch (creditsErr) {
        console.error('Failed to load credit balance:', creditsErr)
      }

    } catch (error) {
      console.error('Error fetching recommendations:', error)
      setFetchError(getApiError(error, 'Unable to fetch recommendations right now.'))
      setRawRecommendations([])
    } finally {
      setLoading(false)
    }
  }

  const handleRecomputeRecommendations = async (bypass = false) => {
    const appDbId = applicantId || secureStorage.getItem('db_applicant_id')
    if (!appDbId) return

    if (cooldownActive && !bypass) {
      try {
        const balanceRes = await api.get('/api/credits/balance')
        setCreditsBalance(balanceRes.data?.current_credits ?? 0)
      } catch (e) {}
      setShowBypassModal(true)
      return
    }

    try {
      setRecalcLoading(true)
      const url = `/api/applicant/${appDbId}/generate-recommendations${bypass ? '?bypass_cooldown=true' : ''}`
      const response = await api.post(url)

      toast.success('Recommendations updated')

      if (response.data?.cooldown_active) {
        setCooldownActive(true)
        setCooldownExpiresAt(response.data.cooldown_expires_at)
      } else {
        setCooldownActive(false)
        setCooldownExpiresAt(null)
      }

      if (response.data?.credits_left !== undefined) {
        setCreditsBalance(response.data.credits_left)
      }

      setShowBypassModal(false)
      await fetchRecommendations()
    } catch (err) {
      const status = err.response?.status
      const data = err.response?.data

      if (status === 400 && data?.status === 'cooldown') {
        setCooldownActive(true)
        setCooldownExpiresAt(data.cooldown_expires_at)
        setBypassCost(data.bypass_cost || 5)
        setShowBypassModal(true)
        toast.info('Recommendations are in cooldown. Spend credits to refresh now!')
      } else if (status === 402) {
        toast.error(`Insufficient credits: ${data?.detail || 'Upgrade or wait for refill.'}`)
      } else {
        const detail = data?.detail || err.message || 'Failed to regenerate recommendations'
        toast.error(detail)
      }
    } finally {
      setRecalcLoading(false)
    }
  }

  // Recommendation Fetching
  useEffect(() => {
    if (!enabled) {
      return
    }
    fetchRecommendations()
  }, [enabled])

  const hasMoreMatches = moreTotal > 0
  const canLoadMoreMatches = moreMatches.length < moreTotal

  const loadMoreMatches = useCallback(async () => {
    const appDbId = applicantId || secureStorage.getItem('db_applicant_id')
    if (!appDbId || moreLoading) return
    if (moreMatches.length >= moreTotal) return
    try {
      setMoreLoading(true)
      // `more_offset` is relative to the start of the remainder (past the
      // `recommended` slice); the page size stays the API default.
      const recRes = await api.get(
        `/api/recommendations/${appDbId}?purpose=browse&more_offset=${moreMatches.length}&t=${Date.now()}`
      )
      const data = recRes.data || {}
      const page = Array.isArray(data.more_matches) ? data.more_matches : []
      setMoreMatches((prev) => [...prev, ...page])
      if (data.more_total !== undefined) setMoreTotal(data.more_total)
      if (data.more_offset !== undefined) setMoreOffset(data.more_offset)
      setRecommendationDetailsByJobId((prev) => {
        const next = { ...prev }
        page.forEach((rec) => {
          const jobId = rec?.job?.id
          const score = normalizeMatchScore(rec?.match_score ?? rec?.score ?? null)
          if (Number.isFinite(jobId)) {
            next[jobId] = { ...rec, normalizedScore: score }
          }
        })
        return next
      })
    } catch (error) {
      console.error('Error fetching more matches:', error)
      setFetchError(getApiError(error, 'Unable to fetch more matches right now.'))
    } finally {
      setMoreLoading(false)
    }
  }, [applicantId, moreLoading, moreMatches.length, moreTotal])

  return {
    rawRecommendations,
    moreMatches,
    moreTotal,
    moreOffset,
    showMoreMatches,
    setShowMoreMatches,
    hasMoreMatches,
    canLoadMoreMatches,
    moreLoading,
    loadMoreMatches,
    recommendationMatches,
    recommendationDetailsByJobId,
    total,
    hasMore,
    loading,
    fetchError,
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
    fetchRecommendations,
    handleRecomputeRecommendations,
  }
}
