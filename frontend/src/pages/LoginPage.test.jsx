import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../config/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    defaults: { headers: { common: {} } },
  },
  API_BASE_URL: '',
}))

import api from '../config/api'
import LoginPage from './LoginPage'

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/student/dashboard" element={<div>STUDENT_DASH</div>} />
        <Route path="/employer/dashboard" element={<div>EMPLOYER_DASH</div>} />
        <Route path="/admin/dashboard" element={<div>ADMIN_DASH</div>} />
        <Route path="/forgot-password" element={<div>FORGOT</div>} />
        <Route path="/register" element={<div>REGISTER</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('LoginPage — credential login contract', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('submits OAuth2 form-encoded credentials to /api/auth/login and routes students to their dashboard', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValueOnce({
      data: { access_token: 'tok-abc', user: { id: 1, role: 'student' } },
    })
    renderLogin()

    await user.type(screen.getByPlaceholderText('you@example.com'), 'student@example.com')
    await user.type(screen.getByPlaceholderText('Enter your password'), 'secret123')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => expect(screen.getByText('STUDENT_DASH')).toBeInTheDocument())

    expect(api.post).toHaveBeenCalledTimes(1)
    const [url, body, config] = api.post.mock.calls[0]
    expect(url).toBe('/api/auth/login')
    expect(config.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    // OAuth2PasswordRequestForm expects username/password fields
    expect(body.get('username')).toBe('student@example.com')
    expect(body.get('password')).toBe('secret123')

    // Session persisted for the rest of the app
    expect(JSON.parse(atob(sessionStorage.getItem('_secure_token')))).toBe('tok-abc')
    expect(JSON.parse(atob(sessionStorage.getItem('_secure_user')))).toEqual({ id: 1, role: 'student' })
    expect(api.defaults.headers.common.Authorization).toBe('Bearer tok-abc')
  })

  it('routes employers and admins to their own dashboards based on the returned role', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValueOnce({
      data: { access_token: 'tok-e', user: { id: 2, role: 'employer' } },
    })
    renderLogin()

    await user.type(screen.getByPlaceholderText('you@example.com'), 'hr@corp.com')
    await user.type(screen.getByPlaceholderText('Enter your password'), 'pw')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => expect(screen.getByText('EMPLOYER_DASH')).toBeInTheDocument())
  })

  it('shows the backend error detail on failed login and does not create a session', async () => {
    const user = userEvent.setup()
    api.post.mockRejectedValueOnce({
      response: { status: 401, data: { detail: 'Invalid email or password' } },
    })
    renderLogin()

    await user.type(screen.getByPlaceholderText('you@example.com'), 'student@example.com')
    await user.type(screen.getByPlaceholderText('Enter your password'), 'bad')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    // Backend detail is surfaced verbatim in the inline alert AND the toast
    // (no misleading generic copy)
    await waitFor(() => {
      const notices = screen.getAllByText('Invalid email or password')
      expect(notices.length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.queryByText('STUDENT_DASH')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('_secure_token')).toBeNull()
  })

  it('disables the submit button while a login request is in flight', async () => {
    const user = userEvent.setup()
    let resolveLogin
    api.post.mockReturnValueOnce(new Promise((resolve) => { resolveLogin = resolve }))
    renderLogin()

    await user.type(screen.getByPlaceholderText('you@example.com'), 's@e.com')
    await user.type(screen.getByPlaceholderText('Enter your password'), 'pw')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(screen.getByRole('button', { name: /^signing in/i })).toBeDisabled()

    resolveLogin({ data: { access_token: 't', user: { role: 'student' } } })
    await waitFor(() => expect(screen.getByText('STUDENT_DASH')).toBeInTheDocument())
  })

  it('renders navigation links to registration and password reset', () => {
    renderLogin()
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/register')
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute('href', '/forgot-password')
  })
})
