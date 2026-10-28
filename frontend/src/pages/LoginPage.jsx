import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, AlertTriangle, CheckCircle, ArrowRight, Eye, EyeOff, Sparkles, Sun, Moon } from 'lucide-react'
import api, { API_BASE_URL } from '../config/api'
import secureStorage from '../utils/secureStorage'
import { setAuthToken, clearAuthToken, getAuthToken } from '../utils/authToken'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import Spinner from '../components/Spinner'
import { sanitizeEmail } from '../utils/sanitize'
import { getDashboardPath } from '../utils/navigation'
import { useTheme } from '../hooks/useTheme'
import { getApiError } from '../utils/apiError'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [formData, setFormData] = useState({
    username: typeof window !== 'undefined' ? (localStorage.getItem('remembered_email') || '') : '',
    password: ''
  })
  const [rememberMe, setRememberMe] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem('remembered_email')
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  // Student-only signup/login — Google OAuth always uses the student role.
  const googleRole = 'student'
  const message = location.state?.message

  // Local Theme Sync (shared hook)
  const { theme, toggleTheme } = useTheme()

  // Exchange codes are single-use, so remember which one has already been
  // sent. React 18 StrictMode invokes mount effects twice, and this effect
  // re-runs whenever location.search changes — without this guard the same
  // code would be redeemed twice and the second attempt would fail.
  const redeemedExchangeRef = useRef(null)

  /**
   * Shared post-login success path: persist the session, then route by role
   * (or resume an interview redirect preserved by a 401). Used by both the
   * password flow and the Google OAuth exchange flow.
   */
  const completeLogin = (accessToken, user, { replace = false } = {}) => {
    // Store session via the in-memory holder (mirrored for reload restore)
    setAuthToken(accessToken)
    secureStorage.setItem('user', user)
    secureStorage.setItem('login_time', Date.now())

    // Set default authorization header
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`

    // Navigate based on role — or back to the preserved location
    // (e.g. an interview interrupted by a 401) when present.
    const postLoginRedirect = sessionStorage.getItem('post_login_redirect')
    if (postLoginRedirect && postLoginRedirect.startsWith('/dashboard/interview/')) {
      sessionStorage.removeItem('post_login_redirect')
      navigate(postLoginRedirect, { replace: true })
    } else {
      navigate(getDashboardPath(user.role, '/student/dashboard'), { replace })
    }
    toast.success('Login successful!')
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const exchangeCode = params.get('exchange')
    const token = params.get('token')
    const errorParam = params.get('error')

    if (exchangeCode) {
      if (redeemedExchangeRef.current === exchangeCode) return
      redeemedExchangeRef.current = exchangeCode

      setError('')
      setLoading(true)
      const redeemExchangeCode = async () => {
        try {
          const response = await api.post('/api/auth/google/exchange', { code: exchangeCode })
          const { access_token, user } = response.data

          // Drop the single-use code from the URL before redirecting, so a
          // refresh or Back navigation cannot replay it.
          navigate('/login', { replace: true })
          completeLogin(access_token, user, { replace: true })
        } catch (err) {
          console.error('Failed to complete Google sign-in:', err)
          const errorMsg = getApiError(err, 'Google sign-in failed. Please try again.')
          setError(errorMsg)
          toast.error(errorMsg)
          // The code is single-use and already spent — strip it from the URL
          // so reloading the page does not retry a dead code.
          navigate('/login', { replace: true })
        } finally {
          setLoading(false)
        }
      }
      redeemExchangeCode()
    } else if (errorParam) {
      const decodedError = decodeURIComponent(errorParam)
      setError(decodedError)
      toast.error(decodedError)
      // Clear error query param from URL
      navigate('/login', { replace: true })
    } else if (token) {
      setLoading(true)
      const fetchUserData = async () => {
        try {
          // Store token via the in-memory holder (mirrored for reload restore)
          setAuthToken(token)
          // Set default authorization header
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`

          // Fetch current user details
          const response = await api.get('/api/auth/me')
          const user = response.data

          completeLogin(token, user, { replace: true })
        } catch (err) {
          console.error('Failed to login via Google token:', err)
          const errorMsg = getApiError(err, 'Authentication failed')
          setError(errorMsg)
          toast.error(errorMsg)
          // Clear invalid token (memory + restore mirror)
          clearAuthToken()
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

      // Remember-me: persist only the email address for prefill, never the password.
      try {
        if (rememberMe && sanitizedEmail) {
          localStorage.setItem('remembered_email', sanitizedEmail)
        } else {
          localStorage.removeItem('remembered_email')
        }
      } catch {
        // storage may be unavailable (private mode) — login still succeeds
      }

      // Store session and route by role (same path as the Google exchange flow)
      completeLogin(access_token, user)
    } catch (err) {
      const errorMsg = getApiError(err, 'Login failed')
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-canvas text-ink transition-colors duration-200">
      
      {/* Left visual panel */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 bg-primary-950 relative overflow-hidden flex-col justify-between p-12 border-r border-hairline">
        {/* Background Grid Pattern & Gradients */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary-500/10 rounded-pill blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-pill blur-3xl pointer-events-none" />
        
        {/* Logo and Brand */}
        <div className="z-10 flex items-center space-x-3">
          <img src="/logo.png" alt="CareerSync Logo" className="w-10 h-10 object-contain" />
          <span className="font-display text-title-lg font-bold tracking-[-0.02em] text-white">CareerSync AI</span>
        </div>

        {/* Feature Highlights */}
        <div className="z-10 max-w-lg my-auto space-y-8">
          <div>
            <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-white leading-[1.05] tracking-[-0.03em] mb-4">
              Align Your Talent.<br />
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Sync Your Future.</span>
            </h1>
            <p className="text-slate-400 text-body-lg">
              Unlock a premium suite of intelligent career tools designed to accelerate alignment between candidates and employers.
            </p>
          </div>

          <div className="space-y-4">
 <div className="flex gap-4 p-4 bg-primary-900/40 border border-white/10 rounded-card backdrop-blur-sm hover:border-white/20 transition-colors">
              <div className="p-3 bg-primary-500/10 border border-primary-500/20 text-primary-400 rounded-card h-fit shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-display font-bold text-white text-base">Smart Resume Parser</h4>
                <p className="text-slate-400 text-caption">Convert raw resumes into structured talent insights, matching exact skills and credentials.</p>
              </div>
            </div>

 <div className="flex gap-4 p-4 bg-primary-900/40 border border-white/10 rounded-card backdrop-blur-sm hover:border-white/20 transition-colors">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-card h-fit shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-display font-bold text-white text-base">High-Fidelity AI Interviews</h4>
                <p className="text-slate-400 text-caption">Practice in a real-time conversational session with semantic performance tracking.</p>
              </div>
            </div>

 <div className="flex gap-4 p-4 bg-primary-900/40 border border-white/10 rounded-card backdrop-blur-sm hover:border-white/20 transition-colors">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-card h-fit shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-display font-bold text-white text-base">Intelligent Pathways & Matching</h4>
                <p className="text-slate-400 text-caption">Generate visual skill roadmaps and evaluate applicant suitability scores for role profiles.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="z-10 flex items-center justify-between border-t border-white/10 pt-6">
          <div className="flex items-center gap-2 text-slate-400 text-caption">
            <Sparkles className="w-4 h-4 text-primary-400" />
            <span>Powered by DeepSeek</span>
          </div>
          <span className="text-[10px] text-slate-500 tracking-[0.14em] font-semibold uppercase">v2.1 Stable</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col justify-center p-8 sm:p-12 md:p-16 relative bg-canvas transition-colors duration-200">
        
        {/* Floating Theme Toggle (Local fallback for auth pages) */}
        <button
          onClick={toggleTheme}
          type="button"
 className="absolute top-6 right-6 p-2.5 rounded-card border border-hairline bg-surface-raised text-ink-muted hover:text-ink hover:border-hairline-strong transition-all cursor-pointer z-50 shadow-soft-xs"
          aria-label="Toggle Theme"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
        </button>

        <div className="w-full max-w-md mx-auto">
          {/* Logo visible only on mobile/tablet */}
          <div className="flex md:hidden items-center space-x-3 mb-8">
            <img src="/logo.png" alt="CareerSync Logo" className="w-8 h-8 object-contain" />
            <span className="font-display text-title font-bold text-ink tracking-[-0.02em]">CareerSync AI</span>
          </div>

          <div className="mb-8">
            <p className="eyebrow mb-2">Student Portal</p>
            <h2 className="app-page-title mb-2">Sign In</h2>
            <p className="text-body text-ink-muted">Enter your credentials to access your CareerSync portal.</p>
          </div>

          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-success/10 border border-success/20 rounded-card flex items-start space-x-3 text-success text-caption font-medium"
            >
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-success" />
              <span>{message}</span>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-card flex items-start space-x-3 text-rose-600 dark:text-rose-400 text-caption font-medium"
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="app-label block mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-subtle" />
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="app-input pl-12"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="app-label block mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-subtle" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Enter your password"
                  className="app-input pl-12 pr-12"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-ink-subtle hover:text-ink focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input 
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="app-checkbox" 
                />
                <span className="ml-2.5 text-caption text-ink-muted select-none">Remember me</span>
              </label>
              <Link 
                to="/forgot-password" 
                className="text-caption font-semibold text-primary-600 dark:text-primary-400 hover:underline transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="app-btn-primary w-full"
            >
              <span>Sign In</span>
              {loading ? (
                <Spinner className="h-5 w-5" />
              ) : (
                <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
              )}
            </button>
          </form>

          <div className="mt-8">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-hairline"></div>
              </div>
              <div className="relative flex justify-center text-caption">
                <span className="px-4 bg-canvas text-ink-subtle font-medium transition-colors">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              aria-busy={loading}
              className="app-btn-secondary w-full"
            >
              {loading ? (
                <Spinner className="h-5 w-5" />
              ) : (
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.57 0-6.477-2.907-6.477-6.477s2.907-6.477 6.477-6.477c1.77 0 3.35.686 4.5 1.8l3.15-3.15C19.23 1.943 15.96 0 12.24 0 5.48 0 0 5.48 0 12.24s5.48 12.24 12.24 12.24c6.8 0 12.24-5.44 12.24-12.24 0-.783-.069-1.543-.195-2.285H12.24z"
                  />
                </svg>
              )}
              <span>Sign in with Google</span>
            </button>
          </div>

          <div className="mt-8 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-hairline"></div>
              </div>
              <div className="relative flex justify-center text-caption">
                <span className="px-4 bg-canvas text-ink-subtle transition-colors">New to CareerSync?</span>
              </div>
            </div>

            <Link 
              to="/register"
              className="app-btn-secondary w-full"
            >
              Create an Account
            </Link>

            <div className="text-center mt-4">
              <a 
                href="mailto:support@careersync.com" 
                className="text-caption font-semibold text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center space-x-1 transition-colors"
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
