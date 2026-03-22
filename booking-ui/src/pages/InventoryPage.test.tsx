import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { InventoryPage } from './InventoryPage'

vi.mock('../api/inventoryApi', () => ({
  getItems: vi.fn(),
  createItem: vi.fn(),
  deleteItem: vi.fn(),
}))

import { getItems, deleteItem } from '../api/inventoryApi'
const mockGetItems = vi.mocked(getItems)
const mockDeleteItem = vi.mocked(deleteItem)

const testItems = [
  {
    id: '1', businessId: 'biz1', name: 'Gucci Bag', brand: 'Gucci', category: 'Handbags',
    condition: 'EXCELLENT' as const, purchasePrice: 250, purchaseDate: '2025-01-15T00:00:00Z',
    description: null, notes: null, status: 'AVAILABLE' as const,
    createdAt: '2025-01-15T00:00:00Z', updatedAt: '2025-01-15T00:00:00Z',
  },
]

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <InventoryPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('InventoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    })
    mockGetItems.mockResolvedValue(testItems)
  })

  it('Add Item form is hidden by default', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
    })
    expect(screen.queryByText('Add Item', { selector: 'h2' })).not.toBeInTheDocument()
  })

  it('clicking "Add Item" button shows the form', async () => {
    renderPage()
    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /add item/i }))
    expect(screen.getByText('Add Item', { selector: 'h2' })).toBeInTheDocument()
  })

  it('clicking "Hide Form" button hides the form', async () => {
    renderPage()
    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
    })
    // Show the form
    await user.click(screen.getByRole('button', { name: /add item/i }))
    expect(screen.getByText('Add Item', { selector: 'h2' })).toBeInTheDocument()
    // Hide the form
    await user.click(screen.getByRole('button', { name: /hide form/i }))
    expect(screen.queryByText('Add Item', { selector: 'h2' })).not.toBeInTheDocument()
  })

  it('delete button shows confirmation then calls deleteItem', async () => {
    mockDeleteItem.mockResolvedValue(undefined)
    renderPage()
    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
    })
    const deleteBtn = screen.getByRole('button', { name: /delete/i })
    await user.click(deleteBtn)

    // Should show confirmation, not call deleteItem yet
    expect(mockDeleteItem).not.toHaveBeenCalled()
    expect(screen.getByText(/permanently delete/i)).toBeInTheDocument()

    // Confirm the deletion
    await user.click(screen.getByRole('button', { name: /yes, delete/i }))

    await waitFor(() => {
      expect(mockDeleteItem).toHaveBeenCalledWith('1', undefined)
    })
  })
})
