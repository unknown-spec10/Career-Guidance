import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import Spinner from '../components/Spinner'
import { sanitizeEmail } from '../utils/sanitize'
import { getApiError } from '../utils/apiError'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const sanitizedEmail = sanitizeEmail(email)
      if (!sanitizedEmail) {
        toast.error('Please enter a valid email address')
        setLoading(false)
        return
      }

      await api.post('/api/auth/forgot-password', { email: sanitizedEmail })
      
      setSuccess(true)
      toast.success('Password reset code sent! Check your email.')
      
      // Navigate to reset password page after 2 seconds
      setTimeout(() => {
        navigate('/reset-password', { state: { email: sanitizedEmail } })
      }, 2000)
    } catch (err) {
      toast.error(getApiError(err, 'Failed to send reset code'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="surface-card overflow-hidden">
          <div className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="w-16 h-16 rounded-card border border-hairline bg-surface-sunken flex items-center justify-center mx-auto mb-4"
              >
                <Mail className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </motion.div>
              <h1 className="app-page-title mb-2">
                Forgot Password?
              </h1>
              <p className="text-body text-ink-muted">
                Enter your email and we'll send you a reset code
              </p>
            </div>

            {!success ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Input */}
                <div>
                  <label htmlFor="email" className="app-label mb-2 block">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-subtle" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="app-input pl-10"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className="app-btn-primary w-full"
                >
                  {loading ? <Spinner className="h-5 w-5" /> : <Mail className="h-5 w-5 shrink-0" />}
                  <span>Send Reset Code</span>
                </button>

                {/* Back to Login */}
                <div className="text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-caption font-semibold text-ink-muted hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Login
                  </Link>
                </div>
              </form>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <div className="w-16 h-16 bg-success/10 border border-success/20 rounded-card flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-success" />
                </div>
                <h3 className="font-display text-title font-bold text-ink mb-2">
                  Check Your Email!
                </h3>
                <p className="text-body text-ink-muted mb-6">
                  We've sent a 6-digit reset code to<br />
                  <span className="text-primary-600 dark:text-primary-400 font-semibold">{email}</span>
                </p>
                <p className="text-caption text-ink-subtle">
                  Redirecting to password reset page...
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
