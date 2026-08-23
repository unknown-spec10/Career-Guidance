import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmDialog from './ConfirmDialog'

const setup = (overrides = {}) => {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <ConfirmDialog
      isOpen
      title="Delete this learning path?"
      message="It will be permanently deleted in 30 days."
      confirmLabel="Delete"
      destructive
      onConfirm={onConfirm}
      onClose={onClose}
      {...overrides}
    />
  )
  return { onConfirm, onClose }
}

describe('ConfirmDialog — shared confirmation pattern (replaces window.confirm)', () => {
  it('renders title and message inside a proper dialog', () => {
    setup()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Delete this learning path?')).toBeInTheDocument()
    expect(screen.getByText(/permanently deleted in 30 days/i)).toBeInTheDocument()
  })

  it('fires onConfirm when the destructive action is clicked', async () => {
    const { onConfirm } = setup()
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('fires onClose via Cancel and via Escape (consistent modal behavior)', async () => {
    const { onClose } = setup()
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('shows a loading state that disables both actions and prevents double submit', async () => {
    const { onConfirm, onClose } = setup({ loading: true })
    const confirmBtn = screen.getByRole('button', { name: /delete/i })
    expect(confirmBtn).toBeDisabled()
    expect(confirmBtn).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()

    await userEvent.click(confirmBtn)
    expect(onConfirm).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('hides the destructive warning icon for non-destructive confirms', () => {
    setup({ destructive: false, title: 'Continue?' })
    expect(screen.getByText('Continue?')).toBeInTheDocument()
    // No AlertTriangle icon rendered — assert by checking no svg with lucide-alert-triangle class
    expect(document.querySelector('.lucide-alert-triangle')).toBeNull()
  })
})
