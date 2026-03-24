import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import { EditItemForm } from './EditItemForm'
import type { ItemDTO } from '../types'

vi.mock('../api/inventoryApi', () => ({
  updateItem: vi.fn(),
}))

import { updateItem } from '../api/inventoryApi'
const mockUpdateItem = vi.mocked(updateItem)

const testItem: ItemDTO = {
  id: 'item1',
  businessId: 'biz1',
  name: 'Gucci Bag',
  brand: 'Gucci',
  category: 'Handbags',
  condition: 'EXCELLENT',
  purchasePrice: 250.0,
  purchaseDate: '2025-01-15T00:00:00Z',
  description: 'Vintage leather',
  notes: 'Slight patina',
  status: 'AVAILABLE',
  createdAt: '2025-01-15T00:00:00Z',
  updatedAt: '2025-01-15T00:00:00Z',
}

const mockOnItemUpdated = vi.fn()

function renderForm(item: ItemDTO = testItem) {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <EditItemForm item={item} onItemUpdated={mockOnItemUpdated} />
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('EditItemForm', () => {
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

  it('renders with all fields pre-filled from the provided item prop', () => {
    renderForm()
    expect(screen.getByLabelText('Name')).toHaveValue('Gucci Bag')
    expect(screen.getByLabelText('Brand')).toHaveValue('Gucci')
    expect(screen.getByLabelText('Category')).toHaveValue('Handbags')
    expect(screen.getByLabelText('Condition')).toHaveValue('EXCELLENT')
    expect(screen.getByLabelText('Purchase Price')).toHaveValue(250)
    expect(screen.getByLabelText('Purchase Date')).toHaveValue('2025-01-15')
    expect(screen.getByLabelText('Description')).toHaveValue('Vintage leather')
    expect(screen.getByLabelText('Notes')).toHaveValue('Slight patina')
  })

  it('submitting calls updateItem with changed values', async () => {
    mockUpdateItem.mockResolvedValueOnce({ ...testItem, name: 'Updated Bag' })
    renderForm()
    const user = userEvent.setup()

    const nameInput = screen.getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Bag')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(mockUpdateItem).toHaveBeenCalledWith(
        'item1',
        expect.objectContaining({ name: 'Updated Bag' }),
        undefined,
      )
    })
    expect(mockOnItemUpdated).toHaveBeenCalled()
  })

  it('shows error when submission fails', async () => {
    mockUpdateItem.mockRejectedValueOnce(new Error('Failed'))
    renderForm()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByText(/failed to update item/i)).toBeInTheDocument()
    })
  })

  it('calls onItemUpdated on success', async () => {
    mockUpdateItem.mockResolvedValueOnce(testItem)
    renderForm()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(mockOnItemUpdated).toHaveBeenCalled()
    })
  })
})
