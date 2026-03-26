import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import { RecordSaleForm } from './RecordSaleForm'
import type { ItemDTO } from '../types'

vi.mock('../api/salesApi', () => ({
  createSale: vi.fn(),
}))

import { createSale } from '../api/salesApi'
const mockCreateSale = vi.mocked(createSale)

const availableItems: ItemDTO[] = [
  {
    id: 'item1',
    businessId: 'biz1',
    name: 'Gucci Bag',
    brand: 'Gucci',
    category: 'Handbags',
    condition: 'EXCELLENT',
    purchasePrice: 250.0,
    purchaseDate: '2025-01-15T00:00:00Z',
    description: null,
    notes: null,
    status: 'AVAILABLE',
    createdAt: '2025-01-15T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z',
  },
  {
    id: 'item2',
    businessId: 'biz1',
    name: 'Prada Shoes',
    brand: 'Prada',
    category: 'Shoes',
    condition: 'GOOD',
    purchasePrice: 100.0,
    purchaseDate: '2025-02-10T00:00:00Z',
    description: null,
    notes: null,
    status: 'AVAILABLE',
    createdAt: '2025-02-10T00:00:00Z',
    updatedAt: '2025-02-10T00:00:00Z',
  },
  {
    id: 'item3',
    businessId: 'biz1',
    name: 'LV Wallet',
    brand: '',
    category: 'Accessories',
    condition: 'GOOD',
    purchasePrice: 75.0,
    purchaseDate: '2025-03-01T00:00:00Z',
    description: null,
    notes: null,
    status: 'AVAILABLE',
    createdAt: '2025-03-01T00:00:00Z',
    updatedAt: '2025-03-01T00:00:00Z',
  },
]

const soldItem: ItemDTO = {
  id: 'item4',
  businessId: 'biz1',
  name: 'Sold Thing',
  brand: 'Nike',
  category: 'Shoes',
  condition: 'FAIR',
  purchasePrice: 50.0,
  purchaseDate: '2025-01-01T00:00:00Z',
  description: null,
  notes: null,
  status: 'SOLD',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-03-01T00:00:00Z',
}

const mockOnSuccess = vi.fn()

