import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import secureStorage, { checkSessionValidity } from '../utils/secureStorage'
import { getAuthToken, clearAuthToken } from '../utils/authToken'
import { getDashboardPath } from '../utils/navigation'
import LoadingTransition from './LoadingTransition'

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const [loading, setLoading] = useState(true)
  const [isValid, setIsValid] = useState(false)
  const [redirectPath, setRedirectPath] = useState(null)

  useEffect(() => {
    // Check session validity
    if (!checkSessionValidity()) {
      clearAuthToken()
      secureStorage.clear()
      setRedirectPath('/login')
      setLoading(false)
      return
    }

    const token = getAuthToken()
    const user = secureStorage.getItem('user')
    
    if (!token || !user) {
      setRedirectPath('/login')
      setLoading(false)
      return
    }

    try {
      // Check token expiration
      const payload = JSON.parse(atob(token.split('.')[1]))
      const exp = payload.exp * 1000
      
      if (Date.now() >= exp) {
        console.warn('Token expired')
        clearAuthToken()
        secureStorage.clear()
        setRedirectPath('/login')
        setLoading(false)
        return
      }

      // Check if user has required role
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        // Wrong role, redirect to appropriate dashboard
        setRedirectPath(getDashboardPath(user.role, '/student/dashboard'))
        setLoading(false)
        return
      }

      // All checks passed
      setIsValid(true)
      setLoading(false)
    } catch (err) {
      // Invalid user data, clear and redirect
      console.error('Auth validation error:', err)
      clearAuthToken()
      secureStorage.clear()
      setRedirectPath('/login')
      setLoading(false)
    }
  }, [allowedRoles])

  // Show loading transition
  if (loading) {
    return <LoadingTransition isLoading={true} />
  }

  // Redirect if needed
  if (redirectPath) {
    return <Navigate to={redirectPath} replace />
  }

  // Render children if valid
  return isValid ? children : null
}
