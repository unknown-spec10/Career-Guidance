import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Coins, TrendingUp, Clock, AlertCircle, Zap, Award, X } from 'lucide-react'
import api from '../config/api'

const CreditWidget = ({ compact = false }) => {
  const [credits, setCredits] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showUsageDetails, setShowUsageDetails] = useState(false)

  const closeModal = () => {
    setShowModal(false)
    setShowUsageDetails(false)
  }

  useEffect(() => {
    if (!showModal) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showModal])

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
      <div className={`bg-gray-200 rounded-lg p-4 animate-pulse ${compact ? 'h-14 w-full' : 'h-16 w-full'}`}>
        <div className="h-6 bg-gray-300 rounded w-24"></div>
      </div>
    )
  }

  if (!credits) return null

  const { current_credits, weekly_limit, next_refill_days, next_refill_hours, usage_today, usage_this_week, limits, costs, is_premium } = credits

  const rawCreditPercentage = weekly_limit > 0 ? (current_credits / weekly_limit) * 100 : 0
  const creditPercentage = Math.min(Math.max(rawCreditPercentage, 0), 100)
  const isHigh = creditPercentage >= 50
  const isMedium = creditPercentage >= 25
  const textThemeColor = isHigh ? 'text-emerald-600' : isMedium ? 'text-amber-600' : 'text-rose-600'
  const borderThemeColor = isHigh ? 'border-emerald-100' : isMedium ? 'border-amber-100' : 'border-rose-100'
  const bgThemeColor = isHigh ? 'bg-emerald-50/60' : isMedium ? 'bg-amber-50/60' : 'bg-rose-50/60'
  const fillGradient = isHigh ? 'from-emerald-400 to-teal-500' : isMedium ? 'from-amber-400 to-orange-500' : 'from-rose-400 to-red-500'

  return (
    <>
      {/* Compact Widget (Always Visible) */}
      <motion.div
        onClick={() => setShowModal(true)}
        whileHover={{ scale: 1.015, y: -1 }}
        whileTap={{ scale: 0.995 }}
        className="cursor-pointer border border-slate-100 bg-white/90 backdrop-blur-sm rounded-2xl p-4 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_15px_35px_rgba(15,23,42,0.05)] hover:border-slate-200 flex flex-col justify-between w-full h-full min-h-[110px]"
      >
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="min-w-0 flex items-center gap-3">
              <div className={`rounded-xl p-2 ${isHigh ? 'bg-emerald-50 text-emerald-600' : isMedium ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">Credits Balance</div>
                <div className="text-[10px] text-slate-400 font-medium">Tap for details</div>
              </div>
            </div>
            <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${bgThemeColor} ${textThemeColor} ${borderThemeColor}`}>
              {next_refill_days > 0 ? `${next_refill_days}d ${next_refill_hours}h` : `${next_refill_hours}h`} left
            </div>
          </div>

          <div className="flex items-baseline justify-between mt-3">
            <div className="flex items-baseline gap-1 text-2xl font-extrabold text-slate-900 tabular-nums">
              <span>{current_credits}</span>
              <span className="text-xs font-semibold text-slate-400">/ {weekly_limit}</span>
            </div>
            <div className={`text-xs font-bold ${textThemeColor}`}>
              {Math.round(creditPercentage)}% remaining
            </div>
          </div>
        </div>

        <div className="h-2 w-full rounded-full bg-slate-100 mt-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${creditPercentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full rounded-full bg-gradient-to-r ${fillGradient}`}
          />
        </div>
      </motion.div>

      {/* Details Modal */}
      <AnimatePresence>
        {showModal && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={closeModal}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              className="flex w-full max-w-md max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white/95 backdrop-blur shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <Coins className="w-5 h-5 text-primary-500" />
                    Credit Account
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Manage your practice and learning path quota</p>
                </div>
                <button onClick={closeModal} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6 overflow-y-auto p-6">
                {/* Visual Balance */}
                <div className="text-center">
                  <div className="inline-flex items-baseline justify-center space-x-1.5 mb-2">
                    <span className={`text-5xl font-black tracking-tight ${textThemeColor}`}>{current_credits}</span>
                    <span className="text-lg font-bold text-slate-400">/ {weekly_limit}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 mb-4">Available Credits</p>
                  
                  <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${creditPercentage}%` }}
                      className={`h-full rounded-full bg-gradient-to-r ${fillGradient}`}
                    />
                  </div>
                  {is_premium && (
                    <div className="inline-flex items-center space-x-1 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-amber-700 mt-1">
                      <Award className="w-3.5 h-3.5" />
                      <span>Premium Active</span>
                    </div>
                  )}
                </div>

                {/* Refill Info */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white border border-slate-100 rounded-xl">
                      <Clock className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-700">Refill Schedule</div>
                      <div className="text-[10px] text-slate-400 font-semibold">Weekly quota reset</div>
                    </div>
                  </div>
                  <div className="text-base font-bold font-mono text-slate-800">
                    {next_refill_days > 0 ? `${next_refill_days}d ${next_refill_hours}h` : `${next_refill_hours}h`}
                  </div>
                </div>

                {/* Costs Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mock Practice</div>
                    <div className="text-lg font-extrabold text-slate-800">1 Credit / Q</div>
                    <div className="text-[9px] font-semibold text-slate-400 tracking-wide mt-1">Deducted per response</div>
                  </div>
                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Learning Path</div>
                    <div className="text-lg font-extrabold text-slate-800">2 Credits</div>
                    <div className="text-[9px] font-semibold text-slate-400 tracking-wide mt-1">Deducted per roadmap</div>
                  </div>
                </div>

                {/* Usage Details Toggle */}
                <div className="border-t border-slate-100 pt-4">
                  <button
                    onClick={() => setShowUsageDetails(!showUsageDetails)}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors text-xs font-bold text-slate-700"
                  >
                    <span className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-slate-400" />
                      Usage Statistics
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">{showUsageDetails ? 'Hide' : 'Show'}</span>
                  </button>

                  <AnimatePresence>
                    {showUsageDetails && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-2 space-y-2 text-xs text-slate-600 px-2">
                          <div className="flex justify-between py-2 border-b border-slate-100 font-medium">
                            <span>Credits Used (Today)</span>
                            <span className="font-bold text-slate-800">{usage_today.credits}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-slate-100 font-medium">
                            <span>Credits Used (Week)</span>
                            <span className="font-bold text-slate-800">{usage_this_week.credits}</span>
                          </div>
                          <div className="flex justify-between py-2 font-medium">
                            <span>Practice Sessions (Week)</span>
                            <span className="font-bold text-slate-800">{usage_this_week.full_interviews}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-start space-x-3">
                  <div className="p-2 bg-white border border-indigo-100 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-indigo-600 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-indigo-900">Accelerate Your Match Score</h4>
                    <p className="text-[10px] text-slate-500 leading-normal mt-1">
                      Practicing mock sessions helps our AI mapping engine understand your strengths, improving your job compatibility score.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>
    </>
  )
}

export default CreditWidget

