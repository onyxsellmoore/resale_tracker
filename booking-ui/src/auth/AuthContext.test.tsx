import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

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

describe('AuthContext', () => {
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
