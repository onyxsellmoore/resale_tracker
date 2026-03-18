import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { ProtectedRoute } from './ProtectedRoute'

function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

describe('ProtectedRoute', () => {
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
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockImplementation((key: string) => key === 'auth_token' ? token : null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 1,
      key: vi.fn(),
    })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/users']}>
          <ProtectedRoute requiredRoles={['ADMIN']}>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthProvider>
    )
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('redirects when user role is not in requiredRoles', () => {
    const token = fakeJwt({ sub: 'u1', orgId: 'org1', role: 'BUYER' })
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockImplementation((key: string) => key === 'auth_token' ? token : null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 1,
      key: vi.fn(),
    })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/users']}>
          <ProtectedRoute requiredRoles={['ADMIN']}>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthProvider>
    )
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})
