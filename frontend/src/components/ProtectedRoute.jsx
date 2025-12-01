import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import secureStorage, { checkSessionValidity } from '../utils/secureStorage'
import LoadingTransition from './LoadingTransition'

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const [loading, setLoading] = useState(true)
  const [isValid, setIsValid] = useState(false)
  const [redirectPath, setRedirectPath] = useState(null)

  useEffect(() => {
    console.log('[ProtectedRoute] Checking authentication...')
    
    // Check session validity
    if (!checkSessionValidity()) {
      console.log('[ProtectedRoute] Session expired')
      secureStorage.clear()
      setRedirectPath('/login')
      setLoading(false)
      return
    }

    const token = secureStorage.getItem('token')
    const user = secureStorage.getItem('user')
    
    console.log('[ProtectedRoute] Token exists:', !!token)
    console.log('[ProtectedRoute] User exists:', !!user)
    console.log('[ProtectedRoute] User data:', user)
    
    if (!token || !user) {
      console.log('[ProtectedRoute] Missing token or user, redirecting to login')
      setRedirectPath('/login')
      setLoading(false)
      return
    }

    try {
      // Check token expiration
      const payload = JSON.parse(atob(token.split('.')[1]))
      const exp = payload.exp * 1000
      
      console.log('[ProtectedRoute] Token expires at:', new Date(exp))
      console.log('[ProtectedRoute] Current time:', new Date())
      
      if (Date.now() >= exp) {
        console.warn('[ProtectedRoute] Token expired')
        secureStorage.clear()
        setRedirectPath('/login')
        setLoading(false)
        return
      }

      console.log('[ProtectedRoute] User role:', user.role)
      console.log('[ProtectedRoute] Allowed roles:', allowedRoles)

      // Check if user has required role
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        console.log('[ProtectedRoute] User role not allowed, redirecting to appropriate dashboard')
        // Wrong role, redirect to appropriate dashboard
        switch (user.role) {
          case 'admin':
            setRedirectPath('/admin/dashboard')
            break
          case 'employer':
            setRedirectPath('/employer/dashboard')
            break
          case 'college':
            setRedirectPath('/college/dashboard')
            break
          default:
            setRedirectPath('/student/dashboard')
        }
        setLoading(false)
        return
      }

      // All checks passed
      console.log('[ProtectedRoute] All checks passed, rendering protected content')
      setIsValid(true)
      setLoading(false)
    } catch (err) {
      // Invalid user data, clear and redirect
      console.error('[ProtectedRoute] Auth validation error:', err)
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
