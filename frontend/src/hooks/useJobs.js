import { useState, useEffect } from 'react'
import api from '../config/api'
import { getApiError } from '../utils/apiError'

// Paginated public job listings for non-student browsing.
// Logic moved verbatim from JobsPage.jsx; only active when `enabled`.
export function useJobs({ enabled, debouncedFilters, page, setPage, pageSize }) {
  const [jobs, setJobs] = useState([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(null)

  const fetchJobs = async () => {
    try {
      setLoading(true)
      setFetchError(null)

      const response = await api.get('/api/jobs', {
        params: {
          skip: (page - 1) * pageSize,
          limit: pageSize,
          q: debouncedFilters.q,
          location: debouncedFilters.location,
          work_type: debouncedFilters.work_type,
          sort: debouncedFilters.sort,
        },
      })

      const newJobs = response.data?.jobs || response.data || []
      setTotal(response.data?.total || 0)

      if (page === 1) {
        setJobs(newJobs)
      } else {
        setJobs((prev) => [...prev, ...newJobs])
      }

      setHasMore(newJobs.length === pageSize)
    } catch (error) {
      console.error('Error fetching jobs:', error)
      setHasMore(false)
      setFetchError(getApiError(error, 'Unable to fetch jobs right now. Please retry.'))
    } finally {
      setLoading(false)
    }
  }

  // Pagination resetting for non-student users
  useEffect(() => {
    if (!enabled) {
      return
    }
    setPage(1)
    setJobs([])
    setHasMore(true)
  }, [debouncedFilters, enabled, setPage])

  // General Fetching Logic
  useEffect(() => {
    if (!enabled) {
      return
    }
    fetchJobs()
  }, [page, debouncedFilters, enabled])

  return { jobs, total, hasMore, loading, fetchError, fetchJobs }
}
