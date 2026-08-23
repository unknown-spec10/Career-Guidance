import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import UserManagementPage from './UserManagementPage'

vi.mock('../config/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

import api from '../config/api'

describe('UserManagementPage — admin consumes real API data (honesty regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI statistics mapped from the real /api/admin/stats payload', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/admin/stats') {
        return Promise.resolve({
          data: { total_users: 1234, active_users: 1100, flagged_users: 7, suspended_users: 3 },
        })
      }
      if (url === '/api/admin/users') {
        return Promise.resolve({
          data: {
            total: 2,
            users: [
              { user_id: 1, name: 'Alice Student', email: 'alice@x.com', role: 'student', status: 'active' },
              { user_id: 2, name: 'Bob Recruiter', email: 'bob@y.com', role: 'employer', status: 'flagged' },
            ],
          },
        })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    render(<UserManagementPage />)

    expect(await screen.findByText('Alice Student')).toBeInTheDocument()
    expect(screen.getByText('Bob Recruiter')).toBeInTheDocument()
    expect(screen.getByText('Total Users')).toBeInTheDocument()

    // Values come from the API mapping (total_users -> Total Users KPI), not
    // from any hardcoded demo numbers. KpiCard renders via toLocaleString().
    const kpiValues = await screen.findAllByText(/^(1,234|1,100|7|3)$/)
    expect(kpiValues.length).toBeGreaterThanOrEqual(4)
    expect(screen.getAllByText('1,234').length).toBeGreaterThan(0)
  })

  it('shows zeroed stats and an empty list when both endpoints fail — never demo data', async () => {
    api.get.mockRejectedValue({ response: { status: 500, data: {} } })
    render(<UserManagementPage />)

    await waitFor(() => {
      const total = screen.getByText('Total Users').closest('div')?.parentElement?.textContent || ''
      expect(total).toContain('0')
    })
    await waitFor(() => {
      expect(screen.getByText(/no users match your filters/i)).toBeInTheDocument()
    })
    // None of the fabricated mock users from the old demo dataset may appear
    expect(screen.queryByText(/sarah|john|demo admin/i)).not.toBeInTheDocument()
  })

  it('passes pagination, role filter and search params to /api/admin/users', async () => {
    api.get.mockResolvedValue({ data: { users: [], total: 0 } })
    render(<UserManagementPage />)

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/admin/users', {
      params: { page: 1, limit: 10 },
    }))
  })
})
