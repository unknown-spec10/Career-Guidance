import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'
import api from '../config/api'

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
      setMessage(err.response?.data?.detail || 'Verification failed')
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card max-w-md w-full text-center"
      >
        {status === 'verifying' && (
          <>
            <Loader2 className="w-16 h-16 text-primary-400 mx-auto mb-4 animate-spin" />
            <h2 className="text-2xl font-bold mb-2">Verifying Email</h2>
            <p className="text-gray-400">Please wait while we verify your email address...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-green-400">Email Verified!</h2>
            <p className="text-gray-400 mb-4">{message}</p>
            <p className="text-sm text-gray-500">Redirecting to login...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-red-400">Verification Failed</h2>
            <p className="text-gray-400 mb-6">{message}</p>
            <div className="space-y-3">
              <Link to="/login" className="btn-primary w-full block">
                Go to Login
              </Link>
              <button
                onClick={() => navigate('/resend-verification')}
                className="btn-secondary w-full flex items-center justify-center space-x-2"
              >
                <Mail className="w-4 h-4" />
                <span>Resend Verification Code</span>
              </button>
              <Link to="/verify-code" className="text-sm text-gray-400 hover:text-white block mt-2">
                Enter verification code
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
