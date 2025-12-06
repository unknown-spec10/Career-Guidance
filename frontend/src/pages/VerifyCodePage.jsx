import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, AlertTriangle, ArrowLeft, Mail, KeyRound } from 'lucide-react'
import api from '../config/api'

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
      setMessage(err.response?.data?.detail || 'Invalid or expired code')
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
      setMessage(err.response?.data?.detail || 'Failed to resend code')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <KeyRound className="w-16 h-16 text-primary-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Verify Your Email</h1>
          <p className="text-gray-400">Enter the verification code sent to your email</p>
        </div>

        <div className="card">
          {status === 'error' && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 text-sm">{message}</span>
            </div>
          )}
          {status === 'success' && (
            <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400 text-sm">{message}</span>
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

            <div>
              <label className="block text-sm font-medium mb-2">Verification Code</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={12}
                  className="input pl-10 tracking-widest"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
                  placeholder="Enter 6-digit code"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="btn-primary w-full"
            >
              {status === 'loading' ? 'Verifying...' : 'Verify Code'}
            </button>
          </form>

          <div className="mt-6 space-y-3">
            <button
              onClick={handleResend}
              disabled={status === 'loading' || !email}
              className="btn-secondary w-full"
            >
              Resend Code
            </button>

            <Link 
              to="/login" 
              className="text-sm text-gray-400 hover:text-white flex items-center justify-center space-x-1"
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
