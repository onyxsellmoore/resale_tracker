import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth, isTokenExpired, _resetTokenForTest } from './AuthContext'

// Helper to create a fake JWT with given payload
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.fake-signature`
}

function TestConsumer() {
  const { token, userId, orgId, role, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="token">{token ?? 'none'}</span>
      <span data-testid="userId">{userId ?? 'none'}</span>
      <span data-testid="orgId">{orgId ?? 'none'}</span>
      <span data-testid="role">{role ?? 'none'}</span>
      <button onClick={() => login(fakeJwt({ sub: 'u1', orgId: 'org1', role: 'ADMIN' }))}>
        Login
      </button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  )
}

describe('isTokenExpired', () => {
  it('returns true when exp is in the past', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 60
    const token = fakeJwt({ sub: 'u1', exp: pastExp })
    expect(isTokenExpired(token)).toBe(true)
  })

  it('returns false when exp is in the future', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const token = fakeJwt({ sub: 'u1', exp: futureExp })
    expect(isTokenExpired(token)).toBe(false)
  })

  it('returns false for malformed token (no exp parsed)', () => {
    expect(isTokenExpired('not-a-jwt')).toBe(false)
  })

  it('returns false when token has no exp claim', () => {
    const token = fakeJwt({ sub: 'u1' })
    expect(isTokenExpired(token)).toBe(false)
  })
})

describe('AuthContext (in-memory token storage)', () => {
  beforeEach(() => { _resetTokenForTest() })

  it('starts with no token on fresh mount', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('token').textContent).toBe('none')
  })

  it('does not use localStorage', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem')
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    const user = userEvent.setup()
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )
    await user.click(screen.getByText('Login'))

    expect(getItemSpy).not.toHaveBeenCalledWith('auth_token')
    expect(setItemSpy).not.toHaveBeenCalledWith('auth_token', expect.anything())

    getItemSpy.mockRestore()
    setItemSpy.mockRestore()
  })
})

describe('AuthContext', () => {
  beforeEach(() => { _resetTokenForTest() })

  it('storesRoleAfterSuccessfulLogin', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )
    expect(screen.getByTestId('role')).toHaveTextContent('none')
    await user.click(screen.getByText('Login'))
    expect(screen.getByTestId('role')).toHaveTextContent('ADMIN')
  })

  it('storesOrgIdAfterSuccessfulLogin', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )
    expect(screen.getByTestId('orgId')).toHaveTextContent('none')
    await user.click(screen.getByText('Login'))
    expect(screen.getByTestId('orgId')).toHaveTextContent('org1')
  })

  it('exposesBothToConsumers', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )
    await user.click(screen.getByText('Login'))
    expect(screen.getByTestId('userId')).toHaveTextContent('u1')
    expect(screen.getByTestId('orgId')).toHaveTextContent('org1')
    expect(screen.getByTestId('role')).toHaveTextContent('ADMIN')
    expect(screen.getByTestId('token')).not.toHaveTextContent('none')
  })

  it('clearsRoleAndOrgIdOnLogout', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )
    await user.click(screen.getByText('Login'))
    expect(screen.getByTestId('role')).toHaveTextContent('ADMIN')

    await user.click(screen.getByText('Logout'))
    expect(screen.getByTestId('role')).toHaveTextContent('none')
    expect(screen.getByTestId('orgId')).toHaveTextContent('none')
    expect(screen.getByTestId('token')).toHaveTextContent('none')
  })
})
