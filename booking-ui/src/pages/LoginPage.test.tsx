import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { LoginPage } from './LoginPage'

vi.mock('../api/authApi', () => ({
  beginPasskeyLogin: vi.fn(),
  completePasskeyLogin: vi.fn(),
  loginWithPassword: vi.fn(),
  b64urlToBytes: vi.fn((_s: string) => new Uint8Array([1, 2, 3])),
}))

import { beginPasskeyLogin, completePasskeyLogin, loginWithPassword } from '../api/authApi'
const mockBeginPasskeyLogin = vi.mocked(beginPasskeyLogin)
const mockCompletePasskeyLogin = vi.mocked(completePasskeyLogin)
const mockLoginWithPassword = vi.mocked(loginWithPassword)

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
    mockLoginWithPassword.mockReset()
  })

  it('does NOT render a password input initially', () => {
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
      outcome: 'success',
      options: {
        challenge: 'test-challenge',
        rpId: 'localhost',
        allowCredentials: [{ id: 'cred1', type: 'public-key' }],
        timeout: 60000,
      },
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

  it('shows session-expired banner when ?expired=1 is in URL', () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login?expired=1']}>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    )
    expect(screen.getByText(/session has expired/i)).toBeInTheDocument()
  })

  it('does not show session-expired banner without query param', () => {
    renderPage()
    expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument()
  })

  it('shows generic error when passkey login fails', async () => {
    mockBeginPasskeyLogin.mockResolvedValue({
      outcome: 'error',
      message: 'Sign-in failed. Make sure you have a passkey registered for this account.',
    })

    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'test@test.com')
    await user.click(screen.getByRole('button', { name: /sign in with passkey/i }))

    await waitFor(() => {
      expect(screen.getByText(/sign-in failed/i)).toBeInTheDocument()
    })
  })

  it('shows password fallback when beginPasskeyLogin returns no_passkey', async () => {
    mockBeginPasskeyLogin.mockResolvedValue({ outcome: 'no_passkey' })

    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'test@test.com')
    await user.click(screen.getByRole('button', { name: /sign in with passkey/i }))

    await waitFor(() => {
      expect(screen.getByText(/no passkey found/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/temporary password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in with password/i })).toBeInTheDocument()
    })
  })

  it('submitting with password visible calls loginWithPassword', async () => {
    mockBeginPasskeyLogin.mockResolvedValue({ outcome: 'no_passkey' })
    mockLoginWithPassword.mockResolvedValue({ accessToken: 'tok', refreshToken: 'ref' })

    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'test@test.com')
    await user.click(screen.getByRole('button', { name: /sign in with passkey/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/temporary password/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/temporary password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /sign in with password/i }))

    await waitFor(() => {
      expect(mockLoginWithPassword).toHaveBeenCalledWith('test@test.com', 'secret123')
    })
  })

  it('shows error when loginWithPassword fails', async () => {
    mockBeginPasskeyLogin.mockResolvedValue({ outcome: 'no_passkey' })
    mockLoginWithPassword.mockRejectedValue(new Error('Invalid email or password'))

    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'test@test.com')
    await user.click(screen.getByRole('button', { name: /sign in with passkey/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/temporary password/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/temporary password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in with password/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    })
  })

  it('renders brand hero heading "Inventory Ledger"', () => {
    renderPage()
    expect(screen.getByText('Inventory Ledger')).toBeInTheDocument()
  })

  it('renders tagline beneath the heading', () => {
    renderPage()
    const heading = screen.getByText('Inventory Ledger')
    const tagline = screen.getByText('Your resale business, organized.')
    expect(heading.compareDocumentPosition(tagline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('form card and submit button are present and functional', async () => {
    mockBeginPasskeyLogin.mockResolvedValue({ outcome: 'no_passkey' })
    renderPage()
    const user = userEvent.setup()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    const submitBtn = screen.getByRole('button', { name: /sign in with passkey/i })
    expect(submitBtn).toBeInTheDocument()
    await user.type(screen.getByLabelText(/email/i), 'test@test.com')
    await user.click(submitBtn)
    await waitFor(() => {
      expect(mockBeginPasskeyLogin).toHaveBeenCalledWith('test@test.com')
    })
  })

  it('changing email hides password fallback', async () => {
    mockBeginPasskeyLogin.mockResolvedValue({ outcome: 'no_passkey' })

    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'test@test.com')
    await user.click(screen.getByRole('button', { name: /sign in with passkey/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/temporary password/i)).toBeInTheDocument()
    })

    await user.clear(screen.getByLabelText(/email/i))
    await user.type(screen.getByLabelText(/email/i), 'other@test.com')

    expect(screen.queryByLabelText(/temporary password/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in with passkey/i })).toBeInTheDocument()
  })
})
