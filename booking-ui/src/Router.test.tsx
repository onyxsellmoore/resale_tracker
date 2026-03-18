import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthProvider } from './auth/AuthContext'
import { AppRoutes } from './AppRoutes'

function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

function renderWithRouter(initialRoute: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('Router', () => {
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

  it('navigating to / redirects to /login', () => {
    renderWithRouter('/')
    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument()
  })

  it('navigating to /analytics when no auth token redirects to /login', () => {
    renderWithRouter('/analytics')
    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument()
  })

  it('navigating to /inventory when no auth token redirects to /login', () => {
    renderWithRouter('/inventory')
    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument()
  })

  it('after login, the user lands on /analytics', () => {
    const token = fakeJwt({ sub: 'u1', orgId: 'org1', role: 'ADMIN' })
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockImplementation((key: string) => key === 'auth_token' ? token : null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 1,
      key: vi.fn(),
    })
    renderWithRouter('/analytics')
    expect(screen.queryByRole('heading', { name: /login/i })).not.toBeInTheDocument()
  })
})
