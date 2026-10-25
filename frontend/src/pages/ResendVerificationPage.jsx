import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import Spinner from '../components/Spinner'
import api from '../config/api'
import { getApiError } from '../utils/apiError'

export default function ResendVerificationPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle, loading, success, error
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    try {
      const response = await api.post('/api/auth/resend-verification', { email })
      setStatus('success')
      setMessage(response.data.message || 'Verification email sent!')
    } catch (err) {
      setStatus('error')
      setMessage(getApiError(err, 'Failed to send verification email'))
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
          <Mail className="w-16 h-16 text-primary-600 dark:text-primary-400 mx-auto mb-4" />
          <h1 className="app-page-title mb-2">Resend Verification</h1>
          <p className="text-body text-ink-muted">Enter your email to receive a new verification code</p>
        </div>

        <div className="surface-card p-8">
          {status === 'success' ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
              <h3 className="font-display text-title font-bold mb-2 text-success">Code Sent!</h3>
              <p className="text-body text-ink-muted mb-6">{message}</p>
              <p className="text-caption text-ink-subtle mb-6">
                Please check your inbox and spam folder for the verification code.
              </p>
              <Link to="/login" className="app-btn-primary w-full">
                Go to Login
              </Link>
            </div>
          ) : (
            <>
              {status === 'error' && (
                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-card flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-rose-500 dark:text-rose-400" />
                  <span className="text-rose-600 dark:text-rose-400 text-caption font-medium">{message}</span>
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

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  aria-busy={status === 'loading'}
                  className="app-btn-primary w-full"
                >
                  {status === 'loading' ? <Spinner className="h-5 w-5" /> : <Mail className="h-5 w-5 shrink-0" />}
                  <span>Send Verification Code</span>
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link 
                  to="/login" 
                  className="inline-flex items-center justify-center gap-1 text-caption font-semibold text-ink-muted transition-colors hover:text-ink"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Login</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
