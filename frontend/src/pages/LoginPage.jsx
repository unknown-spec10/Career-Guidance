import React, { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, AlertTriangle, CheckCircle } from 'lucide-react'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import { sanitizeEmail } from '../utils/sanitize'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [formData, setFormData] = useState({
    username: '', // OAuth2PasswordRequestForm expects 'username' field
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const message = location.state?.message

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Send as form data (OAuth2 format)
      const sanitizedEmail = sanitizeEmail(formData.username)
      const formBody = new URLSearchParams()
      formBody.append('username', sanitizedEmail)
      formBody.append('password', formData.password)

      const response = await api.post('/api/auth/login', formBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      const { access_token, user } = response.data

      // Store in secure storage
      secureStorage.setItem('token', access_token)
      secureStorage.setItem('user', user)
      secureStorage.setItem('login_time', Date.now())

      // Set default authorization header
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`

      // Navigate based on role
      switch (user.role) {
        case 'admin':
          navigate('/admin/dashboard')
          break
        case 'employer':
          navigate('/employer/dashboard')
          break
        case 'college':
          navigate('/college/dashboard')
          break
        default:
          navigate('/student/dashboard')
      }
      toast.success('Login successful!')
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Login failed'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
          <p className="text-gray-400">Login to your account</p>
        </div>

        <div className="card">
          {message && (
            <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400 text-sm">{message}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  required
                  className="input pl-10"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  required
                  className="input pl-10"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-dark-600 bg-dark-900 text-primary-500" />
                <span className="ml-2 text-sm text-gray-400">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-sm text-primary-400 hover:text-primary-300">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 space-y-2">
            <div className="text-center text-sm text-gray-400">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary-400 hover:text-primary-300">
                Register here
              </Link>
            </div>
            <div className="text-center text-sm text-gray-400">
              Need to verify?{' '}
              <Link to="/verify-code" className="text-primary-400 hover:text-primary-300">
                Enter verification code
              </Link>
              {' '}or{' '}
              <Link to="/resend-verification" className="text-primary-400 hover:text-primary-300">
                resend code
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
      <ToastContainer />
    </div>
  )
}
