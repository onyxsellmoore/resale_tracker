import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { CreateUserForm } from './CreateUserForm'

vi.mock('../api/usersApi', () => ({
  getUsers: vi.fn(),
  createUser: vi.fn(),
}))

import { createUser } from '../api/usersApi'
const mockCreateUser = vi.mocked(createUser)

function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

function renderForm(onClose = vi.fn()) {
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
  return {
    onClose,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <CreateUserForm onClose={onClose} />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    ),
  }
}

describe('CreateUserForm', () => {
  beforeEach(() => {
    mockCreateUser.mockReset()
  })

  it('renders all form fields and buttons', () => {
    renderForm()
    expect(screen.getByRole('heading', { name: /add team member/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/temporary password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('shows validation errors for empty submission', async () => {
    renderForm()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /create user/i }))
    expect(screen.getByText(/display name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    expect(screen.getByText(/password is required/i)).toBeInTheDocument()
  })

  it('shows error for short password', async () => {
    renderForm()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/display name/i), 'Test User')
    await user.type(screen.getByLabelText(/email/i), 'test@test.com')
    await user.type(screen.getByLabelText(/temporary password/i), 'short')
    await user.click(screen.getByRole('button', { name: /create user/i }))
    expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument()
  })

  it('calls createUser with correct payload on valid submission', async () => {
    mockCreateUser.mockResolvedValue({
      data: { id: 'u2', email: 'new@test.com', displayName: 'New User', role: 'SELLER', orgId: 'org1', createdAt: '2025-01-01T00:00:00Z' },
      status: 201,
    })
    renderForm()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/display name/i), 'New User')
    await user.type(screen.getByLabelText(/email/i), 'new@test.com')
    await user.type(screen.getByLabelText(/temporary password/i), 'password123')
    await user.selectOptions(screen.getByLabelText(/role/i), 'SELLER')
    await user.click(screen.getByRole('button', { name: /create user/i }))

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith(
        { displayName: 'New User', email: 'new@test.com', password: 'password123', role: 'SELLER' },
        expect.any(String)
      )
    })
  })

  it('shows success toast after creating a user', async () => {
    mockCreateUser.mockResolvedValue({
      data: { id: 'u2', email: 'new@test.com', displayName: 'New User', role: 'BUYER', orgId: 'org1', createdAt: '2025-01-01T00:00:00Z' },
      status: 201,
    })
    renderForm()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/display name/i), 'New User')
    await user.type(screen.getByLabelText(/email/i), 'new@test.com')
    await user.type(screen.getByLabelText(/temporary password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create user/i }))

    await waitFor(() => {
      expect(screen.getByText(/user created/i)).toBeInTheDocument()
    })
  })

  it('shows error on API failure', async () => {
    mockCreateUser.mockResolvedValue({ error: 'Email already exists', status: 409 })
    renderForm()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/display name/i), 'New User')
    await user.type(screen.getByLabelText(/email/i), 'dupe@test.com')
    await user.type(screen.getByLabelText(/temporary password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create user/i }))

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument()
    })
  })

  it('calls onClose when cancel is clicked', async () => {
    const { onClose } = renderForm()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
