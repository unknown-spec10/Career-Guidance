import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Coins, TrendingUp, Clock, AlertCircle, Zap, Award, X } from 'lucide-react'
import api from '../config/api'

const CreditWidget = () => {
  const [credits, setCredits] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showUsageDetails, setShowUsageDetails] = useState(false)

  useEffect(() => {
    fetchCredits()
    // Refresh every 30 seconds
    const interval = setInterval(fetchCredits, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchCredits = async () => {
    try {
      const response = await api.get('/api/credits/balance')
      setCredits(response.data)
    } catch (error) {
      console.error('Error fetching credits:', error)
      // If 401/404, user is not authenticated or doesn't have an applicant profile
      // Silently fail and hide the widget
      if (error.response?.status === 401 || error.response?.status === 404) {
        setCredits(null)
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-200 rounded-lg p-4 animate-pulse h-16 w-full">
        <div className="h-6 bg-gray-300 rounded w-24"></div>
      </div>
    )
  }

  if (!credits) return null

  const { current_credits, weekly_limit, next_refill_days, next_refill_hours, usage_today, usage_this_week, limits, costs, is_premium } = credits

  const rawCreditPercentage = weekly_limit > 0 ? (current_credits / weekly_limit) * 100 : 0
  const creditPercentage = Math.min(Math.max(rawCreditPercentage, 0), 100)
  const getColorClass = () => {
    if (creditPercentage >= 50) return 'text-green-600 border-green-300'
    if (creditPercentage >= 25) return 'text-orange-600 border-orange-300'
    return 'text-red-600 border-red-300'
  }

  const getBgClass = () => {
    if (creditPercentage >= 50) return 'bg-green-50 hover:bg-green-100'
    if (creditPercentage >= 25) return 'bg-yellow-50 hover:bg-yellow-100'
    return 'bg-red-50 hover:bg-red-100'
  }

  return (
    <>
      {/* Compact Widget (Always Visible) */}
      <motion.div
        onClick={() => setShowModal(true)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`cursor-pointer border rounded-xl p-4 transition-all shadow-sm ${getColorClass()} ${getBgClass()}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 text-primary-600">
              <Coins className="h-5 w-5" />
            </div>
            <div className="text-sm font-medium text-gray-900">Interview Credits</div>
          </div>
          <div className="text-right text-xs text-gray-500 whitespace-nowrap">
            {next_refill_days > 0 ? `${next_refill_days}d ${next_refill_hours}h` : `${next_refill_hours}h`} to refill
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-1 whitespace-nowrap text-2xl font-bold leading-none tabular-nums">
            <span>{current_credits}</span>
            <span className="text-sm font-normal text-gray-500">/ {weekly_limit}</span>
          </div>
          <div className="text-xs text-gray-500">
            {Math.round(creditPercentage)}% remaining
          </div>
        </div>

        <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200">
          <div
            className="h-1.5 rounded-full bg-current"
            style={{ width: `${creditPercentage}%` }}
          />
        </div>
      </motion.div>

      {/* Details Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="flex w-full max-w-xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Coins className="w-5 h-5 text-primary-400" />
                    Credit Details
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">Manage your interview practice quota</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-gray-900 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6 overflow-y-auto p-6">

                {/* Visual Balance */}
                <div className="text-center">
                  <div className="inline-flex items-baseline justify-center space-x-2 mb-2">
                    <span className={`text-5xl font-bold ${getColorClass().split(' ')[0]}`}>{current_credits}</span>
                    <span className="text-xl text-gray-500">/ {weekly_limit}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${creditPercentage}%` }}
                      className={`h-3 rounded-full ${creditPercentage >= 50 ? 'bg-green-500' :
                        creditPercentage >= 25 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                    />
                  </div>
                  {is_premium && (
                    <div className="inline-flex items-center space-x-1 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-xs font-medium text-yellow-500">
                      <Award className="w-3 h-3" />
                      <span>Premium Plan Active</span>
                    </div>
                  )}
                </div>

                {/* Refill Info */}
                <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between border border-blue-200">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Clock className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Refills in</div>
                      <div className="text-xs text-gray-600">Weekly quota reset</div>
                    </div>
                  </div>
                  <div className="text-lg font-mono font-bold text-blue-700">
                    {next_refill_days > 0 ? `${next_refill_days}d ${next_refill_hours}h` : `${next_refill_hours}h`}
                  </div>
                </div>

                {/* Costs Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                    <div className="text-xs text-gray-600 mb-1">Full Interview</div>
                    <div className="text-xl font-bold text-gray-900">{costs.full_interview}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Credits</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                    <div className="text-xs text-gray-600 mb-1">Micro Session</div>
                    <div className="text-xl font-bold text-gray-900">{costs.micro_session}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Credit</div>
                  </div>
                </div>

                {/* Usage Details Toggle */}
                <div>
                  <button
                    onClick={() => setShowUsageDetails(!showUsageDetails)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 transition-colors text-sm text-gray-900"
                  >
                    <span className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Usage History
                    </span>
                    <span className="text-xs text-gray-500">{showUsageDetails ? 'Hide' : 'Show'}</span>
                  </button>

                  <AnimatePresence>
                    {showUsageDetails && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-2 space-y-2 text-sm text-gray-600 px-3">
                          <div className="flex justify-between py-1 border-b border-gray-300">
                            <span>Credits Used (Today)</span>
                            <span className="text-gray-900">{usage_today.credits}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-gray-300">
                            <span>Credits Used (Week)</span>
                            <span className="text-gray-900">{usage_this_week.credits}</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span>Interviews Taken</span>
                            <span className="text-gray-900">{usage_this_week.full_interviews}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start space-x-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-indigo-700" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-indigo-900">Boost Your Recommendations</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Taking more interviews helps our AI understand your skills better, leading to more accurate job matches.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

export default CreditWidget
