import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Mail, Lock, User, Phone, AlertTriangle,
  CheckCircle, KeyRound, Eye, EyeOff, Sparkles, Sun, Moon, ArrowRight
} from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import Spinner from '../components/Spinner'
import { getApiError } from '../utils/apiError'
import { useTheme } from '../hooks/useTheme'

export default function RegisterPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'student',
    phone: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Local Theme Sync (shared hook)
  const { theme, toggleTheme } = useTheme()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.post('/api/auth/register', { ...formData, role: 'student' })
      setSuccess(true)
      // Don't navigate immediately - let user see the success message and enter code
    } catch (err) {
      setError(getApiError(err, 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setError('')
    setVerifyLoading(true)

    try {
      await api.post('/api/auth/verify-code', {
        email: formData.email,
        code: verificationCode
      })

      // Redirect to login with success message
      navigate('/login', {
        state: { message: 'Email verified successfully! Please login.' }
      })
    } catch (err) {
      setError(getApiError(err, 'Verification failed'))
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleResendCode = async () => {
    setError('')
    setLoading(true)

    try {
      await api.post('/api/auth/resend-verification', { email: formData.email })
      toast.success('Verification code resent! Check your email.')
    } catch (err) {
      setError(getApiError(err, 'Failed to resend code'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-canvas text-ink transition-colors duration-200">

      {/* ─── Left visual panel ─── */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 bg-primary-950 relative overflow-hidden flex-col justify-between p-12 border-r border-hairline">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-pill blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary-500/10 rounded-pill blur-3xl pointer-events-none" />

        {/* Logo and Brand */}
        <div className="z-10 flex items-center space-x-3">
          <img src="/logo.png" alt="CareerSync Logo" className="w-10 h-10 object-contain" />
          <span className="font-display text-title-lg font-bold tracking-[-0.02em] text-white">CareerSync AI</span>
        </div>

        {/* Hero Content */}
        <div className="z-10 max-w-lg my-auto space-y-8">
          <div>
            <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-white leading-[1.05] tracking-[-0.03em] mb-4">
              Launch Your<br />
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Career Journey.</span>
            </h1>
            <p className="text-slate-400 text-body-lg">
              Join thousands of students and recruiters who use CareerSync AI to connect talent with opportunity — intelligently.
            </p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: '12K+', label: 'Students' },
              { value: '480+', label: 'Employers' },
              { value: '94%', label: 'Match Rate' }
            ].map(stat => (
              <div key={stat.label} className="bg-primary-900/40 border border-white/10 rounded-card p-4 text-center">
                <p className="font-display text-2xl font-bold leading-none text-white">{stat.value}</p>
                <p className="text-caption text-slate-400 mt-1.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Feature cards */}
          <div className="space-y-3">
            {[
              { color: 'primary', title: 'AI Resume Parsing', desc: 'Instant structured talent insights via offline parsing.' },
              { color: 'indigo', title: 'Skill Roadmaps', desc: 'Personalised career pathways built from your unique profile.' },
              { color: 'blue', title: 'Live Interview Practice', desc: 'Real-time AI feedback on communication, clarity, and depth.' }
            ].map(feat => (
 <div key={feat.title} className="flex gap-4 p-4 bg-primary-900/40 border border-white/10 rounded-card hover:border-white/20 transition-colors">
                <div className={`p-2.5 rounded-card h-fit shrink-0 border ${feat.color === 'primary' ? 'bg-primary-500/10 border-primary-500/20 text-primary-400' : feat.color === 'indigo' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-white text-caption">{feat.title}</h4>
                  <p className="text-slate-400 text-[11px] mt-0.5">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="z-10 flex items-center justify-between border-t border-white/10 pt-6">
          <div className="flex items-center gap-2 text-slate-400 text-caption">
            <Sparkles className="w-4 h-4 text-primary-400" />
            <span>Powered by DeepSeek</span>
          </div>
          <span className="text-[10px] text-slate-500 tracking-[0.14em] font-semibold uppercase">v2.1 Stable</span>
        </div>
      </div>

      {/* ─── Right form panel ─── */}
      <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col justify-center p-8 sm:p-12 md:p-16 relative bg-canvas transition-colors duration-200 overflow-y-auto">

        {/* Floating Theme Toggle */}
        <button
          onClick={toggleTheme}
          type="button"
 className="absolute top-6 right-6 p-2.5 rounded-card border border-hairline bg-surface-raised text-ink-muted hover:text-ink hover:border-hairline-strong transition-all cursor-pointer z-50 shadow-soft-xs"
          aria-label="Toggle Theme"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
        </button>

        <div className="w-full max-w-md mx-auto">
          {/* Mobile Logo */}
          <div className="flex md:hidden items-center space-x-3 mb-8">
            <img src="/logo.png" alt="CareerSync Logo" className="w-8 h-8 object-contain" />
            <span className="font-display text-title font-bold tracking-[-0.02em] text-ink">CareerSync AI</span>
          </div>

          {/* Header */}
          {!success && (
            <div className="mb-8">
              <p className="eyebrow mb-2">Get Started</p>
              <h2 className="app-page-title mb-2">Create Account</h2>
              <p className="text-body text-ink-muted">Join CareerSync AI and unlock intelligent career tools.</p>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-4 bg-rose-500/10 border border-rose-500/20 rounded-card flex items-start space-x-3 text-rose-600 dark:text-rose-400 text-caption font-medium"
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* ─── Verification Step ─── */}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-success/10 border border-success/20 rounded-card flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-success" />
                </div>
                <h2 className="font-display text-title-lg font-bold tracking-[-0.02em] text-ink mb-2">Check Your Email</h2>
                <p className="text-body text-ink-muted">
                  We sent a 6-digit code to{' '}
                  <span className="font-semibold text-ink">{formData.email}</span>.
                  <br />Enter it below to verify your account.
                </p>
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label className="app-label mb-2 block">
                    Verification Code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-subtle" />
                    <input
                      type="text"
                      required
                      maxLength="6"
                      placeholder="Enter 6-digit code"
                      className="app-input pl-12 text-center text-lg font-bold tracking-widest"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={verifyLoading || verificationCode.length !== 6}
                  aria-busy={verifyLoading}
                  className="app-btn-primary w-full"
                >
                  <span>Verify Email</span>
                  {verifyLoading ? (
                    <Spinner className="h-5 w-5" />
                  ) : (
                    <ArrowRight className="h-5 w-5 shrink-0" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  aria-busy={loading}
                  className="app-btn-secondary w-full"
                >
                  {loading ? <Spinner className="h-5 w-5" /> : <Mail className="h-5 w-5 shrink-0" />}
                  <span>Resend Code</span>
                </button>
              </form>

              <p className="text-center text-caption text-ink-subtle">
                Didn&apos;t receive it? Check your spam folder.
              </p>
            </motion.div>
          )}

          {/* ─── Registration Form ─── */}
          {!success && (
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Full Name */}
              <div>
                <label className="app-label mb-2 block">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-subtle" />
                  <input
                    type="text"
                    required
                    placeholder="Jane Smith"
                    className="app-input pl-12"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="app-label mb-2 block">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-subtle" />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="app-input pl-12"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="app-label mb-2 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-subtle" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength="8"
                    placeholder="Min. 8 characters"
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

              {/* Phone (Optional) */}
              <div>
                <label className="app-label mb-2 block">
                  Phone <span className="text-ink-subtle font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-subtle" />
                  <input
                    type="tel"
                    placeholder="+91 99999 00000"
                    className="app-input pl-12"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              {/* Student-only signup — role is fixed to 'student'. */}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="app-btn-primary w-full"
              >
                <span>Create Account</span>
                {loading ? (
                  <Spinner className="h-5 w-5" />
                ) : (
                  <ArrowRight className="h-5 w-5 shrink-0" />
                )}
              </button>

              {/* Sign In Link */}
              <div className="mt-2 text-center text-caption text-ink-muted">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-primary-600 dark:text-primary-400 hover:underline transition-colors">
                  Sign in here
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>

      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
