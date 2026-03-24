import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { AppRoutes } from './AppRoutes'

function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

function LoginThenRender({ token, children }: { token: string; children: React.ReactNode }) {
  const { login, token: currentToken } = useAuth()
  useEffect(() => { login(token) }, [token, login])
  if (!currentToken) return null
  return <>{children}</>
}

function renderWithRouter(initialRoute: string, token?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const content = (
    <MemoryRouter initialEntries={[initialRoute]}>
      <AppRoutes />
    </MemoryRouter>
  )
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {token ? <LoginThenRender token={token}>{content}</LoginThenRender> : content}
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('Router', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
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

  it('after login, the user lands on /analytics', async () => {
    const token = fakeJwt({ sub: 'u1', orgId: 'org1', role: 'ADMIN' })
    renderWithRouter('/analytics', token)
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /login/i })).not.toBeInTheDocument()
    })
  })
})
