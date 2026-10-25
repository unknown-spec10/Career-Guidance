/**
 * useResultsPolling — polls GET /api/interview/results/:sessionId
 * with backoff until status is complete, a timeout is hit, or polling
 * is abandoned. Non-complete payloads are never treated as results.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../config/api'
import { getApiError } from '../utils/apiError'

const BASE_INTERVAL_MS = 2000
const MAX_INTERVAL_MS = 10000
const MAX_ATTEMPTS = 60
const MAX_WAIT_MS = 5 * 60 * 1000

const isCompletePayload = (data) =>
  !!data && typeof data.status === 'string' && data.status.toLowerCase().startsWith('complet')

export default function useResultsPolling(sessionId) {
  const [results, setResults] = useState(null)
  const [isProcessing, setIsProcessing] = useState(true)
  const [completedCount, setCompletedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [error, setError] = useState(null)
  const [timedOut, setTimedOut] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const timerRef = useRef(null)
  const mountedRef = useRef(true)
  const attemptsRef = useRef(0)
  const startedAtRef = useRef(0)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const scheduleNext = useCallback(() => {
    if (!mountedRef.current) return
    // Exponential backoff: 2s, 4s, 6s... capped at 10s.
    const delay = Math.min(MAX_INTERVAL_MS, BASE_INTERVAL_MS * Math.ceil((attemptsRef.current + 1) / 2))
    timerRef.current = setTimeout(() => {
      pollRef.current()
    }, delay)
  }, [])

  const pollRef = useRef(null)

  const poll = useCallback(async () => {
    if (!sessionId || !mountedRef.current || timedOut) return

    // Bounded polling: stop after too many attempts or too much wall time.
    attemptsRef.current += 1
    setAttempts(attemptsRef.current)
    if (attemptsRef.current > MAX_ATTEMPTS || Date.now() - startedAtRef.current > MAX_WAIT_MS) {
      if (mountedRef.current) {
        setTimedOut(true)
        setIsProcessing(false)
      }
      return
    }

    try {
      const res = await api.get(`/api/interview/results/${sessionId}`)
      if (!mountedRef.current) return

      const data = res.data

      if (isCompletePayload(data)) {
        setIsProcessing(false)
        setResults(data)
        setCompletedCount(data.total || 0)
        setTotalCount(data.total || 0)
      } else {
        // Non-complete payload (e.g. {status:"processing"}): update progress
        // but never overwrite results.
        setIsProcessing(true)
        setCompletedCount(data.completed || 0)
        setTotalCount(data.total || 0)
        scheduleNext()
      }
    } catch (err) {
      if (!mountedRef.current) return
      console.error('Results polling error:', err)
      setError(getApiError(err, 'Failed to load results.'))
      setIsProcessing(false)
    }
  }, [sessionId, timedOut, scheduleNext])

  pollRef.current = poll

  const retry = useCallback(() => {
    if (!sessionId) return
    attemptsRef.current = 0
    startedAtRef.current = Date.now()
    setAttempts(0)
    setTimedOut(false)
    setError(null)
    setIsProcessing(true)
    poll()
  }, [sessionId, poll])

  useEffect(() => {
    mountedRef.current = true
    attemptsRef.current = 0
    startedAtRef.current = Date.now()
    if (sessionId) {
      poll()
    }
    return () => {
      mountedRef.current = false
      clearTimer()
    }
  }, [sessionId, poll])

  const refresh = useCallback(async () => {
    if (!sessionId || !mountedRef.current) return
    try {
      const res = await api.get(`/api/interview/results/${sessionId}`)
      // Ignore non-complete payloads: a "processing" response must never
      // wipe an already-rendered scorecard into a 0% render.
      if (mountedRef.current && isCompletePayload(res.data)) {
        setResults(res.data)
      }
    } catch (err) {
      console.error('Results refresh error:', err)
    }
  }, [sessionId])

  return { results, isProcessing, completedCount, totalCount, error, timedOut, attempts, refresh, retry }
}
