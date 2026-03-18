import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { LoginPage } from './LoginPage'

vi.mock('../api/authApi', () => ({
  beginPasskeyLogin: vi.fn(),
  completePasskeyLogin: vi.fn(),
  b64urlToBytes: vi.fn((s: string) => new Uint8Array([1, 2, 3])),
}))

import { beginPasskeyLogin, completePasskeyLogin } from '../api/authApi'
const mockBeginPasskeyLogin = vi.mocked(beginPasskeyLogin)
const mockCompletePasskeyLogin = vi.mocked(completePasskeyLogin)

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    })
    mockBeginPasskeyLogin.mockReset()
    mockCompletePasskeyLogin.mockReset()
  })

  it('does NOT render a password input', () => {
    renderPage()
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
  })

  it('renders "Sign in with passkey" button', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /sign in with passkey/i })).toBeInTheDocument()
  })

  it('renders email input', () => {
    renderPage()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('shows error when passkey login is cancelled (NotAllowedError)', async () => {
    mockBeginPasskeyLogin.mockResolvedValue({
      challenge: 'test-challenge',
      rpId: 'localhost',
      allowCredentials: [{ id: 'cred1', type: 'public-key' }],
      timeout: 60000,
    })

    const notAllowedError = new DOMException('User cancelled', 'NotAllowedError')
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(notAllowedError),
      },
    })

    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'test@test.com')
    await user.click(screen.getByRole('button', { name: /sign in with passkey/i }))

    await waitFor(() => {
      expect(screen.getByText(/passkey sign-in was cancelled/i)).toBeInTheDocument()
    })
  })

  it('shows generic error when passkey login fails', async () => {
    mockBeginPasskeyLogin.mockRejectedValue(new Error('Server error'))

    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'test@test.com')
    await user.click(screen.getByRole('button', { name: /sign in with passkey/i }))

    await waitFor(() => {
      expect(screen.getByText(/sign-in failed/i)).toBeInTheDocument()
    })
  })
})