function renderForm(items: ItemDTO[] = availableItems, preselectedItemId?: string) {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <RecordSaleForm
          businessId="biz1"
          items={items}
          onSuccess={mockOnSuccess}
          preselectedItemId={preselectedItemId}
        />
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('RecordSaleForm', () => {
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

  it('shows empty state when no available items exist', () => {
    renderForm([])
    expect(screen.getByText(/no items in inventory yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to inventory/i })).toHaveAttribute('href', '/inventory')
    expect(screen.queryByRole('button', { name: /record sale/i })).not.toBeInTheDocument()
  })

  it('shows empty state when only sold items exist', () => {
    renderForm([soldItem])
    expect(screen.getByText(/no items in inventory yet/i)).toBeInTheDocument()
  })

  it('shows the form when available items exist', () => {
    renderForm(availableItems)
    expect(screen.queryByText(/no items in inventory yet/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /record sale/i })).toBeInTheDocument()
  })

  // --- Task 2: Item Picker tests ---

  it('item picker renders all available items with correct labels', () => {
    renderForm(availableItems)
    const itemSelect = screen.getByLabelText('Item')
    const options = Array.from(itemSelect.querySelectorAll('option'))
    // First option is placeholder
    expect(options[0]).toHaveTextContent('Select an item…')
    // "name (brand)" for items with brand, just "name" for items without
    expect(options[1]).toHaveTextContent('Gucci Bag (Gucci)')
    expect(options[2]).toHaveTextContent('Prada Shoes (Prada)')
    expect(options[3]).toHaveTextContent('LV Wallet')
  })

  it('item picker shows "No available items" when list is empty and submit is disabled', () => {
    renderForm([])
    // Empty state is shown instead
    expect(screen.getByText(/no items in inventory yet/i)).toBeInTheDocument()
  })

  it('selecting an item updates the form itemId state', async () => {
    renderForm(availableItems)
    const user = userEvent.setup()
    const itemSelect = screen.getByLabelText('Item')
    await user.selectOptions(itemSelect, 'item1')

    // Verify profit preview shows (confirms item was selected)
    const salePriceInput = screen.getByLabelText(/sale price/i)
    await user.clear(salePriceInput)
    await user.type(salePriceInput, '400')
    await waitFor(() => {
      expect(screen.getByTestId('profit-preview')).toHaveTextContent('$150.00')
    })
  })

  it('submit is disabled until an item is selected', async () => {
    renderForm(availableItems)
    const submitBtn = screen.getByRole('button', { name: /record sale/i })
    // Submit should not call API when no item is selected
    const user = userEvent.setup()
    await user.click(submitBtn)
    expect(screen.getByText(/please select an item/i)).toBeInTheDocument()
    expect(mockCreateSale).not.toHaveBeenCalled()
  })

  // --- Task 3: Platform Dropdown tests ---

  it('platform dropdown renders default four options', () => {
    renderForm(availableItems)
    const platformSelect = screen.getByLabelText('Platform')
    const options = Array.from(platformSelect.querySelectorAll('option'))
    const optionTexts = options.map(o => o.textContent)
    expect(optionTexts).toContain('Vestiaire')
    expect(optionTexts).toContain('Poshmark')
    expect(optionTexts).toContain('Ebay')
    expect(optionTexts).toContain('Mercari')
  })

  it('platform dropdown has "＋ Add new platform…" option', () => {
    renderForm(availableItems)
    const platformSelect = screen.getByLabelText('Platform')
    const options = Array.from(platformSelect.querySelectorAll('option'))
    const addOption = options.find(o => o.textContent?.includes('Add new platform'))
    expect(addOption).toBeDefined()
  })

  it('selecting "＋ Add new platform…" reveals the text input', async () => {
    renderForm(availableItems)
    const user = userEvent.setup()
    const platformSelect = screen.getByLabelText('Platform')
    await user.selectOptions(platformSelect, '__add_new__')
    expect(screen.getByLabelText('New platform name')).toBeInTheDocument()
  })

  it('Enter with valid value adds platform and selects it', async () => {
    renderForm(availableItems)
    const user = userEvent.setup()
    const platformSelect = screen.getByLabelText('Platform')
    await user.selectOptions(platformSelect, '__add_new__')

    const newInput = screen.getByLabelText('New platform name')
    await user.type(newInput, 'Depop{Enter}')

    // The new platform should now be selected
    expect((platformSelect as HTMLSelectElement).value).toBe('Depop')
    // Input should be hidden
    expect(screen.queryByLabelText('New platform name')).not.toBeInTheDocument()
  })

  it('Enter with empty/whitespace value does not add', async () => {
    renderForm(availableItems)
    const user = userEvent.setup()
    const platformSelect = screen.getByLabelText('Platform')
    await user.selectOptions(platformSelect, '__add_new__')

    const newInput = screen.getByLabelText('New platform name')
    await user.type(newInput, '   {Enter}')

    // Input should still be visible (not dismissed)
    expect(screen.getByLabelText('New platform name')).toBeInTheDocument()
  })

  it('duplicate value (case-insensitive) does not add', async () => {
    renderForm(availableItems)
    const user = userEvent.setup()
    const platformSelect = screen.getByLabelText('Platform')
    await user.selectOptions(platformSelect, '__add_new__')

    const newInput = screen.getByLabelText('New platform name')
    await user.type(newInput, 'vestiaire{Enter}')

    // Should still show input (duplicate rejected silently)
    expect(screen.getByLabelText('New platform name')).toBeInTheDocument()
  })

  it('Escape dismisses input without adding', async () => {
    renderForm(availableItems)
    const user = userEvent.setup()
    const platformSelect = screen.getByLabelText('Platform')

    // First select a valid platform
    await user.selectOptions(platformSelect, 'Poshmark')

    // Now select "Add new"
    await user.selectOptions(platformSelect, '__add_new__')
    const newInput = screen.getByLabelText('New platform name')
    await user.type(newInput, '{Escape}')

    // Input should be hidden and dropdown reverted to previous selection
    expect(screen.queryByLabelText('New platform name')).not.toBeInTheDocument()
    expect((platformSelect as HTMLSelectElement).value).toBe('Poshmark')
  })

  // --- Existing tests updated for dropdown ---

  it('profit preview updates when salePrice changes', async () => {
    renderForm(availableItems, 'item1')
    const user = userEvent.setup()

    const salePriceInput = screen.getByLabelText(/sale price/i)
    await user.clear(salePriceInput)
    await user.type(salePriceInput, '400')

    // purchasePrice = 250, fees = 0, net = 400, profit = 150
    await waitFor(() => {
      expect(screen.getByTestId('profit-preview')).toHaveTextContent('$150.00')
    })
  })

  it('profit preview updates when platformFees change', async () => {
    renderForm(availableItems, 'item1')
    const user = userEvent.setup()

    const salePriceInput = screen.getByLabelText(/sale price/i)
    await user.clear(salePriceInput)
    await user.type(salePriceInput, '400')

    const feesInput = screen.getByLabelText(/platform fees/i)
    await user.clear(feesInput)
    await user.type(feesInput, '80')

    // purchasePrice = 250, net = 400 - 80 = 320, profit = 320 - 250 = 70
    await waitFor(() => {
      expect(screen.getByTestId('profit-preview')).toHaveTextContent('$70.00')
    })
  })

  it('submit with salePrice = 0 shows validation error', async () => {
    renderForm()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /record sale/i }))

    expect(screen.getByText(/sale price must be greater than 0/i)).toBeInTheDocument()
    expect(mockCreateSale).not.toHaveBeenCalled()
  })

  it('valid submit calls the sales API with correct payload', async () => {
    mockCreateSale.mockResolvedValueOnce({
      sale: {
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
        soldAt: '2025-06-01T00:00:00Z',
        platformOrderId: null,
        notes: null,
        createdAt: '2025-06-01T00:00:00Z',
      },
      status: 201,
    })

    renderForm(availableItems, 'item1')
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText('Platform'), 'Poshmark')
    const salePriceInput = screen.getByLabelText(/sale price/i)
    await user.clear(salePriceInput)
    await user.type(salePriceInput, '400')
    const feesInput = screen.getByLabelText(/platform fees/i)
    await user.clear(feesInput)
    await user.type(feesInput, '80')

    await user.click(screen.getByRole('button', { name: /record sale/i }))

    await waitFor(() => {
      expect(mockCreateSale).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz1',
          itemId: 'item1',
          platform: 'Poshmark',
          salePrice: 400,
          platformFees: 80,
        }),
        undefined,
      )
    })
    expect(mockOnSuccess).toHaveBeenCalled()
  })

  it('shows validation error when soldAt is before item purchaseDate', async () => {
    renderForm(availableItems, 'item1')
    const user = userEvent.setup()

    // item1 purchaseDate is 2025-01-15
    const dateInput = screen.getByLabelText(/date sold/i)
    await user.clear(dateInput)
    await user.type(dateInput, '2024-12-01')

    await user.selectOptions(screen.getByLabelText('Platform'), 'Poshmark')
    const salePriceInput = screen.getByLabelText(/sale price/i)
    await user.clear(salePriceInput)
    await user.type(salePriceInput, '400')

    await user.click(screen.getByRole('button', { name: /record sale/i }))

    await waitFor(() => {
      expect(screen.getByText(/sale date cannot be before/i)).toBeInTheDocument()
    })
    expect(mockCreateSale).not.toHaveBeenCalled()
  })

  it('shows "Edit this item" link when date error is present', async () => {
    renderForm(availableItems, 'item1')
    const user = userEvent.setup()

    const dateInput = screen.getByLabelText(/date sold/i)
    await user.clear(dateInput)
    await user.type(dateInput, '2024-12-01')

    await user.selectOptions(screen.getByLabelText('Platform'), 'Poshmark')
    const salePriceInput = screen.getByLabelText(/sale price/i)
    await user.clear(salePriceInput)
    await user.type(salePriceInput, '400')

    await user.click(screen.getByRole('button', { name: /record sale/i }))

    await waitFor(() => {
      expect(screen.getByText(/edit this item/i)).toBeInTheDocument()
    })
  })

  it('409 response shows "Item is already sold" inline error', async () => {
    mockCreateSale.mockResolvedValueOnce({
      error: 'Item is already sold',
      status: 409,
    })

    renderForm(availableItems, 'item1')
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText('Platform'), 'Poshmark')
    const salePriceInput = screen.getByLabelText(/sale price/i)
    await user.clear(salePriceInput)
    await user.type(salePriceInput, '400')

    await user.click(screen.getByRole('button', { name: /record sale/i }))

    await waitFor(() => {
      expect(screen.getByText(/item is already sold/i)).toBeInTheDocument()
    })
    expect(mockOnSuccess).not.toHaveBeenCalled()
  })
})
