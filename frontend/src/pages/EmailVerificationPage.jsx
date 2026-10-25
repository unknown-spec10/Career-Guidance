import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'
import api from '../config/api'
import { getApiError } from '../utils/apiError'

export default function EmailVerificationPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying') // verifying, success, error
  const [message, setMessage] = useState('')
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token provided')
      return
    }

    verifyEmail()
  }, [token])

  const verifyEmail = async () => {
    try {
      setStatus('verifying')
      const response = await api.post('/api/auth/verify-email', { token })
      setStatus('success')
      setMessage(response.data.message || 'Email verified successfully!')
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login', { 
          state: { message: 'Email verified! Please login to continue.' } 
        })
      }, 3000)
    } catch (err) {
      setStatus('error')
      setMessage(getApiError(err, 'Verification failed'))
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="surface-card max-w-md w-full p-8 text-center"
      >
        {status === 'verifying' && (
          <>
            <Loader2 className="w-16 h-16 text-primary-600 dark:text-primary-400 mx-auto mb-4 animate-spin" />
            <h2 className="font-display text-title font-bold text-ink mb-2">Verifying Email</h2>
            <p className="text-body text-ink-muted">Please wait while we verify your email address...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="font-display text-title font-bold mb-2 text-success">Email Verified!</h2>
            <p className="text-body text-ink-muted mb-4">{message}</p>
            <p className="text-caption text-ink-subtle">Redirecting to login...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-rose-500 dark:text-rose-400 mx-auto mb-4" />
            <h2 className="font-display text-title font-bold mb-2 text-rose-600 dark:text-rose-400">Verification Failed</h2>
            <p className="text-body text-ink-muted mb-6">{message}</p>
            <div className="space-y-3">
              <Link to="/login" className="app-btn-primary w-full">
                Go to Login
              </Link>
              <button
                onClick={() => navigate('/resend-verification')}
                className="app-btn-secondary w-full"
              >
                <Mail className="w-4 h-4" />
                <span>Resend Verification Code</span>
              </button>
              <Link to="/verify-code" className="text-caption font-semibold text-ink-muted hover:text-ink block mt-2 transition-colors">
                Enter verification code
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
