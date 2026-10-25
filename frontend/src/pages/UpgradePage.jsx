import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Sparkles, Mail, ArrowRight, Zap, Building, Loader2 } from 'lucide-react'

import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import { getApiError } from '../utils/apiError'

export default function UpgradePage() {
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [balance, setBalance] = useState(null)
  const [showContactModal, setShowContactModal] = useState(false)

  const toast = useToast()

  const fetchBalance = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/credits/balance')
      setBalance(res.data)
    } catch (err) {
      toast.error('Failed to load credit account details')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBalance()
  }, [])

  const handleUpgrade = async () => {
    try {
      setProcessing(true)
      const res = await api.post('/api/credits/upgrade')
      setBalance(res.data)
      toast.success('Successfully upgraded to Pro Plan! Weekly credits refilled to 300.')
    } catch (err) {
      toast.error(getApiError(err, 'Upgrade activation failed'))
    } finally {
      setProcessing(false)
    }
  }

  const handleDowngrade = async () => {
    try {
      setProcessing(true)
      const res = await api.post('/api/credits/downgrade')
      setBalance(res.data)
      toast.success('Downgraded back to Free student tier.')
    } catch (err) {
      toast.error(getApiError(err, 'Downgrade adjustment failed'))
    } finally {
      setProcessing(false)
    }
  }

  const closeContactModal = () => {
    setShowContactModal(false)
  }

  return (
      <div className="relative text-ink font-body max-w-container-max mx-auto px-4 py-8">
        <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <div className="inline-flex items-center gap-2 rounded-pill border border-primary-100 bg-primary-50 dark:border-primary-500/30 dark:bg-primary-500/10 px-3 py-1 text-overline uppercase text-primary mb-4 shadow-soft-xs">
            <Zap className="w-3.5 h-3.5" />
            Pricing & Quotas
          </div>
          <h1 className="app-page-title mb-3">
            Elevate Your Career Practice
          </h1>
          <p className="app-page-subtitle">
            Upgrade your weekly quota to run full-length AI mock interviews, optimize resumes, and unlock specialized career trajectories.
          </p>
        </motion.div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 rounded-panel border border-hairline bg-surface-sunken" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            
            {/* FREE TIER CARD */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={`relative flex flex-col surface-card p-6 ${!balance?.is_premium ? '' : 'opacity-75'}`}
            >
              {!balance?.is_premium && (
                <div className="absolute top-4 right-4 px-2 py-0.5 text-overline uppercase bg-surface-sunken text-ink-muted rounded-pill">
                  Current Plan
                </div>
              )}
              <div className="mb-5">
                <span className="eyebrow">Basic Tier</span>
                <h3 className="text-title-lg text-ink mt-1">Free Student</h3>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-display-lg text-ink">$0</span>
                  <span className="text-caption text-ink-subtle font-semibold">/ month</span>
                </div>
              </div>

              <div className="space-y-4 flex-1 mb-8">
                <div className="eyebrow border-b border-hairline pb-2">
                  Plan Quota Details
                </div>
                {[
                  { text: '60 weekly practice credits', active: true },
                  { text: '4 weekly full-length mock interviews', active: true },
                  { text: '10 daily micro-sessions (1-question drills)', active: true },
                  { text: '10 daily coding question evaluations', active: true },
                  { text: 'Basic resume parsing & score carding', active: true },
                ].map((f, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-caption text-ink-muted font-medium">
                    <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>

              {balance?.is_premium ? (
                <button
                  onClick={handleDowngrade}
                  disabled={processing}
                  aria-busy={processing}
                  className="app-btn-secondary app-btn-sm inline-flex w-full items-center justify-center gap-2 active:scale-95 duration-200"
                >
                  {processing ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <ArrowRight className="h-4 w-4 shrink-0" />}
                  <span>Switch to Free Tier</span>
                </button>
              ) : (
                <button
                  disabled
                  className="app-btn-secondary app-btn-sm inline-flex w-full items-center justify-center gap-2 cursor-not-allowed"
                >
                  <span>Current Active Plan</span>
                </button>
              )}
            </motion.div>

            {/* PRO TIER CARD — premium dark price card (intentional white text) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`relative flex flex-col rounded-panel p-6 border bg-primary-800 text-white shadow-soft-lg overflow-hidden ${
                balance?.is_premium ? 'border-primary-400' : 'border-primary-700'
              }`}
            >
              {balance?.is_premium && (
                <div className="absolute top-4 right-4 px-2 py-0.5 text-overline uppercase bg-primary-700 text-white rounded-pill animate-pulse">
                  Current Plan
                </div>
              )}
              
              {/* Premium Glow effect */}
              {balance?.is_premium && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/10 rounded-pill blur-2xl -z-10" />
              )}
              
              <div className="mb-5">
                <div className="flex items-center gap-1">
                  <span className="text-overline uppercase text-primary-200">Professional Tier</span>
                  <Sparkles className="w-3.5 h-3.5 text-warning" />
                </div>
                <h3 className="text-title-lg mt-1">Practice Pro</h3>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-display-lg">$19</span>
                  <span className="text-caption text-white/60 font-semibold">/ month</span>
                </div>
              </div>

              <div className="space-y-4 flex-1 mb-8">
                <div className="text-overline uppercase text-white/60 border-b border-white/15 pb-2">
                  Plan Quota Details
                </div>
                {[
                  { text: '300 weekly practice credits (5x Increase)', active: true },
                  { text: '20 weekly full-length mock interviews', active: true },
                  { text: '50 daily micro-sessions (Deeper drills)', active: true },
                  { text: '50 daily coding evaluations', active: true },
                  { text: 'Priority LLM processing & advanced recommendations', active: true },
                  { text: 'Unlock custom feedback models & timelines', active: true },
                ].map((f, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-caption text-white/80 font-medium">
                    <Check className="w-4 h-4 text-primary-300 shrink-0 mt-0.5" />
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>

              {balance?.is_premium ? (
                <button
                  disabled
                  className="app-btn-secondary app-btn-sm inline-flex w-full items-center justify-center gap-2 cursor-not-allowed"
                >
                  <span>Pro Plan Activated</span>
                </button>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={processing}
                  aria-busy={processing}
                  className="app-btn-primary app-btn-sm inline-flex w-full items-center justify-center gap-2 shadow-soft-sm active:scale-95 duration-200"
                >
                  {processing ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <ArrowRight className="h-4 w-4 shrink-0" />}
                  <span>Upgrade to Pro</span>
                </button>
              )}
            </motion.div>

            {/* ENTERPRISE CARD */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex flex-col surface-card p-6"
            >
              <div className="mb-5">
                <span className="eyebrow">Institutional Tier</span>
                <h3 className="text-title-lg text-ink mt-1">Enterprise</h3>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-display-lg text-ink">Custom</span>
                  <span className="text-caption text-ink-subtle font-semibold">/ institution</span>
                </div>
              </div>

              <div className="space-y-4 flex-1 mb-8">
                <div className="eyebrow border-b border-hairline pb-2">
                  Plan Details
                </div>
                {[
                  { text: 'Unlimited weekly credits & evaluations', active: true },
                  { text: 'Custom college-specific mock interview questions', active: true },
                  { text: 'Recruiter dashboard for batch evaluation', active: true },
                  { text: 'Dedicated LLM rate-limit pools', active: true },
                  { text: 'SLA priority support & custom SSO integrations', active: true },
                ].map((f, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-caption text-ink-muted font-medium">
                    <Check className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowContactModal(true)}
                className="app-btn-secondary app-btn-sm inline-flex w-full items-center justify-center gap-2 active:scale-95 duration-200"
              >
                <Building className="h-4 w-4 shrink-0" />
                <span>Contact Sales</span>
              </button>
            </motion.div>

          </div>
        )}

        {/* Enterprise Contact Modal */}
        <AnimatePresence>
          {showContactModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
              <div className="absolute inset-0 bg-black/50" onClick={closeContactModal} />
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                className="relative z-10 w-full max-w-lg rounded-panel border border-hairline bg-surface-overlay shadow-soft-xl p-6 overflow-hidden text-left"
              >
                <h3 className="text-title-lg text-ink flex items-center gap-2 mb-1">
                  <Building className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  Contact Institutional Sales
                </h3>
                <p className="text-caption text-ink-muted font-semibold mb-6">
                  Set up a custom environment for your college, boot camp, or recruitment agency.
                </p>

                {/* Self-serve enterprise signup is not available yet — contact us directly. */}
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-300 rounded-pill flex items-center justify-center mx-auto shadow-soft-xs">
                    <Building className="w-8 h-8" />
                  </div>
                  <h4 className="text-title text-ink">Enterprise plans are handled manually</h4>
                  <p className="text-caption text-ink-muted font-semibold max-w-sm mx-auto">
                    There is no self-serve enterprise checkout yet. Email us with your institution
                    name and cohort size and we will set up a custom environment for you.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <a
                      href="mailto:support@careersync.com?subject=Enterprise%20plan%20inquiry"
                      className="app-btn-primary app-btn-sm inline-flex items-center justify-center gap-2 shadow-soft-sm"
                    >
                      <Mail className="h-4 w-4 shrink-0" />
                      <span>Email sales</span>
                    </a>
                    <button
                      type="button"
                      onClick={closeContactModal}
                      className="app-btn-secondary app-btn-sm"
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
  )
}
