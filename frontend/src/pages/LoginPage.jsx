import React, { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, AlertTriangle, CheckCircle, ArrowRight, Eye, EyeOff, Sparkles, Sun, Moon } from 'lucide-react'
import api, { API_BASE_URL } from '../config/api'
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
  const [showPassword, setShowPassword] = useState(false)
  const [googleRole, setGoogleRole] = useState('student')
  const message = location.state?.message

  // Local Theme Sync
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get('token')
    const errorParam = params.get('error')

    if (errorParam) {
      const decodedError = decodeURIComponent(errorParam)
      setError(decodedError)
      toast.error(decodedError)
      // Clear error query param from URL
      navigate('/login', { replace: true })
    } else if (token) {
      setLoading(true)
      const fetchUserData = async () => {
        try {
          // Store token in secure storage
          secureStorage.setItem('token', token)
          // Set default authorization header
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`

          // Fetch current user details
          const response = await api.get('/api/auth/me')
          const user = response.data

          secureStorage.setItem('user', user)
          secureStorage.setItem('login_time', Date.now())

          // Navigate based on role
          switch (user.role) {
            case 'admin':
              navigate('/admin/dashboard', { replace: true })
              break
            case 'employer':
              navigate('/employer/dashboard', { replace: true })
              break
            default:
              navigate('/student/dashboard', { replace: true })
          }
          toast.success('Login successful!')
        } catch (err) {
          console.error('Failed to login via Google token:', err)
          const errorMsg = err.response?.data?.detail || 'Authentication failed'
          setError(errorMsg)
          toast.error(errorMsg)
          // Clear invalid token from secure storage
          secureStorage.removeItem('token')
          delete api.defaults.headers.common['Authorization']
        } finally {
          setLoading(false)
        }
      }
      fetchUserData()
    }
  }, [location.search, navigate, toast])

  const handleGoogleLogin = () => {
    const base = API_BASE_URL || 'http://localhost:8000'
    window.location.href = `${base}/api/auth/google/login?role=${googleRole}`
  }

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
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* Left visual panel */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 bg-slate-900 dark:bg-slate-950 relative overflow-hidden flex-col justify-between p-12 border-r border-slate-200 dark:border-slate-800">
        {/* Background Grid Pattern & Gradients */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Logo and Brand */}
        <div className="z-10 flex items-center space-x-3">
          <img src="/logo.png" alt="CareerSync Logo" className="w-10 h-10 object-contain" />
          <span className="text-2xl font-extrabold text-white tracking-tight">CareerSync AI</span>
        </div>

        {/* Feature Highlights */}
        <div className="z-10 max-w-lg my-auto space-y-8">
          <div>
            <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight mb-4">
              Align Your Talent.<br />
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Sync Your Future.</span>
            </h1>
            <p className="text-slate-400 text-lg">
              Unlock a premium suite of intelligent career tools designed to accelerate alignment between candidates and employers.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4 p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm hover:bg-white/8 transition-all">
              <div className="p-3 bg-primary-500/10 border border-primary-500/20 text-primary-400 rounded-lg h-fit shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Gemini-Powered Parser</h4>
                <p className="text-slate-400 text-sm">Convert raw resumes into structured talent insights, matching exact skills and credentials.</p>
              </div>
            </div>

            <div className="flex gap-4 p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm hover:bg-white/8 transition-all">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg h-fit shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">High-Fidelity AI Interviews</h4>
                <p className="text-slate-400 text-sm">Practice in a real-time conversational session with semantic performance tracking.</p>
              </div>
            </div>

            <div className="flex gap-4 p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm hover:bg-white/8 transition-all">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg h-fit shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Intelligent Pathways & Matching</h4>
                <p className="text-slate-400 text-sm">Generate visual skill roadmaps and evaluate applicant suitability scores for role profiles.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="z-10 flex items-center justify-between border-t border-white/10 pt-6">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <Sparkles className="w-4 h-4 text-primary-400" />
            <span>Powered by Gemini 1.5 Pro</span>
          </div>
          <span className="text-[10px] text-slate-500 tracking-wider font-semibold uppercase">v2.1 Stable</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col justify-center p-8 sm:p-12 md:p-16 relative bg-white dark:bg-slate-900 transition-colors duration-200">
        
        {/* Floating Theme Toggle (Local fallback for auth pages) */}
        <button
          onClick={toggleTheme}
          type="button"
          className="absolute top-6 right-6 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-405 transition-all cursor-pointer z-50 shadow-sm"
          aria-label="Toggle Theme"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-505" />}
        </button>

        <div className="w-full max-w-md mx-auto">
          {/* Logo visible only on mobile/tablet */}
          <div className="flex md:hidden items-center space-x-3 mb-8">
            <img src="/logo.png" alt="CareerSync Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">CareerSync AI</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">Sign In</h2>
            <p className="text-slate-500 dark:text-slate-400">Enter your credentials to access your CareerSync portal.</p>
          </div>

          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start space-x-3 text-emerald-600 dark:text-emerald-400 text-sm font-medium"
            >
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-500" />
              <span>{message}</span>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start space-x-3 text-rose-600 dark:text-rose-400 text-sm font-medium"
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-505" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="input pl-12 w-full h-12 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Enter your password"
                  className="input pl-12 pr-12 w-full h-12 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 cursor-pointer" 
                />
                <span className="ml-2.5 text-sm text-slate-605 dark:text-slate-400 select-none">Remember me</span>
              </label>
              <Link 
                to="/forgot-password" 
                className="text-sm font-semibold text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-350 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-12 rounded-xl flex items-center justify-center space-x-2 text-base font-semibold group cursor-pointer bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 border-0 shadow-md shadow-primary-500/10"
            >
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
              {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <div className="mt-8">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium transition-colors">Or continue with</span>
              </div>
            </div>

            {/* Google Role Selector */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-400 dark:text-slate-505 uppercase tracking-wider mb-2 text-center select-none">
                Sign in / Register as:
              </label>
              <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={() => setGoogleRole('student')}
                  className={`py-2 px-3 text-xs font-bold border rounded-xl transition-all cursor-pointer ${
                    googleRole === 'student'
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/20 dark:text-primary-400 dark:border-primary-500 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 text-slate-650 dark:text-slate-400 bg-transparent'
                  }`}
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => setGoogleRole('employer')}
                  className={`py-2 px-3 text-xs font-bold border rounded-xl transition-all cursor-pointer ${
                    googleRole === 'employer'
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/20 dark:text-primary-400 dark:border-primary-500 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 text-slate-650 dark:text-slate-400 bg-transparent'
                  }`}
                >
                  Recruiter
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-12 flex items-center justify-center space-x-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-950 transition-all font-semibold text-slate-700 dark:text-slate-300 bg-transparent cursor-pointer shadow-sm"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.57 0-6.477-2.907-6.477-6.477s2.907-6.477 6.477-6.477c1.77 0 3.35.686 4.5 1.8l3.15-3.15C19.23 1.943 15.96 0 12.24 0 5.48 0 0 5.48 0 12.24s5.48 12.24 12.24 12.24c6.8 0 12.24-5.44 12.24-12.24 0-.783-.069-1.543-.195-2.285H12.24z"
                />
              </svg>
              <span>{loading ? 'Connecting...' : 'Sign in with Google'}</span>
            </button>
          </div>

          <div className="mt-8 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 transition-colors">New to CareerSync?</span>
              </div>
            </div>

            <Link 
              to="/register"
              className="block w-full text-center px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-950 hover:border-primary-500/30 dark:hover:border-primary-500/30 transition-all text-slate-700 dark:text-slate-300 font-semibold shadow-sm"
            >
              Create an Account
            </Link>

            <div className="text-center mt-4">
              <a 
                href="mailto:support@careersync.com" 
                className="text-sm font-semibold text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-350 transition-colors inline-flex items-center space-x-1"
              >
                <span>Need help? Contact Support</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
