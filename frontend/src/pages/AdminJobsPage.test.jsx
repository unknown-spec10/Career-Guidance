import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AdminJobsPage from './AdminJobsPage'

vi.mock('../config/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

import api from '../config/api'

const pendingJob = {
  id: 11,
  title: 'React Developer',
  status: 'pending',
  employer_id: 2,
  company_name: 'Acme Corp',
  location_city: 'Kolkata',
  created_at: '2026-10-01T10:00:00Z',
  expires_at: '2026-12-01T10:00:00Z',
}

const approvedJob = {
  ...pendingJob,
  id: 12,
  title: 'Backend Engineer',
  status: 'approved',
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminJobsPage />
    </MemoryRouter>
  )

describe('AdminJobsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to the pending moderation queue with status, skip, and limit params', async () => {
    api.get.mockResolvedValue({ data: { jobs: [pendingJob], total: 1 } })

    renderPage()

    expect(await screen.findByText('React Developer')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/api/admin/jobs', {
      params: { status: 'pending', skip: 0, limit: 20 },
    })
    expect(screen.getByRole('button', { name: 'pending' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('approves through ConfirmDialog, removes the row optimistically, and refreshes the queue', async () => {
    let queue = [pendingJob]
    api.get.mockImplementation(() => Promise.resolve({ data: { jobs: queue, total: queue.length } }))
    api.post.mockImplementation(() => {
      queue = []
      return Promise.resolve({ data: { id: 11, status: 'approved' } })
    })

    renderPage()
    await screen.findByText('React Developer')

    await userEvent.click(screen.getByRole('button', { name: /approve react developer/i }))
    const dialog = await screen.findByRole('dialog', { name: /approve this job/i })
    await userEvent.click(within(dialog).getByRole('button', { name: /approve job/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/admin/jobs/11/approve')
    })
    expect(await screen.findByText('Moderation queue is clear')).toBeInTheDocument()
    expect(await screen.findByText(/react developer.*approved/i)).toBeInTheDocument()
    // Refetch after the optimistic update.
    expect(api.get.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('rejects through ConfirmDialog and posts to the reject endpoint', async () => {
    api.get.mockResolvedValue({ data: { jobs: [pendingJob], total: 1 } })
    api.post.mockResolvedValue({ data: { id: 11, status: 'rejected' } })

    renderPage()
    await screen.findByText('React Developer')

    await userEvent.click(screen.getByRole('button', { name: /reject react developer/i }))
    const dialog = await screen.findByRole('dialog', { name: /reject this job/i })
    await userEvent.click(within(dialog).getByRole('button', { name: /reject job/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/admin/jobs/11/reject')
    })
    expect(await screen.findByText(/react developer.*rejected/i)).toBeInTheDocument()
  })

  it('restores the optimistically removed row and toasts when a transition is invalid', async () => {
    api.get.mockResolvedValue({ data: { jobs: [pendingJob], total: 1 } })
    api.post.mockRejectedValue({
      response: {
        status: 400,
        data: { detail: 'Job is not pending (current status: approved)' },
      },
    })

    renderPage()
    await screen.findByText('React Developer')
    await userEvent.click(screen.getByRole('button', { name: /approve react developer/i }))
    const dialog = await screen.findByRole('dialog', { name: /approve this job/i })
    await userEvent.click(within(dialog).getByRole('button', { name: /approve job/i }))

    expect(
      await screen.findByText('Job is not pending (current status: approved)')
    ).toBeInTheDocument()
    expect(screen.getByText('React Developer')).toBeInTheDocument()
  })

  it('filters by status and hides moderation actions outside pending', async () => {
    api.get.mockImplementation((url, config) =>
      Promise.resolve({
        data:
          config?.params?.status === 'approved'
            ? { jobs: [approvedJob], total: 1 }
            : { jobs: [pendingJob], total: 1 },
      })
    )

    renderPage()
    await screen.findByText('React Developer')

    await userEvent.click(screen.getByRole('button', { name: 'approved' }))

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/admin/jobs', {
        params: { status: 'approved', skip: 0, limit: 20 },
      })
    })
    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve backend engineer/i })).not.toBeInTheDocument()
    expect(screen.getByText('Decision recorded')).toBeInTheDocument()
  })
})
