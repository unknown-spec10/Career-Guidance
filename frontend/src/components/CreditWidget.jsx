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
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-dark-800 rounded-lg p-4 animate-pulse h-16 w-full">
        <div className="h-6 bg-dark-700 rounded w-24"></div>
      </div>
    )
  }

  if (!credits) return null

  const { current_credits, weekly_limit, next_refill_days, next_refill_hours, usage_today, usage_this_week, limits, costs, is_premium } = credits

  const creditPercentage = (current_credits / weekly_limit) * 100
  const getColorClass = () => {
    if (creditPercentage >= 50) return 'text-green-400 border-green-500/30'
    if (creditPercentage >= 25) return 'text-yellow-400 border-yellow-500/30'
    return 'text-red-400 border-red-500/30'
  }

  const getBgClass = () => {
    if (creditPercentage >= 50) return 'bg-green-900/10 hover:bg-green-900/20'
    if (creditPercentage >= 25) return 'bg-yellow-900/10 hover:bg-yellow-900/20'
    return 'bg-red-900/10 hover:bg-red-900/20'
  }

  return (
    <>
      {/* Compact Widget (Always Visible) */}
      <motion.div
        onClick={() => setShowModal(true)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`cursor-pointer border rounded-xl p-4 flex items-center justify-between transition-all ${getColorClass()} ${getBgClass()}`}
      >
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg bg-dark-900/50`}>
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-300">Interview Credits</div>
            <div className="text-2xl font-bold flex items-baseline space-x-1">
              <span>{current_credits}</span>
              <span className="text-sm text-gray-500 font-normal">/ {weekly_limit}</span>
            </div>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end">
          <div className="text-xs text-gray-400 mb-1">
            {next_refill_days > 0 ? `${next_refill_days}d ${next_refill_hours}h` : `${next_refill_hours}h`} to refill
          </div>
          <div className="w-24 bg-dark-900/50 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-current"
              style={{ width: `${creditPercentage}%` }}
            />
          </div>
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
              className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-dark-700 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Coins className="w-5 h-5 text-primary-400" />
                    Credit Details
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">Manage your interview practice quota</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-dark-700 rounded-lg text-gray-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">

                {/* Visual Balance */}
                <div className="text-center">
                  <div className="inline-flex items-baseline justify-center space-x-2 mb-2">
                    <span className={`text-5xl font-bold ${getColorClass().split(' ')[0]}`}>{current_credits}</span>
                    <span className="text-xl text-gray-500">/ {weekly_limit}</span>
                  </div>
                  <div className="w-full bg-dark-900 rounded-full h-3 mb-2">
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
                <div className="bg-dark-900/50 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-dark-800 rounded-lg">
                      <Clock className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Refills in</div>
                      <div className="text-xs text-gray-400">Weekly quota reset</div>
                    </div>
                  </div>
                  <div className="text-lg font-mono font-bold text-blue-300">
                    {next_refill_days > 0 ? `${next_refill_days}d ${next_refill_hours}h` : `${next_refill_hours}h`}
                  </div>
                </div>

                {/* Costs Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-dark-900/30 border border-dark-700 rounded-xl p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">Full Interview</div>
                    <div className="text-xl font-bold text-white">{costs.full_interview}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Credits</div>
                  </div>
                  <div className="bg-dark-900/30 border border-dark-700 rounded-xl p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">Micro Session</div>
                    <div className="text-xl font-bold text-white">{costs.micro_session}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Credit</div>
                  </div>
                </div>

                {/* Usage Details Toggle */}
                <div>
                  <button
                    onClick={() => setShowUsageDetails(!showUsageDetails)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-dark-700/50 transition-colors text-sm text-gray-300"
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
                        <div className="pt-2 space-y-2 text-sm text-gray-400 px-3">
                          <div className="flex justify-between py-1 border-b border-dark-700/50">
                            <span>Credits Used (Today)</span>
                            <span className="text-white">{usage_today.credits}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-dark-700/50">
                            <span>Credits Used (Week)</span>
                            <span className="text-white">{usage_this_week.credits}</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span>Interviews Taken</span>
                            <span className="text-white">{usage_this_week.full_interviews}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="mt-4 p-3 bg-indigo-900/20 border border-indigo-500/30 rounded-xl flex items-start space-x-3">
                  <div className="p-2 bg-indigo-900/40 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-indigo-300">Boost Your Recommendations</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      Taking more interviews helps our AI understand your skills better, leading to more accurate job and college matches.
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
