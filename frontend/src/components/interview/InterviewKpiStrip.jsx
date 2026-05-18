import React from 'react'

const cardBase = 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm'

export default function InterviewKpiStrip({ history, sessionMode, credits }) {
  const interviewsCompleted = history?.total_sessions ?? 0
  const completionRate = interviewsCompleted > 0
    ? Math.round(((history?.completed_sessions ?? 0) / interviewsCompleted) * 100)
    : 0
  const avgDurationMin = Math.round((history?.average_duration_seconds ?? 0) / 60)
  
  // Weekly limits
  const creditBalance = credits?.current_credits ?? 0
  const creditLimit = credits?.weekly_limit ?? 60
  const creditsRemainingPercent = creditLimit > 0 ? Math.round((creditBalance / creditLimit) * 100) : 0
  
  // Daily limits
  const dailyUsed = credits?.usage_today?.credits ?? 0
  const dailyLimit = credits?.limits?.max_daily_credits ?? 30
  const dailyRemaining = dailyLimit - dailyUsed
  const isDailyBlocked = dailyRemaining <= 0
  const dailyPercent = dailyLimit > 0 ? Math.round((dailyUsed / dailyLimit) * 100) : 0

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className={cardBase}>
        <p className="text-xs uppercase tracking-wide text-gray-500">Interviews Completed</p>
        <p className="mt-2 text-3xl font-bold text-gray-900">{interviewsCompleted}</p>
      </article>

      <article className={cardBase}>
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-gray-500">Completion Rate</p>
          <span className="text-sm font-semibold text-primary-600">{completionRate}%</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-gray-200">
          <div className="h-2 rounded-full bg-primary-500" style={{ width: `${Math.min(completionRate, 100)}%` }} />
        </div>
      </article>

      <article className={cardBase}>
        <p className="text-xs uppercase tracking-wide text-gray-500">Avg. Session Duration</p>
        <p className="mt-2 text-3xl font-bold text-gray-900">{avgDurationMin}<span className="ml-1 text-lg text-gray-500">min</span></p>
      </article>

      <article className={`${cardBase} ${isDailyBlocked ? 'border-red-300 bg-red-50' : ''}`}>
        <div className="space-y-3">
          {/* Daily limit (shown first if blocked) */}
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-gray-600">Daily Usage</p>
              <span className={`text-sm font-semibold ${isDailyBlocked ? 'text-red-600' : 'text-gray-600'}`}>
                {dailyUsed}/{dailyLimit}
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-gray-200">
              <div 
                className={`h-2 rounded-full ${isDailyBlocked ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(dailyPercent, 100)}%` }} 
              />
            </div>
            {isDailyBlocked && <p className="mt-1 text-xs text-red-600 font-medium">Daily limit reached</p>}
          </div>

          {/* Weekly limit */}
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-gray-600">Weekly Total</p>
              <span className={`text-sm font-semibold ${creditBalance <= 2 ? 'text-red-600' : 'text-primary-600'}`}>
                {creditBalance}/{creditLimit}
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-gray-200">
              <div 
                className={`h-2 rounded-full ${creditBalance <= 2 ? 'bg-red-500' : 'bg-green-500'}`} 
                style={{ width: `${Math.min(creditsRemainingPercent, 100)}%` }} 
              />
            </div>
          </div>
        </div>
      </article>
    </section>
  )
}
