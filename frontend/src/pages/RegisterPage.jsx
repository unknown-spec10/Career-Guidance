import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Mail, Lock, User, Phone, Briefcase, UserCircle, AlertTriangle,
  CheckCircle, KeyRound, Eye, EyeOff, Sparkles, Sun, Moon, ArrowRight
} from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.post('/api/auth/register', formData)
      setSuccess(true)
      // Don't navigate immediately - let user see the success message and enter code
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
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
      setError(err.response?.data?.detail || 'Verification failed')
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
      setError(err.response?.data?.detail || 'Failed to resend code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">

      {/* ─── Left visual panel ─── */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 bg-slate-900 dark:bg-slate-950 relative overflow-hidden flex-col justify-between p-12 border-r border-slate-200 dark:border-slate-800">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Logo and Brand */}
        <div className="z-10 flex items-center space-x-3">
          <img src="/logo.png" alt="CareerSync Logo" className="w-10 h-10 object-contain" />
          <span className="text-2xl font-extrabold text-white tracking-tight">CareerSync AI</span>
        </div>

        {/* Hero Content */}
        <div className="z-10 max-w-lg my-auto space-y-8">
          <div>
            <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight mb-4">
              Launch Your<br />
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Career Journey.</span>
            </h1>
            <p className="text-slate-400 text-lg">
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
              <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-white">{stat.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Feature cards */}
          <div className="space-y-3">
            {[
              { color: 'primary', title: 'AI Resume Parsing', desc: 'Instant structured talent insights via Gemini 1.5 Pro.' },
              { color: 'indigo', title: 'Skill Roadmaps', desc: 'Personalised career pathways built from your unique profile.' },
              { color: 'blue', title: 'Live Interview Practice', desc: 'Real-time AI feedback on communication, clarity, and depth.' }
            ].map(feat => (
              <div key={feat.title} className="flex gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/8 transition-all">
                <div className={`p-2.5 bg-${feat.color}-500/10 border border-${feat.color}-500/20 text-${feat.color}-400 rounded-lg h-fit shrink-0`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{feat.title}</h4>
                  <p className="text-slate-400 text-xs mt-0.5">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="z-10 flex items-center justify-between border-t border-white/10 pt-6">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <Sparkles className="w-4 h-4 text-primary-400" />
            <span>Powered by Gemini 1.5 Pro</span>
          </div>
          <span className="text-[10px] text-slate-500 tracking-wider font-semibold uppercase">v2.1 Stable</span>
        </div>
      </div>

      {/* ─── Right form panel ─── */}
      <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col justify-center p-8 sm:p-12 md:p-16 relative bg-white dark:bg-slate-900 transition-colors duration-200 overflow-y-auto">

        {/* Floating Theme Toggle */}
        <button
          onClick={toggleTheme}
          type="button"
          className="absolute top-6 right-6 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all cursor-pointer z-50 shadow-sm"
          aria-label="Toggle Theme"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
        </button>

        <div className="w-full max-w-md mx-auto">
          {/* Mobile Logo */}
          <div className="flex md:hidden items-center space-x-3 mb-8">
            <img src="/logo.png" alt="CareerSync Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">CareerSync AI</span>
          </div>

          {/* Header */}
          {!success && (
            <div className="mb-8">
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">Create Account</h2>
              <p className="text-slate-500 dark:text-slate-400">Join CareerSync AI and unlock intelligent career tools.</p>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start space-x-3 text-rose-600 dark:text-rose-400 text-sm font-medium"
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
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">Check Your Email</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  We sent a 6-digit code to{' '}
                  <span className="font-semibold text-slate-700 dark:text-white">{formData.email}</span>.
                  <br />Enter it below to verify your account.
                </p>
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">
                    Verification Code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      required
                      maxLength="6"
                      placeholder="Enter 6-digit code"
                      className="input pl-12 w-full h-12 rounded-xl text-center text-lg font-bold tracking-widest border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={verifyLoading || verificationCode.length !== 6}
                  className="btn-primary w-full h-12 rounded-xl flex items-center justify-center space-x-2 text-base font-semibold cursor-pointer bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 border-0 shadow-md shadow-primary-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{verifyLoading ? 'Verifying...' : 'Verify Email'}</span>
                  {!verifyLoading && <ArrowRight className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="w-full h-12 flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-950 transition-all font-semibold text-slate-600 dark:text-slate-400 cursor-pointer text-sm"
                >
                  {loading ? 'Sending...' : 'Resend Code'}
                </button>
              </form>

              <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                Didn&apos;t receive it? Check your spam folder.
              </p>
            </motion.div>
          )}

          {/* ─── Registration Form ─── */}
          {!success && (
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Jane Smith"
                    className="input pl-12 w-full h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="input pl-12 w-full h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength="8"
                    placeholder="Min. 8 characters"
                    className="input pl-12 pr-12 w-full h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Phone (Optional) */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">
                  Phone <span className="text-slate-400 dark:text-slate-500 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="tel"
                    placeholder="+91 99999 00000"
                    className="input pl-12 w-full h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              {/* Role Selector */}
              <div>
                <label className="block text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">I am joining as…</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'student', icon: UserCircle, label: 'Student', desc: 'Find jobs & grow skills' },
                    { value: 'employer', icon: Briefcase, label: 'Recruiter', desc: 'Post jobs & find talent' }
                  ].map(({ value, icon: Icon, label, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData({ ...formData, role: value })}
                      className={`relative p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
                        formData.role === value
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20 shadow-sm shadow-primary-500/10'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-transparent'
                      }`}
                    >
                      <Icon className={`w-6 h-6 mb-2 ${formData.role === value ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'}`} />
                      <p className={`font-bold text-sm ${formData.role === value ? 'text-primary-700 dark:text-primary-400' : 'text-slate-700 dark:text-slate-300'}`}>{label}</p>
                      <p className={`text-xs mt-0.5 ${formData.role === value ? 'text-primary-500 dark:text-primary-500' : 'text-slate-400 dark:text-slate-500'}`}>{desc}</p>
                      {formData.role === value && (
                        <div className="absolute top-2 right-2 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full h-12 rounded-xl flex items-center justify-center space-x-2 text-base font-semibold cursor-pointer bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 border-0 shadow-md shadow-primary-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
                {!loading && <ArrowRight className="w-5 h-5" />}
              </button>

              {/* Sign In Link */}
              <div className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 transition-colors">
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
