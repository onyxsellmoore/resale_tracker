import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Toast } from './Toast'

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the message text', () => {
    render(<Toast message="Item added to inventory." onDismiss={() => {}} />)
    expect(screen.getByText('Item added to inventory.')).toBeInTheDocument()
  })

  it('calls onDismiss after the duration using fake timers', () => {
    const onDismiss = vi.fn()
    render(<Toast message="Done" onDismiss={onDismiss} duration={3000} />)

    expect(onDismiss).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3000)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('✕ button dismisses immediately', () => {
    const onDismiss = vi.fn()
    render(<Toast message="Done" onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('renders an Undo button when onUndo is provided', () => {
    const onUndo = vi.fn()
    render(<Toast message="Deleted" onDismiss={() => {}} onUndo={onUndo} />)

    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument()
  })

  it('does not render an Undo button when onUndo is not provided', () => {
    render(<Toast message="Done" onDismiss={() => {}} />)

    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument()
  })

  it('clicking Undo calls onUndo and onDismiss', () => {
    const onUndo = vi.fn()
    const onDismiss = vi.fn()
    render(<Toast message="Deleted" onDismiss={onDismiss} onUndo={onUndo} />)

    fireEvent.click(screen.getByRole('button', { name: /undo/i }))
    expect(onUndo).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('uses custom undoLabel when provided', () => {
    render(<Toast message="Deleted" onDismiss={() => {}} onUndo={() => {}} undoLabel="Revert" />)

    expect(screen.getByRole('button', { name: /revert/i })).toBeInTheDocument()
  })
})
