import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { AuthProvider, useAuth } from '../auth/AuthContext'
import { ProtectedRoute } from './ProtectedRoute'
import { useEffect } from 'react'

function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

function LoginThenRender({ token, children }: { token: string; children: React.ReactNode }) {
  const { login } = useAuth()
  useEffect(() => { login(token) }, [token, login])
  return <>{children}</>
}

describe('ProtectedRoute', () => {
  it('redirects to /login when no token is present', () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/inventory']}>
          <ProtectedRoute requiredRoles={['ADMIN']}>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthProvider>
    )
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('renders children when user has a matching role', () => {
    const token = fakeJwt({ sub: 'u1', orgId: 'org1', role: 'ADMIN' })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/users']}>
          <LoginThenRender token={token}>
            <ProtectedRoute requiredRoles={['ADMIN']}>
              <div>Protected Content</div>
            </ProtectedRoute>
          </LoginThenRender>
        </MemoryRouter>
      </AuthProvider>
    )
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('redirects when user role is not in requiredRoles', () => {
    const token = fakeJwt({ sub: 'u1', orgId: 'org1', role: 'BUYER' })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/users']}>
          <LoginThenRender token={token}>
            <ProtectedRoute requiredRoles={['ADMIN']}>
              <div>Protected Content</div>
            </ProtectedRoute>
          </LoginThenRender>
        </MemoryRouter>
      </AuthProvider>
    )
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})
