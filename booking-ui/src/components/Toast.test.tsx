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
})
