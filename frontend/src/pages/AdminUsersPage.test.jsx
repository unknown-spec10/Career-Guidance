import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AdminUsersPage from './AdminUsersPage'

vi.mock('../config/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

import api from '../config/api'
import { __resetAuthTokenForTests } from '../utils/authToken'

const adminUser = {
  id: 3,
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'admin',
  is_active: true,
  is_verified: true,
  created_at: '2026-01-02T10:00:00Z',
}

const alice = {
  id: 5,
  email: 'alice@example.com',
  name: 'Alice Doe',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-02-10T10:00:00Z',
}

const bob = {
  id: 6,
  email: 'bob@example.com',
  name: 'Bob Roe',
  role: 'student',
  is_active: false,
  is_verified: true,
  created_at: '2026-03-11T10:00:00Z',
}

const creditTransaction = {
  id: 41,
  transaction_type: 'bonus',
  amount: 10,
  balance_after: 60,
  activity_type: 'admin_adjustment',
  description: 'Welcome bonus',
  account_id: 9,
  applicant_id: 7,
  user_email: 'alice@example.com',
  created_at: '2026-10-01T10:00:00Z',
}

function seedAdminSession(user = adminUser) {
  sessionStorage.setItem('_secure_user', btoa(JSON.stringify(user)))
  sessionStorage.setItem('_secure_login_time', btoa(JSON.stringify(Date.now())))
}

function mockHappyPath() {
  api.get.mockImplementation((url, config) => {
    if (url === '/api/admin/users') {
      const search = config?.params?.search
      if (search) {
        const match = [alice, bob, adminUser].filter(
          (user) =>
            user.email.toLowerCase().includes(search.toLowerCase()) ||
            user.name.toLowerCase().includes(search.toLowerCase())
        )
        return Promise.resolve({ data: { users: match, total: match.length } })
      }
      return Promise.resolve({ data: { users: [alice, bob, adminUser], total: 3 } })
    }
    if (url === '/api/admin/credits/transactions') {
      return Promise.resolve({
        data: {
          transactions: config?.params?.search === 'alice@example.com' ? [creditTransaction] : [],
          total: 1,
        },
      })
    }
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminUsersPage />
    </MemoryRouter>
  )

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetAuthTokenForTests()
    sessionStorage.clear()
    seedAdminSession()
    mockHappyPath()
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders the paginated user table from GET /api/admin/users', async () => {
    renderPage()

    expect(await screen.findByText('Alice Doe')).toBeInTheDocument()
    expect(screen.getByText('Bob Roe')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.getByText('Showing 1–3 of 3')).toBeInTheDocument()

    expect(api.get).toHaveBeenCalledWith('/api/admin/users', {
      params: { skip: 0, limit: 20 },
    })
  })

  it('debounces email/name search, resets to the first page, and sends the search param', async () => {
    renderPage()
    await screen.findByText('Alice Doe')

    const search = screen.getByRole('searchbox', { name: /search users by email or name/i })
    await userEvent.type(search, 'alice')

    await waitFor(
      () => {
        expect(api.get).toHaveBeenCalledWith('/api/admin/users', {
          params: { skip: 0, limit: 20, search: 'alice' },
        })
      },
      { timeout: 3000 }
    )

    await waitFor(() => {
      expect(screen.queryByText('Bob Roe')).not.toBeInTheDocument()
    })
  })

  it('deactivates a user through ConfirmDialog and patches is_active', async () => {
    api.patch.mockResolvedValueOnce({ data: { ...alice, is_active: false } })
    renderPage()
    await screen.findByText('Alice Doe')

    await userEvent.click(
      screen.getByRole('button', { name: /deactivate alice@example.com/i })
    )

    const dialog = await screen.findByRole('dialog', { name: /deactivate user/i })
    expect(within(dialog).getByText(/alice@example.com/i)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: /^deactivate$/i }))

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/api/admin/users/5', { is_active: false })
    })
    expect(await screen.findByText(/alice@example.com deactivated/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('shows a toast when the backend rejects self-deactivation', async () => {
    api.patch.mockRejectedValueOnce({
      response: { status: 400, data: { detail: 'Cannot deactivate your own account' } },
    })
    renderPage()
    await screen.findByText('Admin User')

    await userEvent.click(
      screen.getByRole('button', { name: /deactivate admin@example.com/i })
    )
    const dialog = await screen.findByRole('dialog', { name: /deactivate user/i })
    await userEvent.click(within(dialog).getByRole('button', { name: /^deactivate$/i }))

    expect(await screen.findByText('Cannot deactivate your own account')).toBeInTheDocument()
    expect(api.patch).toHaveBeenCalledWith('/api/admin/users/3', { is_active: false })
  })

  it('opens the per-user drawer with credit balance, transactions, and an adjustment form', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        applicant_id: 7,
        current_credits: 85,
        transaction: {
          id: 42,
          transaction_type: 'bonus',
          amount: 25,
          balance_after: 85,
          activity_type: 'admin_adjustment',
          description: 'Goodwill credit for user',
          created_at: '2026-10-21T10:00:00Z',
        },
      },
    })

    renderPage()
    await screen.findByText('Alice Doe')

    await userEvent.click(screen.getByRole('button', { name: /manage alice@example.com/i }))

    const drawer = await screen.findByRole('dialog', { name: /manage alice@example.com/i })
    expect(api.get).toHaveBeenCalledWith('/api/admin/credits/transactions', {
      params: { skip: 0, limit: 100, search: 'alice@example.com' },
    })

    await waitFor(() => {
      expect(within(drawer).getByTestId('balance-before')).toHaveTextContent('60')
    })
    expect(within(drawer).getByTestId('balance-after')).toHaveTextContent('60')
    expect(within(drawer).getByText('Welcome bonus')).toBeInTheDocument()

    await userEvent.type(within(drawer).getByLabelText(/^amount$/i), '25')
    await userEvent.type(
      within(drawer).getByLabelText(/reason/i),
      'Goodwill credit for user'
    )
    await userEvent.click(within(drawer).getByRole('button', { name: /apply adjustment/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/admin/credits/adjust', {
        applicant_id: 7,
        amount: 25,
        reason: 'Goodwill credit for user',
      })
    })

    await waitFor(() => {
      expect(within(drawer).getByTestId('balance-before')).toHaveTextContent('60')
      expect(within(drawer).getByTestId('balance-after')).toHaveTextContent('85')
    })
    expect(within(drawer).getAllByText('+25').length).toBeGreaterThan(0)
  })

  it('disables the adjustment form when no applicant credit account can be resolved', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/admin/users') {
        return Promise.resolve({ data: { users: [alice], total: 1 } })
      }
      if (url === '/api/admin/credits/transactions') {
        return Promise.resolve({ data: { transactions: [], total: 0 } })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    renderPage()
    await screen.findByText('Alice Doe')
    await userEvent.click(screen.getByRole('button', { name: /manage alice@example.com/i }))

    const drawer = await screen.findByRole('dialog', { name: /manage alice@example.com/i })
    expect(
      await within(drawer).findByText(/no credit account activity was found/i)
    ).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: /apply adjustment/i })).toBeDisabled()
  })
})
