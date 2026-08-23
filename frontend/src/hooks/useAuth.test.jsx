import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import useAuth from './useAuth'

vi.mock('../config/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}))

import api from '../config/api'

const enc = (v) => btoa(JSON.stringify(v))
const futureToken = () => `h.${enc({ exp: Math.floor(Date.now() / 1000) + 3600 })}.s`
const expiredToken = () => `h.${enc({ exp: Math.floor(Date.now() / 1000) - 120 })}.s`

const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>

describe('useAuth', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('login success stores the session and authenticates', async () => {
    const user = { id: 1, role: 'student' }
    api.post.mockResolvedValueOnce({ data: { access_token: 'tok-1', user } })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    let outcome
    await act(async () => {
      outcome = await result.current.login('a@b.com', 'pw')
    })

    expect(outcome.success).toBe(true)
    expect(outcome.user).toEqual(user)
    expect(JSON.parse(atob(sessionStorage.getItem('_secure_token')))).toBe('tok-1')
    expect(api.defaults.headers.common.Authorization).toBe('Bearer tok-1')
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('login failure surfaces the backend detail message without storing a session', async () => {
    api.post.mockRejectedValueOnce({
      response: { status: 401, data: { detail: 'Invalid email or password' } },
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    let outcome
    await act(async () => {
      outcome = await result.current.login('a@b.com', 'wrong')
    })

    expect(outcome.success).toBe(false)
    expect(outcome.error).toBe('Invalid email or password')
    expect(sessionStorage.getItem('_secure_token')).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('login failure falls back to a generic message when the backend gives no detail', async () => {
    api.post.mockRejectedValueOnce({ message: 'Network Error' })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    let outcome
    await act(async () => {
      outcome = await result.current.login('a@b.com', 'pw')
    })
    expect(outcome.success).toBe(false)
    expect(outcome.error).toBe('Login failed')
  })

  it('logout clears the session and auth header', async () => {
    sessionStorage.setItem('_secure_token', enc('tok'))
    sessionStorage.setItem('_secure_user', enc({ id: 1 }))
    api.defaults.headers.common.Authorization = 'Bearer tok'

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.logout(false)
    })

    expect(sessionStorage.getItem('_secure_token')).toBeNull()
    expect(sessionStorage.getItem('_secure_user')).toBeNull()
    expect(api.defaults.headers.common.Authorization).toBeUndefined()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('checkAuth logs out when the token is expired (revocation/expiry handling)', async () => {
    sessionStorage.setItem('_secure_login_time', enc(Date.now()))
    sessionStorage.setItem('_secure_token', enc(expiredToken()))
    sessionStorage.setItem('_secure_user', enc({ id: 1, role: 'student' }))

    const { result } = renderHook(() => useAuth(), { wrapper })
    let ok
    await act(async () => {
      ok = await result.current.checkAuth()
    })

    expect(ok).toBe(false)
    expect(result.current.isAuthenticated).toBe(false)
    // Expired token must not have been sent to any endpoint
    expect(api.get).not.toHaveBeenCalled()
    expect(api.defaults.headers.common.Authorization).toBeUndefined()
  })

  it('checkAuth refreshes user data from /api/auth/me on a valid session', async () => {
    const cached = { id: 1, role: 'student', full_name: 'Cached Name' }
    const fresh = { id: 1, role: 'student', full_name: 'Fresh Name' }
    sessionStorage.setItem('_secure_login_time', enc(Date.now()))
    sessionStorage.setItem('_secure_token', enc(futureToken()))
    sessionStorage.setItem('_secure_user', enc(cached))
    api.get.mockResolvedValueOnce({ data: fresh })

    const { result } = renderHook(() => useAuth(), { wrapper })

    // The hook refreshes from /api/auth/me automatically on mount
    await waitFor(() => expect(result.current.user).toEqual(fresh))
    expect(api.get).toHaveBeenCalledWith('/api/auth/me')
    expect(result.current.isAuthenticated).toBe(true)
    expect(JSON.parse(atob(sessionStorage.getItem('_secure_user')))).toEqual(fresh)
  })

  it('checkAuth falls back to cached user data if /api/auth/me fails', async () => {
    const cached = { id: 1, role: 'student', full_name: 'Cached Name' }
    sessionStorage.setItem('_secure_login_time', enc(Date.now()))
    sessionStorage.setItem('_secure_token', enc(futureToken()))
    sessionStorage.setItem('_secure_user', enc(cached))
    api.get.mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    let ok
    await act(async () => {
      ok = await result.current.checkAuth()
    })

    expect(ok).toBe(true)
    expect(result.current.user).toEqual(cached)
  })
})
