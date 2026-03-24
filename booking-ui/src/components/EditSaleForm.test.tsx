import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import { EditSaleForm } from './EditSaleForm'
import type { SaleDTO } from '../types'

vi.mock('../api/salesApi', () => ({
  updateSale: vi.fn(),
}))

import { updateSale } from '../api/salesApi'
const mockUpdateSale = vi.mocked(updateSale)

const testSale: SaleDTO = {
  id: 'sale1',
  businessId: 'biz1',
  itemId: 'item1',
  itemName: 'Gucci Bag',
  itemBrand: 'Gucci',
  platform: 'Poshmark',
  salePrice: 400,
  platformFees: 80,
  netProceeds: 320,
  profit: 70,
  soldAt: '2025-06-01T12:00:00Z',
  platformOrderId: null,
  notes: 'Quick sale',
  createdAt: '2025-06-01T12:00:00Z',
}

const mockOnSuccess = vi.fn()

function renderForm(sale: SaleDTO = testSale) {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <EditSaleForm sale={sale} onSuccess={mockOnSuccess} />
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('EditSaleForm', () => {
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
  })

  it('renders with all editable fields pre-filled', () => {
    renderForm()
    expect(screen.getByLabelText('Platform')).toHaveValue('Poshmark')
    expect(screen.getByLabelText('Sale Price')).toHaveValue(400)
    expect(screen.getByLabelText('Platform Fees')).toHaveValue(80)
    expect(screen.getByLabelText('Date Sold')).toHaveValue('2025-06-01')
    expect(screen.getByLabelText('Notes')).toHaveValue('Quick sale')
  })

  it('submitting calls updateSale with changed values', async () => {
    mockUpdateSale.mockResolvedValueOnce({ ...testSale, platform: 'Mercari' })
    renderForm()
    const user = userEvent.setup()

    const platformInput = screen.getByLabelText('Platform')
    await user.clear(platformInput)
    await user.type(platformInput, 'Mercari')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(mockUpdateSale).toHaveBeenCalledWith(
        'sale1',
        expect.objectContaining({ platform: 'Mercari' }),
        undefined,
      )
    })
    expect(mockOnSuccess).toHaveBeenCalled()
  })

  it('shows error when submission fails', async () => {
    mockUpdateSale.mockRejectedValueOnce(new Error('Failed'))
    renderForm()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument()
    })
  })

  it('calls onSuccess on successful save', async () => {
    mockUpdateSale.mockResolvedValueOnce(testSale)
    renderForm()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled()
    })
  })
})
