import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <AddItemForm businessId="biz1" onItemAdded={mockOnItemAdded} />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

const validItemResponse = {
  id: 'new1',
  businessId: 'biz1',
  name: 'Test Bag',
  brand: null,
  category: null,
  condition: 'GOOD' as const,
  purchasePrice: 100,
  purchaseDate: '2025-01-15T00:00:00Z',
  description: null,
  notes: null,
  status: 'AVAILABLE' as const,
  costEntryPending: false,
  createdAt: '2025-01-15T00:00:00Z',
  updatedAt: '2025-01-15T00:00:00Z',
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

  it('submit with empty name shows validation error beneath the name input', async () => {
    renderForm()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /add item/i }))

    const errorEl = screen.getByTestId('error-name')
    expect(errorEl).toHaveTextContent(/name is required/i)
    // Error is inside the same form-group as the name input
    const nameInput = screen.getByLabelText(/name/i)
    expect(nameInput.parentElement!.contains(errorEl)).toBe(true)
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
      ...validItemResponse,
      name: 'Test Bag',
      brand: 'Gucci',
      category: 'Handbags',
      condition: 'EXCELLENT' as const,
      purchasePrice: 250,
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
    mockCreateItem.mockResolvedValueOnce(validItemResponse)

    renderForm()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/name/i), 'Test Bag')
    await user.clear(screen.getByLabelText(/purchase price/i))
    await user.type(screen.getByLabelText(/purchase price/i), '100')
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

  it('form resets and calls onItemAdded after primary submit', async () => {
    mockCreateItem.mockResolvedValueOnce(validItemResponse)

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

  it('"Save & Add Another" calls API, resets fields, and does NOT call onItemAdded', async () => {
    mockCreateItem.mockResolvedValueOnce(validItemResponse)

    renderForm()
    const user = userEvent.setup()

    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement
    const brandInput = screen.getByLabelText(/brand/i) as HTMLInputElement
    const priceInput = screen.getByLabelText(/purchase price/i) as HTMLInputElement

    await user.type(nameInput, 'Test Bag')
    await user.type(brandInput, 'Gucci')
    await user.clear(priceInput)
    await user.type(priceInput, '100')

    await user.click(screen.getByRole('button', { name: /save & add another/i }))

    await waitFor(() => {
      expect(mockCreateItem).toHaveBeenCalled()
    })

    // Fields reset
    expect(nameInput.value).toBe('')
    expect(brandInput.value).toBe('')
    expect(priceInput.value).toBe('')

    // Panel stays open — onItemAdded NOT called
    expect(mockOnItemAdded).not.toHaveBeenCalled()
  })

  it('name validation error renders immediately after the name input', async () => {
    renderForm()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /add item/i }))

    const nameInput = screen.getByLabelText(/name/i)
    const errorEl = screen.getByTestId('error-name')

    // The error is a sibling of the input, inside the same parent form-group
    expect(nameInput.parentElement).toBe(errorEl.parentElement)
    // The error appears after the input in DOM order
    const children = Array.from(nameInput.parentElement!.children)
    expect(children.indexOf(errorEl)).toBeGreaterThan(children.indexOf(nameInput))
  })
})
