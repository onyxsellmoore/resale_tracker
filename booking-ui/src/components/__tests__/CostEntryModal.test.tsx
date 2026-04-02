import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from '../../auth/AuthContext'
import { CostEntryModal } from '../CostEntryModal'
import type { ItemDTO } from '../../types'

vi.mock('../../api/inventoryApi', () => ({
  updateItem: vi.fn(),
}))

import { updateItem } from '../../api/inventoryApi'
const mockUpdateItem = vi.mocked(updateItem)

/** Creates a fake JWT for test auth context. */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

/** Logs in before rendering children so useAuth() has a valid token/role. */
function LoginThenRender({ token, children }: { token: string; children: React.ReactNode }) {
  const { login } = useAuth()
  useEffect(() => { login(token) }, [token, login])
  return <>{children}</>
}

/** Builds a test item with costEntryPending=true. */
function testItem(overrides: Partial<ItemDTO> = {}): ItemDTO {
  return {
    id: 'abc',
    businessId: 'biz1',
    name: 'Air Max 90',
    brand: 'Nike',
    category: 'Shoes',
    condition: 'EXCELLENT',
    purchasePrice: 0,
    purchaseDate: '',
    description: null,
    notes: null,
    status: 'SOLD',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    costEntryPending: true,
    ...overrides,
  }
}

const mockOnClose = vi.fn()
let mockInvalidateQueries: ReturnType<typeof vi.fn>

/** Renders CostEntryModal with all required providers and tracks invalidateQueries calls. */
function renderModal(item: ItemDTO = testItem()) {
  const token = fakeJwt({ sub: 'u1', orgId: 'org1', role: 'ADMIN' })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  mockInvalidateQueries = vi.fn()
  const origInvalidate = queryClient.invalidateQueries.bind(queryClient)
  queryClient.invalidateQueries = (...args: Parameters<typeof origInvalidate>) => {
    mockInvalidateQueries(...args)
    return origInvalidate(...args)
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LoginThenRender token={token}>
          <MemoryRouter>
            <CostEntryModal item={item} onClose={mockOnClose} />
          </MemoryRouter>
        </LoginThenRender>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('CostEntryModal', () => {
  beforeEach(() => {
    mockUpdateItem.mockReset()
    mockOnClose.mockReset()
  })

  it('renders item name and required inputs', () => {
    renderModal()
    expect(screen.getByText(/Air Max 90/)).toBeInTheDocument()
    expect(screen.getByLabelText('Purchase Price')).toBeInTheDocument()
    expect(screen.getByLabelText('Purchase Date')).toBeInTheDocument()
  })

  it('submit calls PATCH with both fields', async () => {
    mockUpdateItem.mockResolvedValue(testItem({ costEntryPending: false, purchasePrice: 50 }))
    renderModal()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Purchase Price'), '50')
    await user.type(screen.getByLabelText('Purchase Date'), '2024-01-15')
    await user.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(mockUpdateItem).toHaveBeenCalledWith(
        'abc',
        { purchasePrice: 50, purchaseDate: '2024-01-15' },
        expect.any(String),
      )
    })
  })

  it('submit invalidates items, sales, and analytics cache', async () => {
    mockUpdateItem.mockResolvedValue(testItem({ costEntryPending: false }))
    renderModal()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Purchase Price'), '50')
    await user.type(screen.getByLabelText('Purchase Date'), '2024-01-15')
    await user.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled()
    })
    const keys = mockInvalidateQueries.mock.calls.map(
      (call: [{ queryKey: string[] }]) => call[0].queryKey[0],
    )
    expect(keys).toContain('items')
    expect(keys).toContain('sales')
    expect(keys).toContain('analytics')
  })

  it('submit success closes modal', async () => {
    mockUpdateItem.mockResolvedValue(testItem({ costEntryPending: false }))
    renderModal()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Purchase Price'), '50')
    await user.type(screen.getByLabelText('Purchase Date'), '2024-01-15')
    await user.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('submit with missing price shows error, no API call', async () => {
    renderModal()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Purchase Date'), '2024-01-15')
    await user.click(screen.getByRole('button', { name: /save/i }))
    expect(screen.getByText(/purchase price is required/i)).toBeInTheDocument()
    expect(mockUpdateItem).not.toHaveBeenCalled()
  })

  it('submit with missing date shows error, no API call', async () => {
    renderModal()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Purchase Price'), '50')
    await user.click(screen.getByRole('button', { name: /save/i }))
    expect(screen.getByText(/purchase date is required/i)).toBeInTheDocument()
    expect(mockUpdateItem).not.toHaveBeenCalled()
  })

  it('clicking backdrop calls onClose', async () => {
    renderModal()
    const user = userEvent.setup()
    const backdrop = screen.getByRole('dialog').parentElement!
    await user.click(backdrop)
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('submit with negative purchase price shows error, no API call', async () => {
    renderModal()
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText('Purchase Price'))
    await user.type(screen.getByLabelText('Purchase Price'), '-5')
    await user.type(screen.getByLabelText('Purchase Date'), '2024-01-15')
    await user.click(screen.getByRole('button', { name: /save/i }))
    expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument()
    expect(mockUpdateItem).not.toHaveBeenCalled()
  })

  it('submit with zero purchase price is allowed', async () => {
    mockUpdateItem.mockResolvedValue(testItem({ purchasePrice: 0, costEntryPending: false }))
    renderModal()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Purchase Price'), '0')
    await user.type(screen.getByLabelText('Purchase Date'), '2024-01-15')
    await user.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(mockUpdateItem).toHaveBeenCalled()
    })
  })

  it('submit API error shows error message, modal remains open', async () => {
    mockUpdateItem.mockRejectedValue(new Error('Server error'))
    renderModal()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Purchase Price'), '50')
    await user.type(screen.getByLabelText('Purchase Date'), '2024-01-15')
    await user.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument()
    })
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('submit button disabled while pending', async () => {
    mockUpdateItem.mockReturnValue(new Promise(() => {})) // never resolves
    renderModal()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Purchase Price'), '50')
    await user.type(screen.getByLabelText('Purchase Date'), '2024-01-15')
    await user.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
    })
  })
})
