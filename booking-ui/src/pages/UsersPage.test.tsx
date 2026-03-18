import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { UsersPage } from './UsersPage'

vi.mock('../api/usersApi', () => ({
  getUsers: vi.fn(),
  createUser: vi.fn(),
}))

import { getUsers } from '../api/usersApi'
const mockGetUsers = vi.mocked(getUsers)

function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

function renderPage() {
  const token = fakeJwt({ sub: 'u1', orgId: 'org1', role: 'ADMIN' })
  vi.stubGlobal('localStorage', {
    getItem: vi.fn().mockImplementation((key: string) => key === 'auth_token' ? token : null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 1,
    key: vi.fn(),
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <UsersPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('UsersPage', () => {
  beforeEach(() => {
    mockGetUsers.mockReset()
  })

  it('renders heading and Add User button', async () => {
    mockGetUsers.mockResolvedValue([])
    renderPage()
    expect(screen.getByRole('heading', { name: /team members/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument()
  })

  it('shows loading skeleton while fetching', () => {
    mockGetUsers.mockReturnValue(new Promise(() => {})) // never resolves
    renderPage()
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
  })

  it('displays users in table after loading', async () => {
    mockGetUsers.mockResolvedValue([
      { id: '1', email: 'alice@test.com', displayName: 'Alice', role: 'ADMIN', orgId: 'org1', createdAt: '2025-01-15T00:00:00Z' },
      { id: '2', email: 'bob@test.com', displayName: 'Bob', role: 'SELLER', orgId: 'org1', createdAt: '2025-02-20T00:00:00Z' },
    ])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('alice@test.com')).toBeInTheDocument()
    expect(screen.getByText('ADMIN')).toBeInTheDocument()
    expect(screen.getByText('SELLER')).toBeInTheDocument()
  })

  it('shows empty state when no users', async () => {
    mockGetUsers.mockResolvedValue([])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/no team members yet/i)).toBeInTheDocument()
    })
  })

  it('shows error message when fetch fails', async () => {
    mockGetUsers.mockRejectedValue(new Error('Network error'))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/failed to load users/i)).toBeInTheDocument()
    })
  })

  it('clicking Add User shows the create user form', async () => {
    mockGetUsers.mockResolvedValue([])
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /add user/i }))
    expect(screen.getByRole('heading', { name: /add team member/i })).toBeInTheDocument()
  })
})
