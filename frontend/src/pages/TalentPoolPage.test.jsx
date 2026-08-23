import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import TalentPoolPage from './TalentPoolPage'

vi.mock('../config/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

import api from '../config/api'

const candidates = [
  {
    applicant_id: 'app_1',
    name: 'Jane Doe',
    current_role: 'Frontend Engineer',
    location: 'Bengaluru',
    skills: ['React', 'TypeScript'],
    summary: 'Builds design systems.',
    years_experience: 4,
    match_score: 91.2,
  },
  {
    applicant_id: 'app_2',
    name: 'Text Fallback Candidate',
    current_role: 'Developer',
    location: 'Remote',
    skills: ['Python'],
    // no match_score — backend used text fallback
  },
]

const renderPage = () =>
  render(
    <MemoryRouter>
      <TalentPoolPage />
    </MemoryRouter>
  )

const search = async (queryText) => {
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText(/senior react developer/i), queryText)
  await user.click(screen.getByRole('button', { name: 'Search' }))
}

describe('TalentPoolPage — semantic candidate search contract (open talent pool)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('POSTs the natural-language query with filters to /api/search/semantic and renders results', async () => {
    api.post.mockResolvedValueOnce({ data: { results: candidates } })
    renderPage()

    await search('react engineers in bengaluru')

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())

    expect(api.post).toHaveBeenCalledWith('/api/search/semantic', {
      query: 'react engineers in bengaluru',
      filters: { skills: [], location: null, experience: [] },
    })
  })

  it('renders an Unscored badge for text-fallback candidates instead of fabricating a score', async () => {
    // Regression for the honesty purge: random percentage scores were once
    // generated client-side; missing scores must show as "Unscored".
    api.post.mockResolvedValueOnce({ data: { results: candidates } })
    renderPage()

    await search('python developers')

    expect(await screen.findByText('Text Fallback Candidate')).toBeInTheDocument()
    expect(screen.getByText('Unscored')).toBeInTheDocument()
    // Jane's real score renders rounded
    expect(screen.getByText('91%')).toBeInTheDocument()
  })

  it('shows the honest empty state when no candidates match', async () => {
    api.post.mockResolvedValueOnce({ data: { results: [] } })
    renderPage()

    await search('quantum physicists')
    expect(await screen.findByText('No candidates found')).toBeInTheDocument()
    expect(await screen.findByText(/couldn't find candidates matching/i)).toBeInTheDocument()
  })

  it('shows a permission-specific message on 403 (employer relationship enforcement)', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 403, data: {} } })
    renderPage()

    await search('anyone')
    expect(await screen.findByText(/do not have permission to search/i)).toBeInTheDocument()
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument()
  })

  it('shows a generic failure message on server errors without inventing data', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 500, data: {} } })
    renderPage()

    await search('anyone')
    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument()
  })

  it('ignores empty queries without hitting the API', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(api.post).not.toHaveBeenCalled()
  })
})
