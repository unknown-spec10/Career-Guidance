import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AdminDashboardPage from './AdminDashboardPage'

vi.mock('../config/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

import api from '../config/api'

const overview = {
  users_total: 42,
  applicants_total: 18,
  uploads_total: 27,
  jobs_by_status: { pending: 3, approved: 12, rejected: 2 },
  credit_totals: { accounts: 18, current_credits: 900, total_earned: 1500, total_spent: 600 },
  latest_audits: [
    {
      id: 9,
      action: 'admin_user_active_update',
      target_type: 'User',
      target_id: 5,
      user_id: 3,
      created_at: '2026-10-20T10:00:00Z',
    },
  ],
}

const auditPage = {
  logs: [
    {
      id: 8,
      action: 'admin_job_approved',
      target_type: 'Job',
      target_id: 11,
      user_id: 3,
      details: { new_status: 'approved' },
      created_at: '2026-10-20T09:00:00Z',
    },
  ],
  total: 1,
}

const configEntries = {
  config: [
    {
      key: 'credit_config',
      value: { weekly: 100 },
      category: 'credits',
      description: 'Weekly credit allowance',
    },
  ],
}

function mockHappyPath() {
  api.get.mockImplementation((url) => {
    if (url === '/api/admin/overview') return Promise.resolve({ data: overview })
    if (url === '/api/admin/audit-logs') return Promise.resolve({ data: auditPage })
    if (url === '/api/admin/config') return Promise.resolve({ data: configEntries })
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminDashboardPage />
    </MemoryRouter>
  )

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHappyPath()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads overview, audit log, and config in one wave and renders the stat cards', async () => {
    renderPage()

    expect(await screen.findByText('Total users')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Pending approvals')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    expect(api.get).toHaveBeenCalledWith('/api/admin/overview')
    expect(api.get).toHaveBeenCalledWith('/api/admin/audit-logs', {
      params: { skip: 0, limit: 20 },
    })
    expect(api.get).toHaveBeenCalledWith('/api/admin/config')
  })

  it('shows the pending-jobs attention strip linking to the moderation queue', async () => {
    renderPage()

    expect(await screen.findByText(/3 job requests awaiting moderation/i)).toBeInTheDocument()
    const queueLink = screen.getByRole('link', { name: /open moderation queue/i })
    expect(queueLink).toHaveAttribute('href', '/admin/jobs')
  })

  it('lists recent activity and switches between the full audit log and read-only config tabs', async () => {
    renderPage()

    expect(await screen.findByText('admin_user_active_update')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Configuration' }))
    expect(screen.getByText('credit_config')).toBeInTheDocument()
    expect(screen.getByText('Weekly credit allowance')).toBeInTheDocument()
    expect(screen.getAllByText(/read-only view/i).length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('tab', { name: 'Audit log' }))
    expect(screen.getByText('admin_job_approved')).toBeInTheDocument()
    expect(screen.getByText('{"new_status":"approved"}')).toBeInTheDocument()
  })

  it('pages the audit log with skip/limit', async () => {
    api.get.mockImplementation((url, config) => {
      if (url === '/api/admin/overview') return Promise.resolve({ data: overview })
      if (url === '/api/admin/config') return Promise.resolve({ data: configEntries })
      if (url === '/api/admin/audit-logs') {
        if (config?.params?.skip === 20) {
          return Promise.resolve({
            data: {
              logs: [
                {
                  id: 1,
                  action: 'admin_credit_adjust',
                  target_type: 'CreditAccount',
                  target_id: 4,
                  user_id: 3,
                  details: null,
                  created_at: '2026-10-19T09:00:00Z',
                },
              ],
              total: 21,
            },
          })
        }
        return Promise.resolve({
          data: { logs: auditPage.logs, total: 21 },
        })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    renderPage()
    expect(await screen.findByText('admin_job_approved')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/admin/audit-logs', {
        params: { skip: 20, limit: 20 },
      })
    })
    expect(await screen.findByText('admin_credit_adjust')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
  })

  it('surfaces the overview failure with a toast and a retry banner', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/admin/overview') {
        return Promise.reject({ response: { status: 500, data: { detail: 'Overview unavailable' } } })
      }
      if (url === '/api/admin/audit-logs') return Promise.resolve({ data: { logs: [], total: 0 } })
      if (url === '/api/admin/config') return Promise.resolve({ data: { config: [] } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    renderPage()

    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('Overview unavailable')
    expect(banner).toHaveTextContent('Overview unavailable')
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(screen.getAllByText('Overview unavailable').length).toBeGreaterThan(1)
  })
})
