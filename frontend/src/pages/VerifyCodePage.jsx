import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, AlertTriangle, ArrowLeft, Mail, KeyRound } from 'lucide-react'
import api from '../config/api'
import { getApiError } from '../utils/apiError'
import Spinner from '../components/Spinner'

export default function VerifyCodePage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('idle') // idle, loading, success, error
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('loading')
    setMessage('')
    try {
      const resp = await api.post('/api/auth/verify-code', { email, code })
      setStatus('success')
      setMessage(resp.data?.message || 'Email verified successfully!')
      setTimeout(() => {
        navigate('/login', { state: { message: 'Email verified! Please login.' } })
      }, 1500)
    } catch (err) {
      setStatus('error')
      setMessage(getApiError(err, 'Invalid or expired code'))
    }
  }

  const handleResend = async () => {
    setStatus('loading')
    setMessage('')
    try {
      const resp = await api.post('/api/auth/resend-verification', { email })
      setStatus('success')
      setMessage(resp.data?.message || 'New verification code sent!')
    } catch (err) {
      setStatus('error')
      setMessage(getApiError(err, 'Failed to resend code'))
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <KeyRound className="w-16 h-16 text-primary-600 dark:text-primary-400 mx-auto mb-4" />
          <h1 className="app-page-title mb-2">Verify Your Email</h1>
          <p className="text-body text-ink-muted">Enter the verification code sent to your email</p>
        </div>

        <div className="surface-card p-6">
          {status === 'error' && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-card flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-500 dark:text-rose-400" />
              <span className="text-rose-600 dark:text-rose-400 text-caption font-medium">{message}</span>
            </div>
          )}
          {status === 'success' && (
            <div className="mb-4 p-3 bg-success/10 border border-success/20 rounded-card flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-success" />
              <span className="text-success text-caption font-medium">{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="app-label mb-2 block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-subtle" />
                <input
                  type="email"
                  required
                  className="app-input pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your-email@example.com"
                />
              </div>
            </div>

            <div>
              <label className="app-label mb-2 block">Verification Code</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-subtle" />
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={12}
                  className="app-input pl-10 tracking-widest"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
                  placeholder="Enter 6-digit code"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              aria-busy={status === 'loading'}
              className="app-btn-primary w-full"
            >
              {status === 'loading' ? <Spinner className="h-5 w-5" /> : <KeyRound className="h-5 w-5 shrink-0" />}
              <span>Verify Code</span>
            </button>
          </form>

          <div className="mt-6 space-y-3">
            <button
              onClick={handleResend}
              disabled={status === 'loading' || !email}
              aria-busy={status === 'loading'}
              className="app-btn-secondary w-full"
            >
              {status === 'loading' ? <Spinner className="h-5 w-5" /> : <Mail className="h-5 w-5 shrink-0" />}
              <span>Resend Code</span>
            </button>

            <Link 
              to="/login" 
              className="inline-flex items-center justify-center gap-1 text-caption font-semibold text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Login</span>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
