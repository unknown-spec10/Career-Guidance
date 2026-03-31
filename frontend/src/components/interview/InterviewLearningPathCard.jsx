import React from 'react'
import { Layers } from 'lucide-react'
import LoadingButton from '../LoadingButton'

const levelStyles = {
  beginner: 'text-emerald-700 bg-emerald-50',
  intermediate: 'text-blue-700 bg-blue-50',
  advanced: 'text-indigo-700 bg-indigo-50',
  expert: 'text-purple-700 bg-purple-50',
  universal: 'text-gray-700 bg-gray-100'
}

export default function InterviewLearningPathCard({
  title,
  level,
  description,
  progress,
  totalModules,
  sessionType,
  onStart,
  onCurriculum,
  loading
}) {
  const progressPercent = totalModules > 0 ? Math.round((progress / totalModules) * 100) : 0
  const levelKey = (level || 'universal').toLowerCase()

  return (
    <article className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-md bg-primary-50 p-2 text-primary-600">
          <Layers className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${levelStyles[levelKey] || levelStyles.universal}`}>
            {level}
          </p>
        </div>
      </div>

      <p className="mb-6 text-sm text-gray-600">{description}</p>

      <div className="mb-4 mt-auto">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-500">
          <span>Progress</span>
          <span>{progress} of {totalModules} modules</span>
        </div>
        <div className="h-2 rounded-full bg-gray-200">
          <div className="h-2 rounded-full bg-primary-500" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <LoadingButton
          loading={loading}
          disabled={loading}
          onClick={() => onStart(sessionType)}
          size="sm"
          className="h-10 w-full justify-center"
        >
          Start Interview
        </LoadingButton>
        <button
          type="button"
          onClick={() => onCurriculum(sessionType)}
          className="h-10 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:border-primary-400 hover:text-primary-600"
        >
          View Curriculum
        </button>
      </div>
    </article>
  )
}
