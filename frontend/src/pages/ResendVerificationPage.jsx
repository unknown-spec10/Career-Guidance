import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../config/api'

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
      setMessage(err.response?.data?.detail || 'Failed to send verification email')
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Mail className="w-16 h-16 text-primary-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Resend Verification</h1>
          <p className="text-gray-400">Enter your email to receive a new verification code</p>
        </div>

        <div className="card">
          {status === 'success' ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-green-400">Code Sent!</h3>
              <p className="text-gray-400 mb-6">{message}</p>
              <p className="text-sm text-gray-500 mb-6">
                Please check your inbox and spam folder for the verification code.
              </p>
              <Link to="/login" className="btn-primary w-full block">
                Go to Login
              </Link>
            </div>
          ) : (
            <>
              {status === 'error' && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span className="text-red-400 text-sm">{message}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      required
                      className="input pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your-email@example.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="btn-primary w-full"
                >
                  {status === 'loading' ? 'Sending...' : 'Send Verification Code'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link 
                  to="/login" 
                  className="text-sm text-gray-400 hover:text-white flex items-center justify-center space-x-1"
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
