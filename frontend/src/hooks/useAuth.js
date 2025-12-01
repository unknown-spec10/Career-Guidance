import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import secureStorage, { checkSessionValidity } from '../utils/secureStorage'
import api from '../config/api'

/**
 * Custom hook for authentication with token expiration handling
 */
export const useAuth = () => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const navigate = useNavigate()

  // Decode JWT to check expiration
  const isTokenExpired = useCallback((token) => {
    if (!token) return true
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const exp = payload.exp * 1000 // Convert to milliseconds
      
      // Check if token expires in next 5 minutes
      return Date.now() >= (exp - 5 * 60 * 1000)
    } catch (err) {
      console.error('Error decoding token:', err)
      return true
    }
  }, [])

  // Logout and clear session
  const logout = useCallback((redirect = true) => {
    secureStorage.clear()
    setUser(null)
    setIsAuthenticated(false)
    delete api.defaults.headers.common['Authorization']
    
    if (redirect) {
      navigate('/login', { replace: true })
    }
  }, [navigate])

  // Check and refresh authentication
  const checkAuth = useCallback(async () => {
    setLoading(true)
    
    try {
      // Check session validity
      if (!checkSessionValidity()) {
        logout(false)
        return false
      }

      const token = secureStorage.getItem('token')
      const userData = secureStorage.getItem('user')

      if (!token || !userData) {
        logout(false)
        return false
      }

      // Check token expiration
      if (isTokenExpired(token)) {
        console.warn('Token expired')
        logout(false)
        return false
      }

      // Set auth header
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      setUser(userData)
      setIsAuthenticated(true)
      return true
    } catch (err) {
      console.error('Auth check error:', err)
      logout(false)
      return false
    } finally {
      setLoading(false)
    }
  }, [isTokenExpired, logout])

  // Login
  const login = useCallback(async (email, password) => {
    try {
      const response = await api.post('/api/auth/login', { email, password })
      const { access_token, user: userData } = response.data

      // Store in secure storage
      secureStorage.setItem('token', access_token)
      secureStorage.setItem('user', userData)
      secureStorage.setItem('login_time', Date.now())

      // Set auth header
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
      
      setUser(userData)
      setIsAuthenticated(true)
      
      return { success: true, user: userData }
    } catch (err) {
      console.error('Login error:', err)
      return { 
        success: false, 
        error: err.response?.data?.detail || 'Login failed' 
      }
    }
  }, [])

  // Initialize auth on mount
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Set up periodic token check (every 5 minutes)
  useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(() => {
      const token = secureStorage.getItem('token')
      if (isTokenExpired(token)) {
        console.warn('Token expired, logging out')
        logout()
      }
    }, 5 * 60 * 1000) // Check every 5 minutes

    return () => clearInterval(interval)
  }, [isAuthenticated, isTokenExpired, logout])

  return {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    checkAuth
  }
}

export default useAuth
