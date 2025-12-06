import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import secureStorage from '../utils/secureStorage'

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
      switch (user.role) {
        case 'student':
          navigate('/student/dashboard')
          break
        case 'employer':
          navigate('/employer/dashboard')
          break
        case 'college':
          navigate('/college/dashboard')
          break
        case 'admin':
          navigate('/admin/dashboard')
          break
        default:
          navigate('/login')
      }
    } catch (err) {
      // Invalid user data
      secureStorage.clear()
      navigate('/login')
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-400">Redirecting to your dashboard...</p>
      </div>
    </div>
  )
}
