import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { SalesPage } from './SalesPage'

vi.mock('../api/salesApi', () => ({
  getSales: vi.fn(),
  createSale: vi.fn(),
  deleteSale: vi.fn(),
}))

vi.mock('../api/inventoryApi', () => ({
  getItems: vi.fn(),
  createItem: vi.fn(),
}))

import { getSales } from '../api/salesApi'
import { getItems } from '../api/inventoryApi'
const mockGetSales = vi.mocked(getSales)
const mockGetItems = vi.mocked(getItems)

function renderPage(initialEntries = ['/sales/new']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/sales/*" element={<SalesPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('SalesPage', () => {
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
    mockGetSales.mockResolvedValue([])
    mockGetItems.mockResolvedValue([])
  })

  it('Record a Sale view has an Import Sales link', async () => {
    renderPage(['/sales/new'])
    await waitFor(() => {
      expect(screen.getByText(/import sales/i)).toBeInTheDocument()
    })
  })

  it('Record a Sale view has Back to Sales link', async () => {
    renderPage(['/sales/new'])
    await waitFor(() => {
      expect(screen.getByText(/back to sales/i)).toBeInTheDocument()
    })
  })

  it('Import Sales and Record a Sale buttons both have the btn-action class', async () => {
    renderPage(['/sales'])
    await waitFor(() => {
      const importBtn = screen.getByRole('button', { name: /import sales/i })
      const recordBtn = screen.getByRole('button', { name: /record a sale/i })
      expect(importBtn.className).toContain('btn-action')
      expect(recordBtn.className).toContain('btn-action')
    })
  })

  it('sale with cost pending item shows estimated profit indicator', async () => {
    mockGetSales.mockResolvedValue([
      {
        id: 's1', businessId: 'biz1', itemId: 'i1', itemName: 'Air Max 90', itemBrand: 'Nike',
        platform: 'eBay', salePrice: 75.00, platformFees: 9.75, netProceeds: 65.25,
        profit: 65.25, soldAt: '2025-06-15T00:00:00Z', platformOrderId: null, notes: null,
        createdAt: '2025-06-15T00:00:00Z', costEntryPending: true,
      },
    ])
    renderPage(['/sales'])
    await waitFor(() => {
      expect(screen.getByTestId('profit-s1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('profit-s1').textContent).toMatch(/\$65\.25/)
    expect(screen.getByText(/est\./i)).toBeInTheDocument()
  })

  it('sale with confirmed cost shows real profit, no indicator', async () => {
    mockGetSales.mockResolvedValue([
      {
        id: 's2', businessId: 'biz1', itemId: 'i2', itemName: 'Gucci Bag', itemBrand: 'Gucci',
        platform: 'Poshmark', salePrice: 300.00, platformFees: 60.00, netProceeds: 240.00,
        profit: 15.25, soldAt: '2025-06-15T00:00:00Z', platformOrderId: null, notes: null,
        createdAt: '2025-06-15T00:00:00Z', costEntryPending: false,
      },
    ])
    renderPage(['/sales'])
    await waitFor(() => {
      expect(screen.getByTestId('profit-s2')).toBeInTheDocument()
    })
    expect(screen.getByTestId('profit-s2').textContent).toMatch(/\$15\.25/)
    expect(screen.queryByText(/est\./i)).not.toBeInTheDocument()
  })

  it('profit is always visible, never a dash', async () => {
    mockGetSales.mockResolvedValue([
      {
        id: 's1', businessId: 'biz1', itemId: 'i1', itemName: 'Item A', itemBrand: null,
        platform: 'eBay', salePrice: 50.00, platformFees: 5.00, netProceeds: 45.00,
        profit: 45.00, soldAt: '2025-06-15T00:00:00Z', platformOrderId: null, notes: null,
        createdAt: '2025-06-15T00:00:00Z', costEntryPending: true,
      },
      {
        id: 's2', businessId: 'biz1', itemId: 'i2', itemName: 'Item B', itemBrand: null,
        platform: 'eBay', salePrice: 100.00, platformFees: 10.00, netProceeds: 90.00,
        profit: 20.00, soldAt: '2025-06-15T00:00:00Z', platformOrderId: null, notes: null,
        createdAt: '2025-06-15T00:00:00Z', costEntryPending: false,
      },
    ])
    renderPage(['/sales'])
    await waitFor(() => {
      expect(screen.getByText('Item A')).toBeInTheDocument()
    })
    // No dash should appear for any profit cell
    const profitCells = screen.getAllByTestId(/^profit-/)
    for (const cell of profitCells) {
      expect(cell.textContent).not.toBe('—')
      expect(cell.textContent).toMatch(/\$/)
    }
  })
})
