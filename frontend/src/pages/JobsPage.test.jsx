import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import JobsPage from './JobsPage'

vi.mock('../config/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

import api from '../config/api'

const job = {
  id: 11,
  title: 'React Developer',
  company: 'Acme Corp',
  location_city: 'Kolkata',
  work_type: 'remote',
  description: 'Build UIs.',
  required_skills: [{ name: 'React' }],
}

const recommendation = {
  job,
  match_score: 0.87,
  scoring_breakdown: { skills_breakdown: { matched_skills: ['React'], partial_matches: [] } },
}

const enc = (v) => btoa(JSON.stringify(v))

function seedStudentSession() {
  sessionStorage.setItem('_secure_user', enc({ id: 5, email: 's@x.com', role: 'student' }))
  sessionStorage.setItem('_secure_token', enc('tok'))
  sessionStorage.setItem('_secure_db_applicant_id', enc(7))
  sessionStorage.setItem('_secure_login_time', enc(Date.now()))
}

const renderJobs = () =>
  render(
    <MemoryRouter>
      <JobsPage />
    </MemoryRouter>
  )

describe('JobsPage — job listing & application contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    seedStudentSession()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    api.get.mockImplementation((url) => {
      if (url === '/api/student/applications/jobs') {
        return Promise.resolve({ data: { applications: [] } })
      }
      if (url === '/api/student/applicant') {
        return Promise.resolve({ data: { id: 7, location_city: 'kolkata' } })
      }
      if (url === '/api/student/profile') {
        return Promise.resolve({ data: { personal_info: { location: 'Kolkata, India' } } })
      }
      if (url === '/api/credits/balance') {
        return Promise.resolve({ data: { current_credits: 50 } })
      }
      if (url.startsWith('/api/recommendations/')) {
        // Students see jobs through the recommendation pipeline
        return Promise.resolve({ data: { job_recommendations: [recommendation] } })
      }
      if (url.startsWith('/api/jobs')) {
        return Promise.resolve({ data: { jobs: [job], total: 1 } })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    api.post.mockResolvedValue({ data: {} })
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('fetches recommendations and renders the recommended job cards for students', async () => {
    renderJobs()

    expect(await screen.findByText('React Developer')).toBeInTheDocument()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    const recCall = api.get.mock.calls.find(([url]) => url.startsWith('/api/recommendations/'))
    expect(recCall[0]).toMatch(/^\/api\/recommendations\/7\?t=\d+$/)
  })

  it('applies to a job via POST /api/jobs/:id/apply with the correct body and marks it applied', async () => {
    api.post.mockResolvedValueOnce({ data: { status: 'ok' } })
    renderJobs()

    await screen.findByText('React Developer')
    const applyBtn = await screen.findByRole('button', { name: /easy apply/i })
    await userEvent.click(applyBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/jobs/11/apply', { job_id: 11 })
    })
    // Applied state replaces the Easy Apply affordance
    await waitFor(() => {
      expect(screen.getByText('Applied')).toBeInTheDocument()
    })
  })

  it('surfaces the backend detail when the application fails (e.g. already applied)', async () => {
    api.post.mockRejectedValueOnce({
      response: { status: 400, data: { detail: 'You have already applied to this job.' } },
    })
    renderJobs()

    await screen.findByText('React Developer')
    const applyBtn = await screen.findByRole('button', { name: /easy apply/i })
    await userEvent.click(applyBtn)

    await waitFor(() => {
      expect(screen.getByText('You have already applied to this job.')).toBeInTheDocument()
    })
    // Failed application must NOT mark the job as applied
    expect(screen.queryByText('Applied')).not.toBeInTheDocument()
  })

  it('shows an honest error banner when recommendation fetching fails', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/recommendations/')) {
        return Promise.reject({ response: { status: 500, data: {} } })
      }
      if (url === '/api/student/applications/jobs') {
        return Promise.resolve({ data: { applications: [] } })
      }
      return Promise.resolve({ data: {} })
    })
    renderJobs()

    expect(await screen.findByText(/unable to fetch recommendations right now/i)).toBeInTheDocument()
    expect(screen.queryByText('React Developer')).not.toBeInTheDocument()
  })

  it('blocks applications from non-students at the handler level (role guard)', async () => {
    // The Easy Apply button is rendered for all sessions, but handleApply
    // enforces the student role client-side; the backend enforces it for real.
    sessionStorage.setItem('_secure_user', enc({ id: 9, email: 'e@x.com', role: 'employer' }))
    renderJobs()

    const applyBtn = await screen.findByRole('button', { name: /easy apply/i })
    await userEvent.click(applyBtn)

    expect(await screen.findByText('Only students can apply to jobs.')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalledWith('/api/jobs/11/apply', { job_id: 11 })
  })
})
