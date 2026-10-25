import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRecommendations } from './useRecommendations'

vi.mock('../config/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('../utils/secureStorage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}))

import api from '../config/api'
import secureStorage from '../utils/secureStorage'

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }

const rec = (id) => ({
  job: { id, title: `Job ${id}` },
  match_score: 0.9 - id * 0.01,
  scoring_breakdown: {},
})

function mockApi({ recommended, moreMatches, moreTotal }) {
  api.get.mockImplementation((url) => {
    if (url.startsWith('/api/recommendations/')) {
      if (url.includes('more_offset=2')) {
        return Promise.resolve({
          data: { more_matches: [rec(13)], more_total: moreTotal, more_offset: 2 },
        })
      }
      return Promise.resolve({
        data: {
          job_recommendations: [...recommended, ...moreMatches],
          recommended,
          more_matches: moreMatches,
          total: recommended.length + moreMatches.length,
          recommended_count: recommended.length,
          more_total: moreTotal,
          more_offset: 0,
        },
      })
    }
    if (url === '/api/student/profile') {
      return Promise.resolve({ data: { skills: [], personal_info: {} } })
    }
    if (url === '/api/student/applicant') {
      return Promise.resolve({ data: { id: 7 } })
    }
    if (url === '/api/credits/balance') {
      return Promise.resolve({ data: { current_credits: 50 } })
    }
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
}

describe('useRecommendations — presentation cut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    secureStorage.getItem.mockImplementation((k) => (k === 'db_applicant_id' ? 7 : null))
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('splits the API response into recommended cards + paged more matches', async () => {
    mockApi({ recommended: [rec(1), rec(2)], moreMatches: [rec(11), rec(12)], moreTotal: 2 })
    const { result } = renderHook(() => useRecommendations({ enabled: true, toast }))

    await waitFor(() => {
      expect(result.current.rawRecommendations).toHaveLength(2)
    })
    expect(result.current.rawRecommendations.map((r) => r.job.id)).toEqual([1, 2])
    expect(result.current.moreMatches.map((r) => r.job.id)).toEqual([11, 12])
    expect(result.current.moreTotal).toBe(2)
    expect(result.current.hasMoreMatches).toBe(true)
    expect(result.current.showMoreMatches).toBe(false)
    // Details map covers both slices so JobCards resolve scores.
    expect(Object.keys(result.current.recommendationDetailsByJobId).sort()).toEqual(['1', '11', '12', '2'])
  })

  it('falls back to job_recommendations when the new keys are absent (backward compatible)', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/recommendations/')) {
        return Promise.resolve({ data: { job_recommendations: [rec(1)] } })
      }
      if (url === '/api/student/profile') {
        return Promise.resolve({ data: { skills: [], personal_info: {} } })
      }
      if (url === '/api/student/applicant') {
        return Promise.resolve({ data: { id: 7 } })
      }
      if (url === '/api/credits/balance') {
        return Promise.resolve({ data: { current_credits: 50 } })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    const { result } = renderHook(() => useRecommendations({ enabled: true, toast }))

    await waitFor(() => {
      expect(result.current.rawRecommendations).toHaveLength(1)
    })
    expect(result.current.moreMatches).toEqual([])
    expect(result.current.hasMoreMatches).toBe(false)
  })

  it('loads further more_matches pages with more_offset and appends them', async () => {
    mockApi({ recommended: [rec(1), rec(2)], moreMatches: [rec(11), rec(12)], moreTotal: 3 })
    const { result } = renderHook(() => useRecommendations({ enabled: true, toast }))

    await waitFor(() => {
      expect(result.current.moreMatches).toHaveLength(2)
    })
    expect(result.current.canLoadMoreMatches).toBe(true)

    await act(async () => {
      await result.current.loadMoreMatches()
    })

    expect(result.current.moreMatches.map((r) => r.job.id)).toEqual([11, 12, 13])
    const pageCall = api.get.mock.calls.find(([url]) => url.includes('more_offset=2'))
    expect(pageCall[0]).toContain('purpose=browse')
    expect(result.current.canLoadMoreMatches).toBe(false)
  })

  it('toggles the show-more affordance without refetching', async () => {
    mockApi({ recommended: [rec(1)], moreMatches: [rec(11)], moreTotal: 1 })
    const { result } = renderHook(() => useRecommendations({ enabled: true, toast }))

    await waitFor(() => {
      expect(result.current.hasMoreMatches).toBe(true)
    })
    const callsBefore = api.get.mock.calls.length
    act(() => {
      result.current.setShowMoreMatches(true)
    })
    expect(result.current.showMoreMatches).toBe(true)
    expect(api.get.mock.calls.length).toBe(callsBefore)
  })
})
