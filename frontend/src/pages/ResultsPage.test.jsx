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

  it('disables Export Report honestly instead of pretending it works (dead-UI regression)', async () => {
    api.get.mockResolvedValueOnce({ data: parsedPayload })
    renderResults()
    await screen.findByText('Resume Analysis Results')

    const exportBtn = screen.getByRole('button', { name: /export report/i })
    expect(exportBtn).toBeDisabled()
    expect(exportBtn).toHaveAttribute('title', 'Report export is coming soon')
    expect(exportBtn).toHaveAttribute('aria-disabled', 'true')
  })
})
