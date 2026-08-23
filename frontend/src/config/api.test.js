import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiUrl, api } from './api'

describe('apiUrl', () => {
  it('returns relative paths untouched when no base URL is configured (dev proxy mode)', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.stubEnv('VITE_API_URL', '')
    vi.resetModules()
    try {
      const { apiUrl: bare } = await import('./api?no-base-url-variant')
      expect(bare('/api/interview/start')).toBe('/api/interview/start')
    } finally {
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })

  it('returns empty/nullish input unchanged', () => {
    expect(apiUrl('')).toBe('')
    expect(apiUrl(undefined)).toBeUndefined()
  })

  it('passes absolute URLs through without double-prefixing', () => {
    const abs = 'https://api.example.com/api/rag/ask'
    expect(apiUrl(abs)).toBe(abs)
    expect(apiUrl('http://localhost:8000/api/x')).toBe('http://localhost:8000/api/x')
  })

  it('prefixes a configured production base URL exactly once', async () => {
    // Regression guard: in production the SPA rewrite serves index.html for
    // relative fetches, so every raw fetch/SSE/beacon MUST go through apiUrl.
    vi.stubEnv('VITE_API_BASE_URL', 'https://backend.example.com')
    vi.resetModules()
    try {
      const { apiUrl: withBase } = await import('./api?base-url-variant')
      expect(withBase('/api/interview/hint/1')).toBe('https://backend.example.com/api/interview/hint/1')
      expect(withBase('api/relative')).toBe('https://backend.example.com/api/relative')
      expect(withBase('https://other.example.com/api/z')).toBe('https://other.example.com/api/z')
    } finally {
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })
})

describe('request interceptor', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  const requestHandler = () => api.interceptors.request.handlers[0].fulfilled

  it('attaches the Bearer token from secure storage', () => {
    sessionStorage.setItem('_secure_token', btoa(JSON.stringify('tok123')))
    const config = { headers: {} }
    const result = requestHandler()(config)
    expect(result.headers.Authorization).toBe('Bearer tok123')
  })

  it('leaves headers alone when there is no token', () => {
    const config = { headers: {} }
    const result = requestHandler()(config)
    expect(result.headers.Authorization).toBeUndefined()
  })

  it('removes Content-Type for FormData so the browser sets the boundary', () => {
    const form = new FormData()
    const config = { headers: { 'Content-Type': 'application/json' }, data: form }
    const result = requestHandler()(config)
    expect(result.headers['Content-Type']).toBeUndefined()
  })
})

describe('response interceptor — 401 handling', () => {
  let originalLocation

  beforeEach(() => {
    originalLocation = window.location
    delete window.location
    window.location = { pathname: '/student/dashboard', href: '' }
    sessionStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    window.location = originalLocation
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('clears the session and redirects to /login on 401', async () => {
    sessionStorage.setItem('_secure_token', btoa('"tok"'))
    const errorHandler = api.interceptors.response.handlers[0].rejected
    const error = { response: { status: 401, data: { detail: 'Token expired' } }, message: 'Unauthorized' }

    await expect(errorHandler(error)).rejects.toBe(error)
    expect(sessionStorage.getItem('_secure_token')).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('does not trigger a redirect loop when already on /login', async () => {
    window.location.pathname = '/login'
    const errorHandler = api.interceptors.response.handlers[0].rejected
    const error = { response: { status: 401, data: {} }, message: 'Unauthorized' }

    await expect(errorHandler(error)).rejects.toBe(error)
    expect(window.location.href).toBe('')
  })
})
