import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreditWidget from './CreditWidget'

vi.mock('../config/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

import api from '../config/api'

const balance = {
  current_credits: 42,
  weekly_limit: 60,
  next_refill_days: 2,
  next_refill_hours: 7,
  usage_today: { credits: 3 },
  usage_this_week: { credits: 12, full_interviews: 2 },
  limits: {},
  costs: { micro_session: 1, learning_path: 10 },
  is_premium: false,
}

describe('CreditWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the balance from /api/credits/balance', async () => {
    api.get.mockResolvedValueOnce({ data: balance })
    render(<CreditWidget />)

    expect(await screen.findByText('42')).toBeInTheDocument()
    expect(screen.getByText('/ 60')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/api/credits/balance')
  })

  it('shows a loading skeleton before data arrives', () => {
    api.get.mockReturnValue(new Promise(() => {}))
    const { container } = render(<CreditWidget />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByText('Credits Balance')).not.toBeInTheDocument()
  })

  it('displays cost values from the authoritative API costs object (not hardcoded constants)', async () => {
    // Regression: the widget used to hardcode costs; it must render whatever
    // the backend reports so pricing changes propagate automatically.
    api.get.mockResolvedValueOnce({
      data: { ...balance, costs: { micro_session: 2, learning_path: 15 } },
    })
    render(<CreditWidget />)
    await screen.findByText('42')

    await userEvent.click(screen.getByText('Credits Balance'))

    expect(await screen.findByText('2 Credits / Q')).toBeInTheDocument()
    expect(screen.getByText('15 Credits')).toBeInTheDocument()
  })

  it('opens the details modal with usage statistics on click', async () => {
    api.get.mockResolvedValueOnce({ data: balance })
    render(<CreditWidget />)
    await screen.findByText('42')

    await userEvent.click(screen.getByText('Credits Balance'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Available Credits')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Usage Statistics'))
    expect(await screen.findByText('3')).toBeInTheDocument() // today's usage
  })

  it('hides itself entirely when the API says the user has no credit account (401)', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 401, data: {} } })
    const { container } = render(<CreditWidget />)

    await waitFor(() => expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument())
    expect(container).toBeEmptyDOMElement()
  })

  it('hides itself when the applicant profile does not exist (404)', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 404, data: {} } })
    const { container } = render(<CreditWidget />)

    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
