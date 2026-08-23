import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from './Modal'

describe('Modal — shared dialog contract', () => {
  it('renders title and children when open', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Confirm Action">
        <p>BODY_CONTENT</p>
      </Modal>
    )
    expect(screen.getByText('Confirm Action')).toBeInTheDocument()
    expect(screen.getByText('BODY_CONTENT')).toBeInTheDocument()
  })

  it('exposes dialog semantics for assistive tech', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Confirm Action">
        <p>x</p>
      </Modal>
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('closes on Escape key (consistent with other app modals)', async () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} title="Escapable">
        <p>x</p>
      </Modal>
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close on Escape while closed', async () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={false} onClose={onClose} title="Hidden">
        <p>x</p>
      </Modal>
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} title="Closable">
        <p>x</p>
      </Modal>
    )
    // The close button is the only button in the header
    const closeButton = screen.getByRole('button')
    await userEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close on backdrop click when closeOnOverlayClick is false', async () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} title="Sticky" closeOnOverlayClick={false}>
        <p>x</p>
      </Modal>
    )
    // Click on the overlay itself (the outer fixed container)
    await userEvent.click(document.querySelector('.fixed.inset-0'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('moves focus into the dialog on open and restores it on close (focus trap)', async () => {
    const Wrapper = () => {
      const [open, setOpen] = React.useState(false)
      return (
        <>
          <button id="outside-trigger" onClick={() => setOpen(true)}>Open</button>
          {open && (
            <Modal isOpen onClose={() => setOpen(false)} title="Trapped">
              <button id="inner-a">Inner A</button>
              <button id="inner-b">Inner B</button>
            </Modal>
          )}
        </>
      )
    }
    render(<Wrapper />)

    // Opening via the trigger puts focus into the dialog (first focusable =
    // the header close button)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    const closeButton = document.querySelector('.fixed.inset-0 button')
    await waitFor(() => expect(closeButton).toHaveFocus())

    // Tab from the last inner control wraps back to the first focusable
    document.getElementById('inner-b').focus()
    await userEvent.keyboard('{Tab}')
    expect(closeButton).toHaveFocus()

    // Shift+Tab from the first focusable wraps to the last inner control
    closeButton.focus()
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
    expect(document.getElementById('inner-b')).toHaveFocus()

    // Closing (Escape) restores focus to the trigger that opened the dialog
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(document.getElementById('outside-trigger')).toHaveFocus())
  })
})
