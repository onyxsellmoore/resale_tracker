import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { OrgSetupPage } from './OrgSetupPage'

vi.mock('../api/authApi', () => ({
  register: vi.fn(),
  beginPasskeyRegistration: vi.fn(),
  completePasskeyRegistration: vi.fn(),
  b64urlToBytes: vi.fn((s: string) => new Uint8Array([1, 2, 3])),
}))

import { register, beginPasskeyRegistration, completePasskeyRegistration } from '../api/authApi'
const mockRegister = vi.mocked(register)
const mockBeginPasskeyRegistration = vi.mocked(beginPasskeyRegistration)
const mockCompletePasskeyRegistration = vi.mocked(completePasskeyRegistration)

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <OrgSetupPage />
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('OrgSetupPage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    })
    mockRegister.mockReset()
    mockBeginPasskeyRegistration.mockReset()
    mockCompletePasskeyRegistration.mockReset()
  })

  it('renders the heading and form fields without password or slug inputs', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /set up your organization/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/organization name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create organization/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/slug/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument()
  })

  it('shows validation errors when submitting empty form', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /create organization/i }))
    expect(screen.getByText(/organization name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/your name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/email is required/i)).toBeInTheDocument()
  })

  it('proceeds to passkey registration on 409 (pre-seeded org)', async () => {
    const fakeToken = [
      btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
      btoa(JSON.stringify({ sub: 'u1', orgId: 'org1', role: 'ADMIN' })),
      'sig',
    ].join('.')

    mockRegister.mockResolvedValue({ status: 409, error: 'Slug taken' })

    mockBeginPasskeyRegistration.mockResolvedValue({
      challenge: 'test-challenge',
      rp: { id: 'localhost', name: 'Test' },
      user: { id: 'dTEx', name: 'jane@test.com', displayName: 'Jane' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      timeout: 60000,
    })

    const mockCredential = {
      rawId: new ArrayBuffer(32),
      response: {
        attestationObject: new ArrayBuffer(100),
        clientDataJSON: new ArrayBuffer(50),
      },
    }
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockResolvedValue(mockCredential),
      },
    })

    mockCompletePasskeyRegistration.mockResolvedValue({
      accessToken: fakeToken,
      refreshToken: 'rt1',
    })

    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/organization name/i), 'Existing Org')
    await user.type(screen.getByLabelText(/your name/i), 'Jane')
    await user.type(screen.getByLabelText(/email/i), 'jane@test.com')
    await user.click(screen.getByRole('button', { name: /create organization/i }))

    await waitFor(() => {
      expect(screen.getByText(/organization found/i)).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(mockBeginPasskeyRegistration).toHaveBeenCalledWith('jane@test.com')
    })
  })

  it('calls register then passkey flow on success', async () => {
    const fakeToken = [
      btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
      btoa(JSON.stringify({ sub: 'u1', orgId: 'org1', role: 'ADMIN' })),
      'sig',
    ].join('.')

    mockRegister.mockResolvedValue({
      data: { orgId: 'org1', userId: 'u1', role: 'ADMIN' },
      status: 201,
    })

    mockBeginPasskeyRegistration.mockResolvedValue({
      challenge: 'test-challenge',
      rp: { id: 'localhost', name: 'Test' },
      user: { id: 'dTEx', name: 'jane@test.com', displayName: 'Jane' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      timeout: 60000,
    })

    // Mock navigator.credentials.create
    const mockCredential = {
      rawId: new ArrayBuffer(32),
      response: {
        attestationObject: new ArrayBuffer(100),
        clientDataJSON: new ArrayBuffer(50),
      },
    }
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockResolvedValue(mockCredential),
      },
    })

    mockCompletePasskeyRegistration.mockResolvedValue({
      accessToken: fakeToken,
      refreshToken: 'rt1',
    })

    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/organization name/i), 'New Org')
    await user.type(screen.getByLabelText(/your name/i), 'Jane')
    await user.type(screen.getByLabelText(/email/i), 'jane@test.com')
    await user.click(screen.getByRole('button', { name: /create organization/i }))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        orgName: 'New Org',
        orgSlug: 'new-org',
        adminEmail: 'jane@test.com',
        adminDisplayName: 'Jane',
      })
    })

    await waitFor(() => {
      expect(mockBeginPasskeyRegistration).toHaveBeenCalledWith('jane@test.com')
    })
  })
})
