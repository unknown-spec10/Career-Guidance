import React from 'react'
import { Sparkles } from 'lucide-react'

export default function InterviewSidebarPanel() {
  return (
    <aside className="rounded-2xl border border-gray-200 bg-white p-4 lg:sticky lg:top-24">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-primary-500">
          <Sparkles className="h-4 w-4" />
          <p className="text-xs font-semibold uppercase tracking-wider">Interview Prep</p>
        </div>
        <p className="mt-1 text-xs text-gray-500">Career Mastery</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        Session controls on this page are connected directly to interview APIs.
      </div>
    </aside>
  )
}
