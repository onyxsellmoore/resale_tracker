import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { NavBar } from './NavBar'

function renderNavBar(initialRoute = '/inventory') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <NavBar />
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('HamburgerMenu', () => {
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

  it('on render, aria-expanded on the hamburger button is "false"', () => {
    renderNavBar()
    const button = screen.getByRole('button', { name: /menu/i })
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('clicking the button sets aria-expanded to "true" and the drawer becomes visible', async () => {
    renderNavBar()
    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: /menu/i })

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    // Drawer should be visible — links within the drawer
    expect(screen.getByTestId('nav-drawer')).toBeInTheDocument()
  })

  it('clicking the button again sets aria-expanded to "false"', async () => {
    renderNavBar()
    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: /menu/i })

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })
})
