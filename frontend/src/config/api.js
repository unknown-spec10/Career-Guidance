import axios from 'axios'
import secureStorage from '../utils/secureStorage'
import { getAuthToken, clearAuthToken } from '../utils/authToken'
import { makeRetryable } from '../utils/apiRetry'

// API Base URL configuration
// In development: uses Vite proxy (/api -> http://localhost:8000/api)
// In production: uses environment variable VITE_API_BASE_URL or VITE_API_URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || ''

// Resolve a backend API path against the configured base URL.
// Use this for EVERY non-axios request (raw fetch, EventSource, sendBeacon):
// axios calls already go through `baseURL`, but raw fetch() with a relative
// path silently hits the frontend origin in production (where the SPA rewrite
// serves index.html instead of proxying /api).
export const apiUrl = (path) => {
  if (!path) return path
  if (/^https?:\/\//i.test(path)) return path // already absolute
  const base = API_BASE_URL.replace(/\/+$/, '')
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

// Create axios instance with base configuration
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 second timeout (increased for resume parsing)
})

// Request interceptor for adding auth tokens
api.interceptors.request.use(
  (config) => {
    // Auth token from the in-memory holder (restored from session storage
    // once per page load). Never read the stored copy directly here, so the
    // future httpOnly-cookie migration only touches authToken.js.
    const token = getAuthToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // For FormData, don't set Content-Type - let browser set it with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for handling errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle common errors
    if (error.response) {
      // Server responded with error status
      const status = error.response.status
      const message = error.response.data?.detail || error.message

      if (status === 401) {
        // Token expired or invalid - clear auth and redirect, but preserve
        // the current location so an interrupted interview can resume after login.
        console.error('Unauthorized:', message)
        try {
          const path = window.location.pathname + window.location.search
          if (path.startsWith('/dashboard/interview/')) {
            sessionStorage.setItem('post_login_redirect', path)
          }
        } catch {
          // storage may be unavailable — still redirect to login
        }
        clearAuthToken()
        secureStorage.clear()

        // Only redirect if not already on login/register pages
        if (window.location.pathname !== '/login' &&
          window.location.pathname !== '/register') {
          window.location.href = '/login'
        }
      } else if (status === 404) {
        console.error('Not found:', message)
      } else if (status === 429) {
        console.error('Rate limit exceeded:', message)
      } else if (status >= 500) {
        console.error('Server error:', message)
      }
    } else if (error.request) {
      // Request made but no response
      console.error('Network error: No response from server')
    } else {
      console.error('Error:', error.message)
    }

    return Promise.reject(error)
  }
)

// Add retry logic for network failures
makeRetryable(api, {
  maxRetries: 3,
  retryableStatuses: [408, 429, 500, 502, 503, 504]
})

export default api
