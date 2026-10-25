import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import useResultsPolling from './useResultsPolling'

vi.mock('../config/api', () => ({
  default: { get: vi.fn() },
}))

import api from '../config/api'

describe('useResultsPolling — evaluation recovery contract', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('polls while processing and delivers results when evaluation completes', async () => {
    const resultsPayload = {
      status: 'completed',
      total: 10,
      overall_score: 0.82,
      questions: [],
    }
    api.get
      .mockResolvedValueOnce({ data: { status: 'processing', completed: 4, total: 10 } })
      .mockResolvedValueOnce({ data: resultsPayload })

    const { result } = renderHook(() => useResultsPolling('sess-1'))

    // First poll happens on mount
    await act(async () => {
      await Promise.resolve()
    })
    expect(api.get).toHaveBeenCalledWith('/api/interview/results/sess-1')
    expect(result.current.isProcessing).toBe(true)
    expect(result.current.completedCount).toBe(4)
    expect(result.current.totalCount).toBe(10)

    // Second poll after the 2s interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100)
    })

    expect(result.current.isProcessing).toBe(false)
    expect(result.current.results).toEqual(resultsPayload)
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('surfaces the backend detail message when polling fails and stops the processing state', async () => {
    api.get.mockRejectedValue({ response: { status: 404, data: { detail: 'Results not found' } } })

    const { result } = renderHook(() => useResultsPolling('sess-err'))
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.error).toBe('Results not found')
    expect(result.current.isProcessing).toBe(false)
    expect(result.current.results).toBeNull()
  })

  it('uses a generic error message when the backend gives no detail', async () => {
    api.get.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useResultsPolling('sess-err2'))
    await act(async () => { await Promise.resolve() })
    expect(result.current.error).toBe('Failed to load results.')
  })

  it('does not poll without a session id', async () => {
    const { result } = renderHook(() => useResultsPolling(null))
    await act(async () => { await Promise.resolve() })
    expect(api.get).not.toHaveBeenCalled()
    expect(result.current.isProcessing).toBe(true) // stays pending until a session exists
  })

  it('stops polling after unmount (no leaked timers/requests)', async () => {
    api.get.mockResolvedValue({ data: { status: 'processing', completed: 1, total: 10 } })
    const { unmount } = renderHook(() => useResultsPolling('sess-live'))
    await act(async () => { await Promise.resolve() })
    unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('refresh() re-fetches results on demand', async () => {
    api.get
      .mockResolvedValueOnce({ data: { status: 'completed', total: 3 } })
      .mockResolvedValueOnce({ data: { status: 'completed', total: 3, refreshed: true } })

    const { result } = renderHook(() => useResultsPolling('sess-r'))
    await act(async () => { await Promise.resolve() })
    await act(async () => {
      await result.current.refresh()
    })

    expect(api.get).toHaveBeenCalledTimes(2)
    expect(result.current.results?.refreshed).toBe(true)
  })

  it('refresh() ignores non-complete payloads so a scorecard is never wiped to 0%', async () => {
    api.get
      .mockResolvedValueOnce({ data: { status: 'complete', total: 3, overall_score: 0.9 } })
      .mockResolvedValueOnce({ data: { status: 'processing', completed: 1, total: 3 } })

    const { result } = renderHook(() => useResultsPolling('sess-r2'))
    await act(async () => { await Promise.resolve() })
    expect(result.current.results?.overall_score).toBe(0.9)

    await act(async () => {
      await result.current.refresh()
    })

    // The processing payload must not overwrite the complete results.
    expect(result.current.results?.overall_score).toBe(0.9)
    expect(result.current.results?.status).toBe('complete')
  })

  it('stops polling after the timeout budget and offers a retry that restarts it', async () => {
    api.get.mockResolvedValue({ data: { status: 'processing', completed: 1, total: 10 } })
    const { result } = renderHook(() => useResultsPolling('sess-slow'))
    await act(async () => { await Promise.resolve() })
    expect(result.current.timedOut).toBe(false)

    // Exhaust the bounded polling budget (60 attempts, backoff-capped at 10s).
    for (let i = 0; i < 65; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(11000) })
    }

    expect(result.current.timedOut).toBe(true)
    expect(result.current.isProcessing).toBe(false)
    const callsAfterTimeout = api.get.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
    expect(api.get.mock.calls.length).toBe(callsAfterTimeout)

    // Retry restarts bounded polling from scratch.
    const completePayload = { data: { status: 'complete', total: 10, overall_score: 0.7 } }
    api.get.mockResolvedValueOnce(completePayload)
    await act(async () => { await result.current.retry() })
    expect(result.current.timedOut).toBe(false)
    expect(result.current.results?.overall_score).toBe(0.7)
  })
})
