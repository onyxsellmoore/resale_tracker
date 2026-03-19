import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { AddItemForm } from './AddItemForm'

vi.mock('../api/inventoryApi', () => ({
  createItem: vi.fn(),
}))

import { createItem } from '../api/inventoryApi'
const mockCreateItem = vi.mocked(createItem)

const mockOnItemAdded = vi.fn()

function renderForm() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <AddItemForm businessId="biz1" onItemAdded={mockOnItemAdded} />
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('AddItemForm', () => {
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

  it('condition defaults to NEW', () => {
    renderForm()
    const conditionSelect = screen.getByLabelText(/condition/i) as HTMLSelectElement
    expect(conditionSelect.value).toBe('NEW')
  })

  it('condition select includes New option', () => {
    renderForm()
    const conditionSelect = screen.getByLabelText(/condition/i)
    const options = within(conditionSelect).getAllByRole('option')
    const labels = options.map((o) => o.textContent)
    expect(labels).toContain('New')
  })

  it('purchaseDate input has type="date"', () => {
    renderForm()
    const dateInput = screen.getByLabelText(/purchase date/i) as HTMLInputElement
    expect(dateInput.type).toBe('date')
  })

  it('purchaseDate defaults to today formatted as YYYY-MM-DD', () => {
    renderForm()
    const dateInput = screen.getByLabelText(/purchase date/i) as HTMLInputElement
    const today = new Date().toISOString().split('T')[0]
    expect(dateInput.value).toBe(today)
  })

  it('submit with empty name shows validation error', async () => {
    renderForm()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /add item/i }))

    expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    expect(mockCreateItem).not.toHaveBeenCalled()
  })

  it('submit with negative purchasePrice shows validation error', async () => {
    renderForm()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/name/i), 'Test Item')
    await user.clear(screen.getByLabelText(/purchase price/i))
    await user.type(screen.getByLabelText(/purchase price/i), '-10')

    await user.click(screen.getByRole('button', { name: /add item/i }))

    expect(screen.getByText(/price must be.*0/i)).toBeInTheDocument()
    expect(mockCreateItem).not.toHaveBeenCalled()
  })

  it('valid submit calls the create API with correct payload', async () => {
    mockCreateItem.mockResolvedValueOnce({
      id: 'new1',
      businessId: 'biz1',
      name: 'Test Bag',
      brand: 'Gucci',
      category: 'Handbags',
      condition: 'EXCELLENT',
      purchasePrice: 250,
      purchaseDate: '2025-01-15T00:00:00Z',
      description: null,
      notes: null,
      status: 'AVAILABLE',
      createdAt: '2025-01-15T00:00:00Z',
      updatedAt: '2025-01-15T00:00:00Z',
    })

    renderForm()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/name/i), 'Test Bag')
    await user.type(screen.getByLabelText(/brand/i), 'Gucci')
    await user.type(screen.getByLabelText(/category/i), 'Handbags')
    await user.clear(screen.getByLabelText(/purchase price/i))
    await user.type(screen.getByLabelText(/purchase price/i), '250')
    await user.clear(screen.getByLabelText(/purchase date/i))
    await user.type(screen.getByLabelText(/purchase date/i), '2025-01-15')

    await user.click(screen.getByRole('button', { name: /add item/i }))

    await waitFor(() => {
      expect(mockCreateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz1',
          name: 'Test Bag',
          brand: 'Gucci',
          category: 'Handbags',
          purchasePrice: 250,
        }),
        undefined,
      )
    })
  })

  it('valid submit sends purchaseDate as ISO-8601 string', async () => {
    mockCreateItem.mockResolvedValueOnce({
      id: 'new1',
      businessId: 'biz1',
      name: 'Test Bag',
      brand: null,
      category: null,
      condition: 'GOOD',
      purchasePrice: 100,
      purchaseDate: '2025-01-15T00:00:00.000Z',
      description: null,
      notes: null,
      status: 'AVAILABLE',
      createdAt: '2025-01-15T00:00:00Z',
      updatedAt: '2025-01-15T00:00:00Z',
    })

    renderForm()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/name/i), 'Test Bag')
    await user.clear(screen.getByLabelText(/purchase price/i))
    await user.type(screen.getByLabelText(/purchase price/i), '100')
    // Clear the default date and type a specific one
    await user.clear(screen.getByLabelText(/purchase date/i))
    await user.type(screen.getByLabelText(/purchase date/i), '2025-01-15')

    await user.click(screen.getByRole('button', { name: /add item/i }))

    await waitFor(() => {
      const call = mockCreateItem.mock.calls[0][0]
      expect(call.purchaseDate).toMatch(/^2025-01-15T/)
    })
  })

  it('400 response from API displays an error message', async () => {
    mockCreateItem.mockRejectedValueOnce(new Error('Failed to create item'))

    renderForm()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/name/i), 'Test Bag')
    await user.clear(screen.getByLabelText(/purchase price/i))
    await user.type(screen.getByLabelText(/purchase price/i), '100')

    await user.click(screen.getByRole('button', { name: /add item/i }))

    await waitFor(() => {
      expect(screen.getByText(/failed to create item/i)).toBeInTheDocument()
    })
  })

  it('form resets after successful submission', async () => {
    mockCreateItem.mockResolvedValueOnce({
      id: 'new1',
      businessId: 'biz1',
      name: 'Test Bag',
      brand: null,
      category: null,
      condition: 'GOOD',
      purchasePrice: 100,
      purchaseDate: '2025-01-15T00:00:00Z',
      description: null,
      notes: null,
      status: 'AVAILABLE',
      createdAt: '2025-01-15T00:00:00Z',
      updatedAt: '2025-01-15T00:00:00Z',
    })

    renderForm()
    const user = userEvent.setup()

    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement
    await user.type(nameInput, 'Test Bag')
    await user.clear(screen.getByLabelText(/purchase price/i))
    await user.type(screen.getByLabelText(/purchase price/i), '100')

    await user.click(screen.getByRole('button', { name: /add item/i }))

    const today = new Date().toISOString().split('T')[0]
    await waitFor(() => {
      expect(nameInput.value).toBe('')
    })
    const dateInput = screen.getByLabelText(/purchase date/i) as HTMLInputElement
    expect(dateInput.value).toBe(today)
    expect(mockOnItemAdded).toHaveBeenCalled()
  })
})
