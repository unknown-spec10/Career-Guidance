import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import InterviewPage from './InterviewPage'

vi.mock('../config/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

import api from '../config/api'

const renderInterview = () =>
  render(
    <MemoryRouter>
      <InterviewPage />
    </MemoryRouter>
  )

describe('InterviewPage — sticky rail contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    api.get.mockImplementation((url) => {
      if (url === '/api/student/profile') {
        return Promise.resolve({ data: { skills: ['React'] } })
      }
      if (url === '/api/interview/active-session') {
        return Promise.resolve({ data: { has_active_session: false } })
      }
      if (url === '/api/interview/history') {
        return Promise.resolve({ data: [] })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the resume-missing branch without crashing (C1: Link is imported)', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/student/profile') {
        return Promise.resolve({ data: { skills: [] } })
      }
      if (url === '/api/interview/active-session') {
        return Promise.resolve({ data: { has_active_session: false } })
      }
      if (url === '/api/interview/history') {
        return Promise.resolve({ data: [] })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    renderInterview()

    // The exact branch that used to throw ReferenceError now renders guidance.
    await screen.findByText('Resume Profile Required')
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/student/dashboard')
    // Start stays hard-blocked for genuinely resume-less users.
    expect(screen.getByRole('button', { name: /Launch AI Practice/i })).toBeDisabled()
  })

  it('normalizes 0.0-1.0 history scores to percent (C2)', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/student/profile') {
        return Promise.resolve({ data: { skills: ['React'] } })
      }
      if (url === '/api/interview/active-session') {
        return Promise.resolve({ data: { has_active_session: false } })
      }
      if (url === '/api/interview/history') {
        return Promise.resolve({ data: [{
          session_id: 'sess-1',
          interview_type: 'technical',
          difficulty: 'medium',
          num_questions: 10,
          overall_score: 0.85,
          status: 'completed',
        }, {
          session_id: 'sess-2',
          interview_type: 'technical',
          difficulty: 'medium',
          num_questions: 10,
          overall_score: 0.0,
          status: 'completed',
        }, {
          session_id: 'sess-3',
          interview_type: 'technical',
          difficulty: 'medium',
          num_questions: 10,
          overall_score: 1.0,
          status: 'completed',
        }] })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    renderInterview()

    // 0.85 must render as 85%, not "1%"; boundaries 0.0/1.0 as 0%/100%.
    await screen.findByText('85%')
    await screen.findByText('0%')
    await screen.findByText('100%')
  })

  it('keeps the info/history rail sticky on desktop only', async () => {
    renderInterview()

    await screen.findByText('Practice History')
    // The rail is the lg:col-span-4 grid item; locate it via a
    // class-substring selector (no layout engine needed — asserts the
    // Tailwind sticky contract, not computed position).
    const rail = screen.getByText('Practice History').closest('[class*="lg:col-span-4"]')
    expect(rail).not.toBeNull()
    expect(rail.className).toMatch(/lg:sticky/)
    expect(rail.className).toMatch(/lg:top-6/)
    expect(rail.className).toMatch(/(^|\s)self-start(\s|$)/)
    // Must NOT be unconditionally sticky: below the lg breakpoint the
    // layout collapses to one column, so only the `lg:` variant may exist.
    expect(rail.className).not.toMatch(/(^|\s)sticky(\s|$)/)
  })
})
