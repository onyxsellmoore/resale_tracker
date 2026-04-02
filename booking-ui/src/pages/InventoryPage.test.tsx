import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from '../auth/AuthContext'
import { InventoryPage } from './InventoryPage'

vi.mock('../api/inventoryApi', () => ({
  getItems: vi.fn(),
  createItem: vi.fn(),
  deleteItem: vi.fn(),
  updateItem: vi.fn(),
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
    costEntryPending: false,
  },
]

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

/** Renders InventoryPage with all required providers. */
function renderPage(initialEntries: string[] = ['/inventory']) {
  const token = fakeJwt({ sub: 'u1', orgId: 'org1', role: 'ADMIN' })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LoginThenRender token={token}>
          <MemoryRouter initialEntries={initialEntries}>
            <Routes>
              <Route path="/inventory/*" element={<InventoryPage />} />
            </Routes>
          </MemoryRouter>
        </LoginThenRender>
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

  afterEach(() => {
    vi.useRealTimers()
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

  it('optimistic delete removes item immediately and shows undo toast', async () => {
    renderPage()
    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
    })

    // Click Delete, then confirm
    await user.click(screen.getByRole('button', { name: /delete/i }))
    await user.click(screen.getByRole('button', { name: /yes, delete/i }))

    // Item disappears immediately (optimistic)
    await waitFor(() => {
      expect(screen.queryByText('Gucci Bag')).not.toBeInTheDocument()
    })

    // Toast with Undo appears
    expect(screen.getByText('Item deleted.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument()

    // deleteItem has NOT been called yet
    expect(mockDeleteItem).not.toHaveBeenCalled()
  })

  it('clicking Undo restores the item in the list', async () => {
    renderPage()
    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /delete/i }))
    await user.click(screen.getByRole('button', { name: /yes, delete/i }))

    await waitFor(() => {
      expect(screen.queryByText('Gucci Bag')).not.toBeInTheDocument()
    })

    // Click Undo
    await user.click(screen.getByRole('button', { name: /undo/i }))

    // Item reappears
    await waitFor(() => {
      expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
    })

    // deleteItem was never called
    expect(mockDeleteItem).not.toHaveBeenCalled()
  })

  it('deleteItem is called after 5 seconds if undo is not clicked', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockDeleteItem.mockResolvedValue(undefined)
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
    })

    const deleteBtn = screen.getByRole('button', { name: /delete/i })
    await act(async () => { deleteBtn.click() })

    const confirmBtn = screen.getByRole('button', { name: /yes, delete/i })
    await act(async () => { confirmBtn.click() })

    expect(mockDeleteItem).not.toHaveBeenCalled()

    // Advance past the 5-second undo window
    await act(async () => { vi.advanceTimersByTime(5000) })

    expect(mockDeleteItem).toHaveBeenCalledWith('1', expect.any(String))
  })

  it('cost pending badge visible on imported item', async () => {
    mockGetItems.mockResolvedValue([
      { ...testItems[0], id: '2', name: 'Imported Sneaker', purchasePrice: 0, costEntryPending: true },
    ])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Imported Sneaker')).toBeInTheDocument()
    })
    expect(screen.getByText('Cost Pending')).toBeInTheDocument()
  })

  it('cost pending badge not visible on confirmed item', async () => {
    mockGetItems.mockResolvedValue([
      { ...testItems[0], costEntryPending: false },
    ])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
    })
    expect(screen.queryByText('Cost Pending')).not.toBeInTheDocument()
  })

  it('URL param filter=costPending shows only pending items', async () => {
    mockGetItems.mockResolvedValue([
      { ...testItems[0], id: '1', name: 'Pending A', costEntryPending: true },
      { ...testItems[0], id: '2', name: 'Pending B', costEntryPending: true },
      { ...testItems[0], id: '3', name: 'Confirmed C', costEntryPending: false },
    ])
    renderPage(['/inventory?filter=costPending'])
    await waitFor(() => {
      expect(screen.getByText('Pending A')).toBeInTheDocument()
    })
    expect(screen.getByText('Pending B')).toBeInTheDocument()
    expect(screen.queryByText('Confirmed C')).not.toBeInTheDocument()
  })

  it('import banner shows when imported param present', async () => {
    mockGetItems.mockResolvedValue(testItems)
    renderPage(['/inventory?imported=10&filter=costPending'])
    await waitFor(() => {
      expect(screen.getByText(/10/)).toBeInTheDocument()
    })
    expect(screen.getByText(/imported/i)).toBeInTheDocument()
  })

  it('import banner dismisses and stays dismissed', async () => {
    const mockSessionStorage: Record<string, string> = {}
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => mockSessionStorage[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { mockSessionStorage[key] = val }),
      removeItem: vi.fn((key: string) => { delete mockSessionStorage[key] }),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    })
    mockGetItems.mockResolvedValue(testItems)
    renderPage(['/inventory?imported=10'])
    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByText(/imported/i)).toBeInTheDocument()
    })
    // Dismiss the banner
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/imported/i)).not.toBeInTheDocument()
  })

  it('import banner not shown without param', async () => {
    mockGetItems.mockResolvedValue(testItems)
    renderPage(['/inventory'])
    await waitFor(() => {
      expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
    })
    expect(screen.queryByText(/you imported/i)).not.toBeInTheDocument()
  })
})
