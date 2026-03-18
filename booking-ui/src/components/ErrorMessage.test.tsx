import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ErrorMessage } from './ErrorMessage'

describe('ErrorMessage', () => {
  it('renders the message prop text', () => {
    render(<ErrorMessage message="Something went wrong" onRetry={() => {}} />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('"Try again" button calls onRetry when clicked', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    render(<ErrorMessage message="Network error" onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
