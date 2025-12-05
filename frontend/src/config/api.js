import axios from 'axios'
import secureStorage from '../utils/secureStorage'
import { makeRetryable } from '../utils/apiRetry'

// API Base URL configuration
// In development: uses Vite proxy (/api -> http://localhost:8000/api)
// In production: uses environment variable VITE_API_URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || ''

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
    // Add auth token if available from secure storage
    const token = secureStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
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
        // Token expired or invalid - clear auth and redirect
        console.error('Unauthorized:', message)
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
