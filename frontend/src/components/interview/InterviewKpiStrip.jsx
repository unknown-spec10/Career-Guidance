import React from 'react'

const cardBase = 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm'

export default function InterviewKpiStrip({ history, sessionMode, credits }) {
  const interviewsCompleted = history?.total_sessions ?? 0
  const skillMastery = Math.round(history?.average_score ?? 0)
  const readinessScore = Math.round(history?.latest_score ?? history?.average_score ?? 0)
  const modeLabel = sessionMode === 'micro' ? 'Micro mode selected' : 'Full mode selected'
  const creditBalance = credits?.current_credits ?? null
  const creditLimit = credits?.weekly_limit ?? null

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className={cardBase}>
        <p className="text-xs uppercase tracking-wide text-gray-500">Interviews Completed</p>
        <p className="mt-2 text-3xl font-bold text-gray-900">{interviewsCompleted}</p>
      </article>

      <article className={cardBase}>
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-gray-500">Skill Mastery</p>
          <span className="text-sm font-semibold text-primary-600">{skillMastery}%</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-gray-200">
          <div className="h-2 rounded-full bg-primary-500" style={{ width: `${Math.min(skillMastery, 100)}%` }} />
        </div>
      </article>

      <article className={cardBase}>
        <p className="text-xs uppercase tracking-wide text-gray-500">Avg. Readiness Score</p>
        <p className="mt-2 text-3xl font-bold text-gray-900">{readinessScore}<span className="ml-1 text-lg text-gray-500">/100</span></p>
      </article>

      <article className={cardBase}>
        <p className="text-xs uppercase tracking-wide text-gray-500">Credits & Session</p>
        <p className="mt-2 text-sm font-semibold text-gray-800">{modeLabel}</p>
        {creditBalance !== null && creditLimit !== null ? (
          <p className="mt-1 text-xs text-gray-500">{creditBalance}/{creditLimit} credits available</p>
        ) : (
          <p className="mt-1 text-xs text-gray-500">{history?.sessions_today ?? 0} sessions used today</p>
        )}
      </article>
    </section>
  )
}
