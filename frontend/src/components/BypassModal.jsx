import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  X,
  Zap,
  Coins,
  Loader2
} from 'lucide-react'

// Cooldown countdown shared by the header refresh button and the bypass modal.
export const CooldownTimer = React.memo(({ expiresAt, onCooldownEnd, className }) => {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft('')
      return undefined
    }

    const calculateTimeLeft = () => {
      const difference = +new Date(expiresAt) - +new Date()
      if (difference <= 0) {
        setTimeLeft('')
        if (onCooldownEnd) {
          onCooldownEnd()
        }
        return
      }

      const hours = Math.floor(difference / (1000 * 60 * 60))
      const minutes = Math.floor((difference / 1000 / 60) % 60)
      const seconds = Math.floor((difference / 1000) % 60)

      setTimeLeft(
        `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
      )
    }

    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, onCooldownEnd])

  if (!timeLeft) return <span className={className}>calculating...</span>

  return (
    <span className={className}>
      {timeLeft}
    </span>
  )
})
CooldownTimer.displayName = 'CooldownTimer'

// Cooldown bypass confirmation modal. Controlled entirely via props.
export default function BypassModal({
  open,
  onClose,
  cooldownExpiresAt,
  onCooldownEnd,
  creditsBalance,
  bypassCost,
  recalcLoading,
  onConfirmBypass
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-left">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md rounded-panel border border-hairline bg-surface-overlay shadow-soft-xl p-6 relative overflow-hidden"
          >
            {/* Gold gradient top glow */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500" />

            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-card p-2.5 bg-warning/10 text-warning border border-warning/20 shadow-soft-xs">
                  <Zap className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-display text-title text-ink">Instant AI Refresh</h3>
                  <p className="text-caption text-ink-muted mt-0.5">Bypass active recommendation cooldown</p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close refresh dialog"
 className="p-1.5 text-ink-subtle hover:text-ink hov-surface rounded-card transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 my-4">
              <div className="p-4 bg-surface-sunken border border-hairline rounded-card">
                <p className="text-caption text-ink-muted leading-relaxed">
                  AI recommendations utilize complex multi-tiered matching pipelines. Refreshes are <strong className="text-ink font-bold">free once every 24 hours</strong>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-sunken border border-hairline rounded-card p-3 flex flex-col justify-between">
                  <span className="text-overline uppercase text-ink-subtle">Cooldown Left</span>
                  <CooldownTimer
                    expiresAt={cooldownExpiresAt}
                    onCooldownEnd={onCooldownEnd}
                    className="text-base font-extrabold text-warning mt-1 font-mono"
                  />
                </div>
                <div className="bg-surface-sunken border border-hairline rounded-card p-3 flex flex-col justify-between">
                  <span className="text-overline uppercase text-ink-subtle">Your Balance</span>
                  <span className="text-base font-extrabold text-ink mt-1">
                    {creditsBalance !== null ? `${creditsBalance} Credits` : 'Loading...'}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-warning/10 border border-warning/20 rounded-card flex items-center justify-between shadow-soft-xs">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 shrink-0 text-warning" />
                  <div>
                    <div className="text-caption font-bold text-ink">Bypass Refresh Cost</div>
                    <div className="text-[10px] text-ink-subtle font-semibold">Instant recomputation</div>
                  </div>
                </div>
                <div className="text-title font-bold text-warning">
                  -{bypassCost} Credits
                </div>
              </div>

              {creditsBalance !== null && creditsBalance < bypassCost && (
                <div className="p-3 bg-error/10 border border-error/20 rounded-card flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-error mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-caption font-bold text-error">Insufficient Credits</h4>
                    <p className="text-[11px] text-ink-muted mt-0.5 leading-normal">
                      You need at least {bypassCost} credits to bypass this cooldown. Please wait for the cooldown or weekly refill to refresh.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                onClick={onClose}
                className="app-btn-secondary flex-1"
              >
                Wait for Cooldown
              </button>
              <button
                disabled={recalcLoading || (creditsBalance !== null && creditsBalance < bypassCost)}
                onClick={onConfirmBypass}
                aria-busy={recalcLoading}
                className={`app-btn-primary flex-1 border text-sm ${
                  recalcLoading || (creditsBalance !== null && creditsBalance < bypassCost)
                    ? 'bg-surface-sunken border-hairline text-ink-subtle cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-600 hover:via-orange-600 hover:to-yellow-600 border-amber-400 text-white shadow-amber-500/10'
                }`}
              >
                {recalcLoading
                  ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  : <Coins className="h-4 w-4 shrink-0" />}
                <span>Spend {bypassCost} Credits</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
