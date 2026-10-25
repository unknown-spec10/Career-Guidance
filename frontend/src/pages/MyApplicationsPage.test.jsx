import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MyApplicationsPage from './MyApplicationsPage'

vi.mock('../config/api', () => ({
  default: { get: vi.fn(), patch: vi.fn() },
}))

import api from '../config/api'

const renderApplications = (initialEntries = ['/apps']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/apps" element={<MyApplicationsPage />} />
        <Route path="/dashboard/interview" element={<div>INTERVIEW_COACH</div>} />
        <Route path="/job/:jobId" element={<div>JOB_DETAILS</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('MyApplicationsPage — sticky rail contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    api.get.mockImplementation((url) => {
      if (url === '/api/student/applications/jobs') {
        return Promise.resolve({ data: { applications: [] } })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the right sidebar rail sticky on desktop only', async () => {
    renderApplications()

    await screen.findByText('Upcoming Interviews')
    // The rail is the <aside> beside the kanban pane (no layout engine
    // needed — asserts the Tailwind sticky contract, not computed position).
    const rail = screen.getByText('Upcoming Interviews').closest('aside')
    expect(rail).not.toBeNull()
    expect(rail.className).toMatch(/lg:sticky/)
    expect(rail.className).toMatch(/lg:top-6/)
    expect(rail.className).toMatch(/(^|\s)self-start(\s|$)/)
    // Must NOT be unconditionally sticky: below the lg breakpoint the
    // layout stacks, so only the `lg:` variant may exist.
    expect(rail.className).not.toMatch(/(^|\s)sticky(\s|$)/)
  })

  it('routes Prepare with AI Coach to the live interview coach page', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/student/applications/jobs') {
        return Promise.resolve({
          data: {
            applications: [
              { id: 1, application_id: 7, job_id: 42, job_title: 'Backend Dev', company: 'Acme', status: 'interview' },
            ],
          },
        })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    renderApplications()

    const buttons = await screen.findAllByText('Prepare with AI Coach')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(buttons[0])

    // Real navigation — the stub toast-only handler is gone.
    await screen.findByText('INTERVIEW_COACH')
  })

  it('links recent-activity rows to job details only when a job id exists', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/student/applications/jobs') {
        return Promise.resolve({
          data: {
            applications: [
              { id: 1, application_id: 7, job_id: 42, job_title: 'Backend Dev', company: 'Acme', status: 'applied' },
              { id: 2, application_id: 8, job_title: 'Orphan Role', company: 'NoCo', status: 'applied' },
            ],
          },
        })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    renderApplications()

    await screen.findByText('Recent Activity')
    // Row with a job id links out; the chevron affordance is not rendered
    // for rows that go nowhere.
    const jobLink = screen.getByRole('link', { name: /applied to backend dev at acme/i })
    expect(jobLink).toHaveAttribute('href', '/job/42')
    expect(screen.getByText(/applied to orphan role at noco/i).closest('a')).toBeNull()
  })
})
