import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    })
  })

  it('renders without crashing and shows login page', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /sign in with passkey/i })).toBeInTheDocument()
  })

  it('renders the NavBar with brand name', () => {
    render(<App />)
    const nav = screen.getByRole('navigation')
    expect(within(nav).getByText('Inventory Ledger')).toBeInTheDocument()
  })
})
