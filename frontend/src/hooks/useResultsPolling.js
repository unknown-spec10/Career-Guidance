/**
 * useResultsPolling — polls GET /api/interview/results/:sessionId
 * every 2 seconds until status is "complete".
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../config/api'

export default function useResultsPolling(sessionId) {
  const [results, setResults] = useState(null)
  const [isProcessing, setIsProcessing] = useState(true)
  const [completedCount, setCompletedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)
  const mountedRef = useRef(true)

  const poll = useCallback(async () => {
    if (!sessionId || !mountedRef.current) return

    try {
      const res = await api.get(`/api/interview/results/${sessionId}`)
      if (!mountedRef.current) return

      const data = res.data

      if (data.status === 'processing') {
        setIsProcessing(true)
        setCompletedCount(data.completed || 0)
        setTotalCount(data.total || 0)
        // Schedule next poll
        timerRef.current = setTimeout(poll, 2000)
      } else {
        // Complete
        setIsProcessing(false)
        setResults(data)
        setCompletedCount(data.total || 0)
        setTotalCount(data.total || 0)
      }
    } catch (err) {
      if (!mountedRef.current) return
      console.error('Results polling error:', err)
      setError(err.response?.data?.detail || 'Failed to load results.')
      setIsProcessing(false)
    }
  }, [sessionId])

  useEffect(() => {
    mountedRef.current = true
    if (sessionId) {
      poll()
    }
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [sessionId, poll])

  return { results, isProcessing, completedCount, totalCount, error }
}
