import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Sparkles, Coins, HelpCircle, Shield, Mail, AlertTriangle, ArrowRight, Zap, Building } from 'lucide-react'

import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

export default function UpgradePage() {
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [balance, setBalance] = useState(null)
  const [showContactModal, setShowContactModal] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', email: '', company: '', message: '' })
  const [contactSubmitted, setContactSubmitted] = useState(false)
  
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
      toast.error(err.response?.data?.detail || 'Upgrade activation failed')
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
      toast.error(err.response?.data?.detail || 'Downgrade adjustment failed')
    } finally {
      setProcessing(false)
    }
  }

  const handleContactSubmit = (e) => {
    e.preventDefault()
    setProcessing(true)
    setTimeout(() => {
      setProcessing(false)
      setContactSubmitted(true)
      toast.success('Enterprise inquiry submitted successfully!')
    }, 1200)
  }

  const closeContactModal = () => {
    setShowContactModal(false)
    setContactForm({ name: '', email: '', company: '', message: '' })
    setContactSubmitted(false)
  }

  return (
      <div className="relative text-on-surface dark:text-inverse-on-surface max-w-container-max mx-auto px-4 py-8">
        <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 dark:border-primary-500/30 dark:bg-primary-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary dark:text-primary-fixed-dim mb-4 shadow-sm">
            <Zap className="w-3.5 h-3.5" />
            Pricing & Quotas
          </div>
          <h1 className="font-display-lg text-4xl font-extrabold mb-3 tracking-tight">
            Elevate Your Career Practice
          </h1>
          <p className="font-body-base text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            Upgrade your weekly quota to run full-length AI mock interviews, optimize resumes, and unlock specialized career trajectories.
          </p>
        </motion.div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 rounded-3xl border border-slate-100 bg-white/50 dark:bg-[#161c24]/50 dark:border-[#1c252e]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            
            {/* FREE TIER CARD */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={`relative flex flex-col rounded-3xl p-6 border ${
                !balance?.is_premium
                  ? 'border-slate-200 bg-white dark:border-[#22303f] dark:bg-[#161c24] shadow-lg'
                  : 'border-slate-100 bg-white/60 dark:border-[#1c252e] dark:bg-[#161c24]/40'
              }`}
            >
              {!balance?.is_premium && (
                <div className="absolute top-4 right-4 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-[#1c252e] dark:text-slate-400 rounded-full">
                  Current Plan
                </div>
              )}
              <div className="mb-5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Basic Tier</span>
                <h3 className="text-2xl font-black mt-1 text-slate-800 dark:text-slate-100">Free Student</h3>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-4xl font-extrabold text-slate-900 dark:text-slate-100">$0</span>
                  <span className="text-xs text-slate-400 font-semibold">/ month</span>
                </div>
              </div>

              <div className="space-y-4 flex-1 mb-8">
                <div className="text-xs font-bold text-slate-400 border-b border-slate-100 dark:border-[#1c252e] pb-2">
                  Plan Quota Details
                </div>
                {[
                  { text: '60 weekly practice credits', active: true },
                  { text: '4 weekly full-length mock interviews', active: true },
                  { text: '10 daily micro-sessions (1-question drills)', active: true },
                  { text: '10 daily coding question evaluations', active: true },
                  { text: 'Basic resume parsing & score carding', active: true },
                ].map((f, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>

              {balance?.is_premium ? (
                <button
                  onClick={handleDowngrade}
                  disabled={processing}
                  className="w-full py-3 btn-secondary-sm !rounded-xl !text-xs font-bold transition-all active:scale-95 duration-200"
                >
                  {processing ? 'Processing...' : 'Switch to Free Tier'}
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-3 bg-slate-100 text-slate-400 border border-slate-200 dark:bg-[#1c252e] dark:border-[#1c252e] rounded-xl text-xs font-bold text-center cursor-not-allowed"
                >
                  Current Active Plan
                </button>
              )}
            </motion.div>

            {/* PRO TIER CARD */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`relative flex flex-col rounded-3xl p-6 border ${
                balance?.is_premium
                  ? 'border-primary dark:border-[#3b82f6] bg-[#0d1527] dark:bg-[#0d1629] shadow-xl'
                  : 'border-slate-200 bg-white dark:border-[#1c252e] dark:bg-[#161c24] shadow-lg'
              } overflow-hidden`}
            >
              {balance?.is_premium && (
                <div className="absolute top-4 right-4 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-primary/20 text-primary dark:bg-primary-500/20 dark:text-primary-300 rounded-full animate-pulse">
                  Current Plan
                </div>
              )}
              
              {/* Premium Glow effect */}
              {balance?.is_premium && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/10 rounded-full blur-2xl -z-10" />
              )}
              
              <div className="mb-5">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary dark:text-[#60a5fa]">Professional Tier</span>
                  <Sparkles className="w-3.5 h-3.5 text-warning" />
                </div>
                <h3 className="text-2xl font-black mt-1 text-slate-800 dark:text-slate-100">Practice Pro</h3>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-4xl font-extrabold text-slate-900 dark:text-slate-100">$19</span>
                  <span className="text-xs text-slate-400 font-semibold">/ month</span>
                </div>
              </div>

              <div className="space-y-4 flex-1 mb-8">
                <div className="text-xs font-bold text-slate-400 dark:text-slate-400 border-b border-slate-100 dark:border-[#1c252e] pb-2">
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
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                    <Check className="w-4 h-4 text-primary dark:text-[#60a5fa] shrink-0 mt-0.5" />
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>

              {balance?.is_premium ? (
                <button
                  disabled
                  className="w-full py-3 bg-primary-container text-white dark:text-on-primary-container border border-primary dark:border-[#3b82f6] rounded-xl text-xs font-bold text-center cursor-not-allowed shadow-md shadow-primary-500/10"
                >
                  Pro Plan Activated
                </button>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={processing}
                  className="w-full py-3 btn-primary-sm !rounded-xl !text-xs font-bold shadow-md shadow-primary-500/10 active:scale-95 duration-200 transition-all flex items-center justify-center gap-1.5"
                >
                  {processing ? 'Upgrading...' : (
                    <>
                      <span>Upgrade to Pro</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </motion.div>

            {/* ENTERPRISE CARD */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex flex-col rounded-3xl p-6 border border-slate-200 bg-white dark:border-[#1c252e] dark:bg-[#161c24] shadow-lg"
            >
              <div className="mb-5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Institutional Tier</span>
                <h3 className="text-2xl font-black mt-1 text-slate-800 dark:text-slate-100">Enterprise</h3>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-4xl font-extrabold text-slate-900 dark:text-slate-100">Custom</span>
                  <span className="text-xs text-slate-400 font-semibold">/ institution</span>
                </div>
              </div>

              <div className="space-y-4 flex-1 mb-8">
                <div className="text-xs font-bold text-slate-400 border-b border-slate-100 dark:border-[#1c252e] pb-2">
                  Plan Details
                </div>
                {[
                  { text: 'Unlimited weekly credits & evaluations', active: true },
                  { text: 'Custom college-specific mock interview questions', active: true },
                  { text: 'Recruiter dashboard for batch evaluation', active: true },
                  { text: 'Dedicated LLM rate-limit pools', active: true },
                  { text: 'SLA priority support & custom SSO integrations', active: true },
                ].map((f, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                    <Check className="w-4 h-4 text-[#818cf8] shrink-0 mt-0.5" />
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowContactModal(true)}
                className="w-full py-3 btn-secondary-sm !rounded-xl !text-xs font-bold transition-all active:scale-95 duration-200 flex items-center justify-center gap-1.5"
              >
                <Building className="w-3.5 h-3.5" />
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
                className="relative z-10 w-full max-w-lg rounded-3xl border border-slate-150 bg-white dark:border-[#1c252e] dark:bg-[#1c252e] shadow-2xl p-6 overflow-hidden text-left"
              >
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">
                  <Building className="w-5 h-5 text-primary dark:text-[#60a5fa]" />
                  Contact Institutional Sales
                </h3>
                <p className="text-xs text-slate-400 font-semibold mb-6">
                  Set up a custom environment for your college, boot camp, or recruitment agency.
                </p>

                {contactSubmitted ? (
                  <div className="text-center py-8 space-y-4">
                    <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
                      <Check className="w-8 h-8" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">Inquiry Sent!</h4>
                    <p className="text-xs text-slate-400 font-semibold max-w-sm mx-auto">
                      Thank you for contacting sales. Our representative will reach out to you within 24 hours.
                    </p>
                    <button
                      onClick={closeContactModal}
                      className="btn-secondary-sm !px-6 !py-2 !rounded-xl !text-xs mt-4"
                    >
                      Close Window
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Your Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-xs font-semibold text-slate-700 dark:bg-[#161c24] dark:border-[#1c252e] dark:text-slate-200"
                        placeholder="John Doe"
                        value={contactForm.name}
                        onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Work Email</label>
                      <input
                        type="email"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-xs font-semibold text-slate-700 dark:bg-[#161c24] dark:border-[#1c252e] dark:text-slate-200"
                        placeholder="john@university.edu"
                        value={contactForm.email}
                        onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Institution / Company</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-xs font-semibold text-slate-700 dark:bg-[#161c24] dark:border-[#1c252e] dark:text-slate-200"
                        placeholder="Stanford University"
                        value={contactForm.company}
                        onChange={(e) => setContactForm(prev => ({ ...prev, company: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Message / Requirements</label>
                      <textarea
                        rows={4}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-xs font-semibold text-slate-700 dark:bg-[#161c24] dark:border-[#1c252e] dark:text-slate-200"
                        placeholder="Describe your student cohort size or custom interview target sectors..."
                        value={contactForm.message}
                        onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                      />
                    </div>
                    
                    <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-[#1c252e] mt-6">
                      <button
                        type="button"
                        onClick={closeContactModal}
                        className="btn-secondary-sm flex-1 !py-3 !text-xs !rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={processing}
                        className="btn-primary-sm flex-1 !py-3 !text-xs !rounded-xl shadow-md"
                      >
                        {processing ? 'Submitting...' : 'Send Inquiry'}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
  )
}
