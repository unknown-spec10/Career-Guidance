import React from 'react'

const TONES = {
  primary: 'bg-primary-500/10 text-primary',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
}

export default function AdminStatCard({ label, value, hint, icon: Icon, tone = 'primary' }) {
  return (
    <div className="surface-card flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-overline uppercase text-ink-subtle">
            {label}
          </p>
          <p className="mt-2 font-display text-3xl font-bold leading-none text-ink">
            {value}
          </p>
        </div>
        {Icon && (
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-card ${TONES[tone] || TONES.primary}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
      </div>
      {hint && (
        <p className="mt-3 text-caption text-ink-muted">{hint}</p>
      )}
    </div>
  )
}
