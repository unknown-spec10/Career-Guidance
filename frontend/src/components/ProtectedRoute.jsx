import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import secureStorage, { checkSessionValidity } from '../utils/secureStorage'
import LoadingTransition from './LoadingTransition'

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const [loading, setLoading] = useState(true)
  const [isValid, setIsValid] = useState(false)
  const [redirectPath, setRedirectPath] = useState(null)

  useEffect(() => {
    // Check session validity
    if (!checkSessionValidity()) {
      secureStorage.clear()
      setRedirectPath('/login')
      setLoading(false)
      return
    }

    const token = secureStorage.getItem('token')
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
        secureStorage.clear()
        setRedirectPath('/login')
        setLoading(false)
        return
      }

      // Check if user has required role
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
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
      setIsValid(true)
      setLoading(false)
    } catch (err) {
      // Invalid user data, clear and redirect
      console.error('Auth validation error:', err)
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
