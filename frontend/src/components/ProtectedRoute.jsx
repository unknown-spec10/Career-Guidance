import React from 'react'
import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const token = localStorage.getItem('token')
  const userStr = localStorage.getItem('user')
  
  if (!token || !userStr) {
    // Not logged in, redirect to login
    return <Navigate to="/login" replace />
  }

  try {
    const user = JSON.parse(userStr)
    
    // Check if user has required role
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      // Wrong role, redirect to appropriate dashboard
      switch (user.role) {
        case 'admin':
          return <Navigate to="/admin/dashboard" replace />
        case 'employer':
          return <Navigate to="/employer/dashboard" replace />
        case 'college':
          return <Navigate to="/college/dashboard" replace />
        default:
          return <Navigate to="/student/dashboard" replace />
      }
    }

    // All checks passed, render children
    return children
  } catch (err) {
    // Invalid user data, clear and redirect
    localStorage.clear()
    return <Navigate to="/login" replace />
  }
}
