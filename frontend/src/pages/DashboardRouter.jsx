import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import secureStorage from '../utils/secureStorage'
import { getDashboardPath } from '../utils/navigation'

export default function DashboardRouter() {
  const navigate = useNavigate()

  useEffect(() => {
    const user = secureStorage.getItem('user')
    
    if (!user) {
      // Not logged in, redirect to login
      navigate('/login')
      return
    }

    try {
      
      // Redirect to role-specific dashboard
      navigate(getDashboardPath(user.role))
    } catch (err) {
      // Invalid user data
      secureStorage.clear()
      navigate('/login')
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-hairline border-t-primary-600 rounded-pill animate-spin mx-auto mb-4"></div>
        <p className="text-ink-muted">Redirecting to your dashboard...</p>
      </div>
    </div>
  )
}
