import React, { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, AlertTriangle, CheckCircle, GraduationCap, ArrowRight } from 'lucide-react'
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
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center space-x-3 mb-8 hover:opacity-80 transition-opacity">
          <div className="bg-gradient-to-br from-primary-500 to-primary-700 p-2 rounded-lg">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold">Career AI</span>
        </Link>

        <div className="bg-dark-800 border border-dark-700 rounded-xl p-8 shadow-xl">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Sign In</h2>
            <p className="text-gray-400">Enter your credentials to access your account</p>
          </div>

          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-green-900/20 border border-green-500/30 rounded-lg flex items-start space-x-3"
            >
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span className="text-green-400 text-sm">{message}</span>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-start space-x-3"
            >
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-red-400 text-sm">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="input pl-11 w-full h-12"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  required
                  placeholder="Enter your password"
                  className="input pl-11 w-full h-12"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 cursor-pointer" 
                />
                <span className="ml-2 text-sm text-gray-400">Remember me</span>
              </label>
              <Link 
                to="/forgot-password" 
                className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-12 flex items-center justify-center space-x-2 text-base font-semibold group"
            >
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
              {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <div className="mt-8 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-dark-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-dark-900 text-gray-400">New to Career AI?</span>
              </div>
            </div>

            <Link 
              to="/register"
              className="block w-full text-center px-4 py-3 border border-dark-600 rounded-lg hover:bg-dark-800 hover:border-primary-500/30 transition-all text-gray-300 font-medium"
            >
              Create an Account
            </Link>

            <div className="text-center mt-4">
              <a 
                href="mailto:support@careerai.com" 
                className="text-sm text-primary-400 hover:text-primary-300 transition-colors inline-flex items-center space-x-1"
              >
                <span>Need help? Contact Support</span>
              </a>
            </div>
          </div>
        </div>
      </motion.div>

      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
