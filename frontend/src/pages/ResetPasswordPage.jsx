import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, KeyRound, AlertTriangle, CheckCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import Spinner from '../components/Spinner'
import { getApiError } from '../utils/apiError'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const emailFromState = location.state?.email || ''

  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation
    if (code.length !== 6) {
      toast.error('Please enter a valid 6-digit code')
      return
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      await api.post('/api/auth/reset-password', {
        code: code.trim(),
        new_password: newPassword
      })

      setSuccess(true)
      toast.success('Password reset successful!')

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login', { state: { message: 'Password reset successful! Please login with your new password.' } })
      }, 2000)
    } catch (err) {
      toast.error(getApiError(err, 'Failed to reset password'))
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (!emailFromState) {
      toast.error('Email not found. Please request a new reset code.')
      navigate('/forgot-password')
      return
    }

    try {
      await api.post('/api/auth/forgot-password', { email: emailFromState })
      toast.success('New reset code sent! Check your email.')
    } catch (err) {
      toast.error('Failed to resend code')
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
                <KeyRound className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </motion.div>
              <h1 className="app-page-title mb-2">
                Reset Password
              </h1>
              <p className="text-body text-ink-muted">
                {emailFromState ? (
                  <>
                    Enter the code sent to{' '}
                    <span className="text-primary-600 dark:text-primary-400 font-semibold">{emailFromState}</span>{' '}
                    and choose a new password
                  </>
                ) : (
                  'Enter the code from your email and choose a new password'
                )}
              </p>
            </div>

            {!success ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Reset Code Input */}
                <div>
                  <label htmlFor="code" className="app-label mb-2 block">
                    6-Digit Reset Code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-subtle" />
                    <input
                      id="code"
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      maxLength={6}
                      required
                      className="app-input pl-10 text-center text-2xl tracking-widest font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="text-caption font-semibold text-primary-600 dark:text-primary-400 hover:underline mt-2"
                  >
                    Didn't receive the code? Resend
                  </button>
                </div>

                {/* New Password Input */}
                <div>
                  <label htmlFor="newPassword" className="app-label mb-2 block">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-subtle" />
                    <input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      className="app-input pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-ink-subtle hover:text-ink focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-caption text-ink-subtle mt-1">
                    Must be at least 8 characters
                  </p>
                </div>

                {/* Confirm Password Input */}
                <div>
                  <label htmlFor="confirmPassword" className="app-label mb-2 block">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-subtle" />
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      className="app-input pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-ink-subtle hover:text-ink focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className="app-btn-primary w-full"
                >
                  {loading ? <Spinner className="h-5 w-5" /> : <KeyRound className="h-5 w-5 shrink-0" />}
                  <span>Reset Password</span>
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
                  Password Reset Successful!
                </h3>
                <p className="text-body text-ink-muted mb-6">
                  Your password has been updated successfully.
                </p>
                <p className="text-caption text-ink-subtle">
                  Redirecting to login page...
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
