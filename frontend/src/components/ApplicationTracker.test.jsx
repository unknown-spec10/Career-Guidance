import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApplicationTracker from './ApplicationTracker'

vi.mock('../config/api', () => ({
  default: { get: vi.fn() },
}))

import api from '../config/api'

const applications = [
  { job_title: 'Frontend Dev', company: 'Acme', status: 'interviewing', applied_at: '2026-08-01' },
  { job_title: 'Backend Dev', company: 'Globex', status: 'pending', applied_at: '2026-08-05' },
  { job_title: 'Fullstack Dev', company: 'Initech', status: 'accepted', applied_at: '2026-07-20' },
]

describe('ApplicationTracker — application pipeline contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches and summarizes applications from /api/student/applications/jobs', async () => {
    api.get.mockResolvedValueOnce({ data: { applications } })
    render(<ApplicationTracker />)

    expect(await screen.findByText('3 Active Applications')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/api/student/applications/jobs')

    // Status buckets computed from real data
    expect(screen.getByText('Interview')).toBeInTheDocument()
    const stats = screen.getAllByText(/^(1|3)$/)
    expect(stats.length).toBeGreaterThanOrEqual(2)
  })

  it('opens the status board modal listing each application with its live status', async () => {
    api.get.mockResolvedValueOnce({ data: { applications } })
    render(<ApplicationTracker />)
    await screen.findByText('3 Active Applications')

    await userEvent.click(screen.getByText(/view full status board/i))

    expect(await screen.findByText('Application Status Board')).toBeInTheDocument()
    expect(screen.getByText('Frontend Dev')).toBeInTheDocument()
    expect(screen.getByText('Globex')).toBeInTheDocument()
    expect(screen.getByText('interviewing')).toBeInTheDocument()
    expect(screen.getByText('accepted')).toBeInTheDocument()
  })

  it('shows an honest empty state when the student has not applied anywhere', async () => {
    api.get.mockResolvedValueOnce({ data: { applications: [] } })
    const { container } = render(<ApplicationTracker jobApps={[]} />)

    await waitFor(() => expect(container.textContent).toContain('0 Active Applications'))
    await userEvent.click(screen.getByText(/view full status board/i))
    expect(await screen.findByText('No job applications yet.')).toBeVisible()
  })

  it('degrades gracefully when the API fails (no fabricated rows)', async () => {
    // Regression for the honesty purge: a failed fetch must never be masked
    // with demo data.
    api.get.mockRejectedValueOnce({ response: { status: 500, data: {} } })
    render(<ApplicationTracker />)

    await waitFor(() => expect(screen.getByText('0 Active Applications')).toBeInTheDocument())
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('prefers live API data over the initial props once loaded', async () => {
    api.get.mockResolvedValueOnce({
      data: { applications: [{ job_title: 'Newest Job', company: 'X', status: 'pending', applied_at: '2026-08-10' }] },
    })
    render(<ApplicationTracker jobApps={[{ job_title: 'Stale Prop Job', company: 'Y', status: 'pending' }]} />)

    await waitFor(() => expect(screen.getByText('1 Active Applications')).toBeInTheDocument())
    await userEvent.click(screen.getByText(/view full status board/i))
    expect(await screen.findByText('Newest Job')).toBeInTheDocument()
    expect(screen.queryByText('Stale Prop Job')).not.toBeInTheDocument()
  })
})
