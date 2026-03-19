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
})
