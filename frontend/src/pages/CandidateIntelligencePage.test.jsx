import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CandidateIntelligencePage from './CandidateIntelligencePage'

vi.mock('../config/api', () => ({
  default: { get: vi.fn() },
}))

import api from '../config/api'

const profilePayload = {
  sessions_count: 3,
  summary: 'Steady progress across mock sessions.',
  last_updated: '2026-01-01T00:00:00',
  answer_patterns: {},
  strengths: ['Clear communication'],
  weaknesses: ['System design depth'],
  role_readiness: {
    junior: 80,
    mid_level: 55,
    senior: 30,
    verdict: 'Ready for junior roles.',
  },
  technical_skills: {
    React: { level: 'Strong', score_history: [0.8], trend_summary: 'Improving.' },
  },
}

const renderIntelligence = () =>
  render(
    <MemoryRouter>
      <CandidateIntelligencePage />
    </MemoryRouter>
  )

describe('CandidateIntelligencePage — sticky rail contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    api.get.mockResolvedValue({ data: profilePayload })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the role-readiness rail sticky on desktop only', async () => {
    renderIntelligence()

    await screen.findByText('Role Tier Readiness')
    // The rail is the right-column div; .closest climbs to it first (no
    // layout engine needed — asserts the Tailwind sticky contract, not
    // computed position).
    const rail = screen.getByText('Role Tier Readiness').closest('.space-y-8')
    expect(rail).not.toBeNull()
    expect(rail.className).toMatch(/lg:sticky/)
    expect(rail.className).toMatch(/lg:top-6/)
    expect(rail.className).toMatch(/(^|\s)self-start(\s|$)/)
    // Must NOT be unconditionally sticky: below the lg breakpoint the
    // layout collapses to one column, so only the `lg:` variant may exist.
    expect(rail.className).not.toMatch(/(^|\s)sticky(\s|$)/)
  })
})
