import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ResultsPage from './ResultsPage'

vi.mock('../config/api', () => ({
  default: { get: vi.fn() },
}))

import api from '../config/api'

const renderResults = () =>
  render(
    <MemoryRouter initialEntries={['/results/app_1']}>
      <Routes>
        <Route path="/results/:applicantId" element={<ResultsPage />} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>
  )

const parsedPayload = {
  parsed_data: {
    personal_info: { name: 'Jane Doe', email: 'jane@x.com' },
    education: [{ institution: 'MIT', degree: 'BSc', cgpa: '8.9', year_start: '2020', year_end: '2024' }],
    skills: [{ name: 'React' }, { name: 'Python' }],
    experience: [],
    projects: [],
    llm_confidence: 0.92,
  },
}

describe('ResultsPage — resume analysis surface', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders parsed sections from /api/applicant/:id with readable metadata text', async () => {
    api.get.mockResolvedValueOnce({ data: parsedPayload })
    renderResults()

    expect(await screen.findByText('Resume Analysis Results')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('MIT')).toBeInTheDocument()
    // Skill chips render from real data
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('Python')).toBeInTheDocument()
  })

  it('shows an honest error card with recovery action when loading fails', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 404, data: { detail: 'Applicant not found' } } })
    renderResults()

    expect(await screen.findByText('Error Loading Results')).toBeInTheDocument()
    expect(screen.getByText('Applicant not found')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /back to home/i }))
    expect(await screen.findByText('HOME')).toBeInTheDocument()
  })

  it('does not render the removed Export Report button (dead-UI regression)', async () => {
    api.get.mockResolvedValueOnce({ data: parsedPayload })
    renderResults()
    await screen.findByText('Resume Analysis Results')

    expect(screen.queryByRole('button', { name: /export report/i })).not.toBeInTheDocument()
  })

  it('keeps the left summary rail sticky on desktop only', async () => {
    api.get.mockResolvedValueOnce({ data: parsedPayload })
    renderResults()

    await screen.findByText('Resume Analysis Results')
    // The rail is the lg:col-span-1 grid item; locate it via a
    // class-substring selector (no layout engine needed — asserts the
    // Tailwind sticky contract, not computed position).
    const rail = screen.getByText('Personal Information').closest('[class*="lg:col-span-1"]')
    expect(rail).not.toBeNull()
    expect(rail.className).toMatch(/lg:sticky/)
    expect(rail.className).toMatch(/lg:top-6/)
    expect(rail.className).toMatch(/(^|\s)self-start(\s|$)/)
    // Must NOT be unconditionally sticky: below the lg breakpoint the
    // layout collapses to one column, so only the `lg:` variant may exist.
    expect(rail.className).not.toMatch(/(^|\s)sticky(\s|$)/)
  })
})
