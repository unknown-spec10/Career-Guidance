import React from 'react'
import { LayoutDashboard, GraduationCap, Gauge, Settings, HelpCircle, LogOut, Sparkles } from 'lucide-react'
import CreditWidget from '../CreditWidget'

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'modules', label: 'Modules', icon: GraduationCap },
  { key: 'performance', label: 'Performance', icon: Gauge },
  { key: 'settings', label: 'Settings', icon: Settings }
]

const utilityItems = [
  { key: 'help', label: 'Help', icon: HelpCircle },
  { key: 'logout', label: 'Logout', icon: LogOut }
]

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

      <nav className="space-y-1">
        {navItems.map(({ key, label, icon: Icon }) => {
          const active = key === 'modules'
          return (
            <button
              key={key}
              type="button"
              className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                active ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          )
        })}
      </nav>

      <div className="my-6">
        <CreditWidget />
      </div>

      <button
        type="button"
        className="mb-6 h-10 w-full rounded-lg bg-primary-500 px-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
      >
        Upgrade to Pro
      </button>

      <div className="space-y-1 border-t border-gray-200 pt-4">
        {utilityItems.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}
