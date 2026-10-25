import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import UpgradePage from './UpgradePage'

vi.mock('../config/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

import api from '../config/api'

function renderUpgrade() {
  return render(
    <MemoryRouter>
      <UpgradePage />
    </MemoryRouter>
  )
}

describe('UpgradePage — enterprise contact honest-gap contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    api.get.mockResolvedValue({ data: { is_premium: false, current_credits: 60 } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows honest manual-contact copy instead of a fake self-serve form', async () => {
    const user = userEvent.setup()
    renderUpgrade()

    await user.click(await screen.findByRole('button', { name: /contact sales/i }))

    expect(
      await screen.findByText(/enterprise plans are handled manually/i)
    ).toBeInTheDocument()
    // No fake submit path may remain: the form that pretended to send an
    // inquiry over setTimeout is gone.
    expect(screen.queryByRole('button', { name: /send inquiry/i })).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/stanford university/i)).not.toBeInTheDocument()

    const mailto = screen.getByRole('link', { name: /email sales/i })
    expect(mailto).toHaveAttribute(
      'href',
      expect.stringMatching(/^mailto:/)
    )
    expect(api.post).not.toHaveBeenCalled()
  })

  it('still wires the Pro upgrade to the live credits endpoint', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValueOnce({ data: { is_premium: true, current_credits: 300 } })
    renderUpgrade()

    await user.click(await screen.findByRole('button', { name: /upgrade to pro/i }))

    expect(api.post).toHaveBeenCalledWith('/api/credits/upgrade')
    await screen.findByText(/pro plan activated/i)
  })
})
