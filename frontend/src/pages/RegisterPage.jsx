import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, User, Phone, Briefcase, GraduationCap, UserCircle, AlertTriangle, CheckCircle, KeyRound } from 'lucide-react'
import api from '../config/api'

export default function RegisterPage() {
  const navigate = useNavigate()
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
      await api.post('/api/auth/resend-code', { email: formData.email })
      alert('Verification code resent! Check your email.')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Create Account</h1>
          <p className="text-gray-400">Join our career guidance platform</p>
        </div>

        <div className="card">
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-medium">Registration Successful!</span>
              </div>
              <p className="text-sm text-gray-300 mb-3">
                We've sent a 6-digit verification code to <span className="font-medium text-white">{formData.email}</span>.
                Please enter it below to verify your account.
              </p>
              
              <form onSubmit={handleVerifyCode} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Verification Code</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      required
                      maxLength="6"
                      placeholder="Enter 6-digit code"
                      className="input pl-10"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    disabled={verifyLoading || verificationCode.length !== 6}
                    className="btn-primary flex-1"
                  >
                    {verifyLoading ? 'Verifying...' : 'Verify Email'}
                  </button>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={loading}
                    className="px-4 py-2 border border-dark-600 rounded-lg hover:bg-dark-800 transition-colors text-sm"
                  >
                    Resend Code
                  </button>
                </div>
              </form>
              
              <p className="text-xs text-gray-400 mt-3">
                Didn't receive the email? Check your spam folder.
              </p>
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  required
                  className="input pl-10"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  required
                  className="input pl-10"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  required
                  minLength="8"
                  className="input pl-10"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Phone (Optional)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  className="input pl-10"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">I am a...</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'student', icon: UserCircle, label: 'Student' },
                  { value: 'employer', icon: Briefcase, label: 'Employer' },
                  { value: 'college', icon: GraduationCap, label: 'College' }
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData({ ...formData, role: value })}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      formData.role === value
                        ? 'border-primary-500 bg-primary-900/20'
                        : 'border-dark-700 hover:border-dark-600'
                    }`}
                  >
                    <Icon className={`w-6 h-6 mx-auto mb-2 ${formData.role === value ? 'text-primary-400' : 'text-gray-400'}`} />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
          )}

          {!success && (
            <div className="mt-6 text-center text-sm text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-400 hover:text-primary-300">
                Login here
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
