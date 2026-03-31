import React from 'react'
import { Camera, BellOff, FileText } from 'lucide-react'

const tips = [
  {
    title: 'Turn on camera',
    description: 'Body language contributes strongly to communication signals in interviews.',
    icon: Camera
  },
  {
    title: 'Find a quiet space',
    description: 'Background noise can impact answer clarity during AI voice and text review.',
    icon: BellOff
  },
  {
    title: 'Review your resume',
    description: 'Keep project dates and technologies fresh before starting your session.',
    icon: FileText
  }
]

export default function InterviewTipsPanel({ onStartQuickPractice, loading, tipsData }) {
  const resolvedTips = tipsData?.length ? tipsData : tips

  return (
    <aside className="space-y-4 lg:sticky lg:top-24">
      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <h3 className="mb-4 text-2xl font-semibold text-gray-900">Quick Tips</h3>
        <div className="space-y-4">
          {resolvedTips.map((tip) => (
            <article key={tip.title} className="flex items-start gap-3">
              <div className="rounded-md bg-primary-100 p-2 text-primary-600">
                <tip.icon className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900">{tip.title}</h4>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">{tip.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-primary-500 p-5 text-white shadow-md">
        <p className="text-lg font-semibold">Need a Mock Interview?</p>
        <p className="mt-2 text-sm text-primary-100">Start a focused quick practice to warm up before your full round.</p>
        <button
          type="button"
          onClick={onStartQuickPractice}
          disabled={loading}
          className="mt-4 h-10 w-full rounded-lg bg-white px-4 text-sm font-semibold text-primary-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Starting...' : 'Book Now'}
        </button>
      </section>
    </aside>
  )
}
