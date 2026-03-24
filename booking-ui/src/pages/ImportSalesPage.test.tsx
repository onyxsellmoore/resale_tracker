import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../auth/AuthContext'
import { ImportSalesPage } from './ImportSalesPage'
import type { ItemDTO, SaleDTO, ParsedSaleRow } from '../types'

vi.mock('../api/salesApi', () => ({
  getSales: vi.fn(),
  createSale: vi.fn(),
}))

vi.mock('../api/inventoryApi', () => ({
  getItems: vi.fn(),
  createItem: vi.fn(),
}))

vi.mock('../utils/importParser', () => ({
  validateCsvStructure: vi.fn(),
  parseImportFile: vi.fn(),
}))

import { getSales, createSale } from '../api/salesApi'
import { getItems, createItem } from '../api/inventoryApi'
import { validateCsvStructure, parseImportFile } from '../utils/importParser'

const mockGetSales = vi.mocked(getSales)
const mockCreateSale = vi.mocked(createSale)
const mockGetItems = vi.mocked(getItems)
const mockCreateItem = vi.mocked(createItem)
const mockValidate = vi.mocked(validateCsvStructure)
const mockParse = vi.mocked(parseImportFile)

const testItems: ItemDTO[] = [
  {
    id: 'item1', businessId: 'biz1', name: 'Gucci Bag', brand: 'Gucci', category: 'Handbags',
    condition: 'EXCELLENT', purchasePrice: 250, purchaseDate: '2025-01-01T00:00:00Z',
    description: null, notes: null, status: 'AVAILABLE', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
  },
]

const testExistingSales: SaleDTO[] = [
  {
    id: 's1', businessId: 'biz1', itemId: 'item1', itemName: 'Old Item', itemBrand: null,
    platform: 'Mercari', salePrice: 50, platformFees: 5, netProceeds: 45, profit: 10,
    soldAt: '2025-01-01T00:00:00Z', platformOrderId: 'EXISTING-1', notes: null, createdAt: '2025-01-01T00:00:00Z',
  },
]

const testParsedRows: ParsedSaleRow[] = [
  {
    title: 'Dior Spray', platform: 'Mercari', salePrice: 79, platformFees: 10.91,
    soldAt: '2023-06-25T00:00:00.000Z', platformOrderId: 'm111', prefill: {},
  },
  {
    title: 'Duplicate Sale Row', platform: 'Mercari', salePrice: 50, platformFees: 5,
    soldAt: '2025-01-01T00:00:00.000Z', platformOrderId: 'EXISTING-1', prefill: {},
  },
  {
    title: 'Prada Item', platform: 'Mercari', salePrice: 100, platformFees: 12,
    soldAt: '2023-07-01T00:00:00.000Z', platformOrderId: 'm333',
    prefill: { brand: 'Prada', category: 'Shoes' },
  },
]

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <ImportSalesPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

function createValidFile(content = 'valid csv content') {
  return new File([content], 'test.csv', { type: 'text/csv' })
}

describe('ImportSalesPage', () => {
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
    mockGetItems.mockResolvedValue(testItems)
  })

  describe('Step 1', () => {
    it('renders file upload input', () => {
      renderPage()
      expect(screen.getByLabelText(/select csv file/i)).toBeInTheDocument()
    })

    it('shows validation error message when validateCsvStructure returns an error', async () => {
      mockValidate.mockReturnValue({ valid: false, error: 'The file is empty.' })
      renderPage()
      const user = userEvent.setup()
      const input = screen.getByLabelText(/select csv file/i)
      await user.upload(input, createValidFile())
      expect(screen.getByText('The file is empty.')).toBeInTheDocument()
    })

    it('clears validation error when a new file is selected', async () => {
      mockValidate
        .mockReturnValueOnce({ valid: false, error: 'The file is empty.' })
        .mockReturnValueOnce({ valid: true })
      mockParse.mockReturnValue(testParsedRows)
      mockGetSales.mockResolvedValue([])

      renderPage()
      const user = userEvent.setup()
      const input = screen.getByLabelText(/select csv file/i)

      await user.upload(input, createValidFile('bad'))
      expect(screen.getByText('The file is empty.')).toBeInTheDocument()

      await user.upload(input, createValidFile('good'))
      await waitFor(() => {
        expect(screen.queryByText('The file is empty.')).not.toBeInTheDocument()
      })
    })

    it('after selecting a valid file, shows row count and platform name', async () => {
      mockValidate.mockReturnValue({ valid: true })
      mockParse.mockReturnValue(testParsedRows)
      mockGetSales.mockResolvedValue([])

      renderPage()
      const user = userEvent.setup()
      await user.upload(screen.getByLabelText(/select csv file/i), createValidFile())

      await waitFor(() => {
        expect(screen.getByText(/3 rows/i)).toBeInTheDocument()
        expect(screen.getByText(/mercari/i)).toBeInTheDocument()
      })
    })

    it('Next button is disabled before file selection and when validation failed', async () => {
      mockValidate.mockReturnValue({ valid: false, error: 'Bad file' })
      renderPage()
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()

      const user = userEvent.setup()
      await user.upload(screen.getByLabelText(/select csv file/i), createValidFile())
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
    })
  })

  describe('Step 2', () => {
    async function goToStep2() {
      mockValidate.mockReturnValue({ valid: true })
      mockParse.mockReturnValue(testParsedRows)
      mockGetSales.mockResolvedValue(testExistingSales)
      mockGetItems.mockResolvedValue(testItems)

      renderPage()
      const user = userEvent.setup()
      await user.upload(screen.getByLabelText(/select csv file/i), createValidFile())
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
      })
      await user.click(screen.getByRole('button', { name: /next/i }))
      // Wait for items to load
      await waitFor(() => {
        expect(screen.getByText('Dior Spray')).toBeInTheDocument()
      })
      return user
    }

    it('renders one table row per ParsedSaleRow', async () => {
      await goToStep2()
      expect(screen.getByText('Dior Spray')).toBeInTheDocument()
      expect(screen.getByText('Duplicate Sale Row')).toBeInTheDocument()
      expect(screen.getByText('Prada Item')).toBeInTheDocument()
    })

    it("marks rows with matching platformOrderId in existing sales as 'Already imported'", async () => {
      await goToStep2()
      expect(screen.getByText(/already imported/i)).toBeInTheDocument()
    })

    it('duplicate rows do not block the Next button', async () => {
      // Scenario: 2 rows, one is duplicate, one is skippable
      mockParse.mockReturnValue([
        testParsedRows[1], // duplicate row
      ])
      mockValidate.mockReturnValue({ valid: true })
      mockGetSales.mockResolvedValue(testExistingSales)
      mockGetItems.mockResolvedValue(testItems)

      renderPage()
      const user = userEvent.setup()
      await user.upload(screen.getByLabelText(/select csv file/i), createValidFile())
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
      })
      await user.click(screen.getByRole('button', { name: /next/i }))

      await waitFor(() => {
        expect(screen.getByText(/already imported/i)).toBeInTheDocument()
      })

      // Next should be enabled since the only row is a duplicate
      const nextBtn = screen.getByRole('button', { name: /next/i })
      expect(nextBtn).toBeEnabled()
    })

    it('uses ItemSearchInput (not a select element) for non-duplicate rows', async () => {
      await goToStep2()
      // Should have combobox inputs (ItemSearchInput) for non-duplicate rows
      const comboboxes = screen.getAllByRole('combobox')
      expect(comboboxes.length).toBeGreaterThan(0)
      // Should not have select elements for item matching
      expect(screen.queryAllByRole('combobox').length).toBeGreaterThan(0)
    })

    it("clicking 'Create new item' shows the mini-form", async () => {
      const user = await goToStep2()
      const createButtons = screen.getAllByText(/create new item/i)
      await user.click(createButtons[0])
      expect(screen.getByLabelText(/purchase date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/condition/i)).toBeInTheDocument()
    })

    it('mini-form omits brand field when prefill.brand is provided', async () => {
      const user = await goToStep2()
      // Row 3 (Prada Item) has prefill.brand='Prada'
      const createButtons = screen.getAllByText(/create new item/i)
      // Click the last create button (for Prada Item which has brand prefill)
      await user.click(createButtons[createButtons.length - 1])

      // The brand input should not be present for the row with brand prefill
      // But purchasePrice should be shown since no prefill.purchasePrice
      await waitFor(() => {
        expect(screen.getByLabelText(/purchase date/i)).toBeInTheDocument()
      })
    })

    it('mini-form includes purchasePrice field when prefill.purchasePrice is absent', async () => {
      const user = await goToStep2()
      const createButtons = screen.getAllByText(/create new item/i)
      await user.click(createButtons[0])
      expect(screen.getByLabelText(/purchase price/i)).toBeInTheDocument()
    })

    it('shows date error when matched item purchaseDate is after row soldAt', async () => {
      // testItems[0] has purchaseDate 2025-01-01, testParsedRows[0] has soldAt 2023-06-25 (before purchase)
      const user = await goToStep2()

      // Match Dior Spray to Gucci Bag (purchase 2025-01-01, sale 2023-06-25)
      const comboboxes = screen.getAllByRole('combobox')
      await user.type(comboboxes[0], 'Gucci')
      await waitFor(() => {
        expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Gucci Bag'))

      await waitFor(() => {
        expect(screen.getByText(/sale date.*before.*purchase date/i)).toBeInTheDocument()
      })
    })

    it('Next button remains disabled when any row has a dateError', async () => {
      const user = await goToStep2()

      // Match Dior Spray to Gucci Bag (date conflict)
      const comboboxes = screen.getAllByRole('combobox')
      await user.type(comboboxes[0], 'Gucci')
      await waitFor(() => {
        expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Gucci Bag'))

      // Skip the other non-duplicate row
      const skipCheckboxes = screen.getAllByLabelText(/skip/i)
      await user.click(skipCheckboxes[skipCheckboxes.length - 1])

      // Next should stay disabled due to date error
      const nextBtn = screen.getByRole('button', { name: /next/i })
      expect(nextBtn).toBeDisabled()
    })

    it('Next button is disabled when a non-duplicate row is unresolved', async () => {
      await goToStep2()
      const nextBtn = screen.getByRole('button', { name: /next/i })
      expect(nextBtn).toBeDisabled()
    })

    it('Next button is enabled when all non-duplicate rows are matched, skipped, or have valid mini-forms', async () => {
      const user = await goToStep2()

      // Skip both non-duplicate rows
      const skipCheckboxes = screen.getAllByLabelText(/skip/i)
      for (const cb of skipCheckboxes) {
        await user.click(cb)
      }

      const nextBtn = screen.getByRole('button', { name: /next/i })
      await waitFor(() => {
        expect(nextBtn).toBeEnabled()
      })
    })

    it('Next button stays disabled when user opens new-item form but has not filled it', async () => {
      const user = await goToStep2()
      // Skip second non-dup row, open form on first
      const skipCheckboxes = screen.getAllByLabelText(/skip/i)
      await user.click(skipCheckboxes[1]) // skip Prada Item
      const createButtons = screen.getAllByText(/create new item/i)
      await user.click(createButtons[0]) // open form for Dior Spray
      // Form is open but empty → Next should remain disabled
      const nextBtn = screen.getByRole('button', { name: /next/i })
      expect(nextBtn).toBeDisabled()
    })

    it('Next button enables when new-item form is fully filled with purchasePrice=0', async () => {
      // Single row, no prefill
      mockParse.mockReturnValue([
        {
          title: 'Free Item', platform: 'Mercari', salePrice: 50, platformFees: 5,
          soldAt: '2023-06-25T00:00:00.000Z', platformOrderId: 'm444', prefill: {},
        },
      ])
      mockValidate.mockReturnValue({ valid: true })
      mockGetSales.mockResolvedValue([])
      mockGetItems.mockResolvedValue(testItems)

      renderPage()
      const user = userEvent.setup()
      await user.upload(screen.getByLabelText(/select csv file/i), createValidFile())
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
      })
      await user.click(screen.getByRole('button', { name: /next/i }))
      await waitFor(() => {
        expect(screen.getByText('Free Item')).toBeInTheDocument()
      })

      await user.click(screen.getByText(/create new item/i))
      await user.type(screen.getByLabelText(/purchase date/i), '2023-01-01')
      await user.type(screen.getByLabelText(/purchase price/i), '0')

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
      })
    })

    it('Next button enables when new-item form is filled and purchasePrice is prefilled', async () => {
      // Row with prefill.purchasePrice
      mockParse.mockReturnValue([
        {
          title: 'Prefilled Item', platform: 'Poshmark', salePrice: 100, platformFees: 20,
          soldAt: '2024-01-01T00:00:00.000Z', platformOrderId: 'p555',
          prefill: { purchasePrice: 30, brand: 'Nike' },
        },
      ])
      mockValidate.mockReturnValue({ valid: true })
      mockGetSales.mockResolvedValue([])
      mockGetItems.mockResolvedValue(testItems)

      renderPage()
      const user = userEvent.setup()
      await user.upload(screen.getByLabelText(/select csv file/i), createValidFile())
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
      })
      await user.click(screen.getByRole('button', { name: /next/i }))
      await waitFor(() => {
        expect(screen.getByText('Prefilled Item')).toBeInTheDocument()
      })

      await user.click(screen.getByText(/create new item/i))
      // Only need to fill purchase date (purchasePrice is prefilled, brand is prefilled)
      await user.type(screen.getByLabelText(/purchase date/i), '2023-06-01')

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
      })
    })

    it('Next button disabled when new-item form purchasePrice is empty (not prefilled)', async () => {
      mockParse.mockReturnValue([
        {
          title: 'No Price', platform: 'Mercari', salePrice: 50, platformFees: 5,
          soldAt: '2023-06-25T00:00:00.000Z', platformOrderId: 'm666', prefill: {},
        },
      ])
      mockValidate.mockReturnValue({ valid: true })
      mockGetSales.mockResolvedValue([])
      mockGetItems.mockResolvedValue(testItems)

      renderPage()
      const user = userEvent.setup()
      await user.upload(screen.getByLabelText(/select csv file/i), createValidFile())
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
      })
      await user.click(screen.getByRole('button', { name: /next/i }))
      await waitFor(() => {
        expect(screen.getByText('No Price')).toBeInTheDocument()
      })

      await user.click(screen.getByText(/create new item/i))
      // Fill date but not price
      await user.type(screen.getByLabelText(/purchase date/i), '2023-01-01')
      // purchasePrice left empty → Next should be disabled
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
    })
  })

  describe('Step 3', () => {
    async function goToStep3() {
      mockValidate.mockReturnValue({ valid: true })
      // Only non-duplicate rows for simplicity
      const rows: ParsedSaleRow[] = [
        {
          title: 'Test Item', platform: 'Mercari', salePrice: 100, platformFees: 10,
          soldAt: '2025-06-25T00:00:00.000Z', platformOrderId: 'm999', prefill: {},
        },
        {
          title: 'Dup Item', platform: 'Mercari', salePrice: 50, platformFees: 5,
          soldAt: '2025-01-01T00:00:00.000Z', platformOrderId: 'EXISTING-1', prefill: {},
        },
      ]
      mockParse.mockReturnValue(rows)
      mockGetSales.mockResolvedValue(testExistingSales)
      mockGetItems.mockResolvedValue(testItems)

      renderPage()
      const user = userEvent.setup()
      await user.upload(screen.getByLabelText(/select csv file/i), createValidFile())
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
      })
      await user.click(screen.getByRole('button', { name: /next/i }))

      // Step 2: match the non-duplicate row to an existing item
      await waitFor(() => {
        expect(screen.getByText('Test Item')).toBeInTheDocument()
      })

      // Type in ItemSearchInput to find Gucci Bag
      const combobox = screen.getByRole('combobox')
      await user.type(combobox, 'Gucci')
      await waitFor(() => {
        expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Gucci Bag'))

      // Go to step 3
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
      })
      await user.click(screen.getByRole('button', { name: /next/i }))
      return user
    }

    it('shows correct counts including duplicate count', async () => {
      await goToStep3()
      await waitFor(() => {
        expect(screen.getByText(/1 sale/i)).toBeInTheDocument()
        expect(screen.getByText(/1 already imported/i)).toBeInTheDocument()
      })
    })

    it('skipped and duplicate rows do not appear in the review table', async () => {
      await goToStep3()
      await waitFor(() => {
        expect(screen.getByText('Test Item')).toBeInTheDocument()
        expect(screen.queryByText('Dup Item')).not.toBeInTheDocument()
      })
    })

    it('Confirm Import calls only createSale for matched rows', async () => {
      mockCreateSale.mockResolvedValue({ sale: {} as SaleDTO, status: 201 })
      const user = await goToStep3()

      await user.click(screen.getByRole('button', { name: /confirm import/i }))

      await waitFor(() => {
        expect(mockCreateSale).toHaveBeenCalledTimes(1)
        expect(mockCreateSale).toHaveBeenCalledWith(
          expect.objectContaining({
            itemId: 'item1',
            platform: 'Mercari',
            platformOrderId: 'm999',
          }),
          undefined,
        )
      })
    })

    it('createSale is called with the correct platformOrderId', async () => {
      mockCreateSale.mockResolvedValue({ sale: {} as SaleDTO, status: 201 })
      const user = await goToStep3()

      await user.click(screen.getByRole('button', { name: /confirm import/i }))

      await waitFor(() => {
        expect(mockCreateSale).toHaveBeenCalledWith(
          expect.objectContaining({ platformOrderId: 'm999' }),
          undefined,
        )
      })
    })

    it('409 from createSale is treated as already-imported and does not stop the import', async () => {
      mockCreateSale.mockResolvedValue({ error: 'Sale already imported', status: 409 })
      const user = await goToStep3()

      await user.click(screen.getByRole('button', { name: /confirm import/i }))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/sales')
      })
    })

    it('non-409 error stops the import and shows a descriptive message with the row title', async () => {
      mockCreateSale.mockResolvedValue({ error: 'Server error', status: 500 })
      const user = await goToStep3()

      await user.click(screen.getByRole('button', { name: /confirm import/i }))

      await waitFor(() => {
        expect(screen.getByText(/failed to import.*test item/i)).toBeInTheDocument()
      })
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('Confirm Import calls createItem then createSale for new-item rows', async () => {
      // Set up with a row that uses "create new item"
      mockValidate.mockReturnValue({ valid: true })
      const rows: ParsedSaleRow[] = [
        {
          title: 'New Thing', platform: 'Mercari', salePrice: 100, platformFees: 10,
          soldAt: '2023-06-25T00:00:00.000Z', platformOrderId: 'm888', prefill: {},
        },
      ]
      mockParse.mockReturnValue(rows)
      mockGetSales.mockResolvedValue([])
      mockGetItems.mockResolvedValue(testItems)
      mockCreateItem.mockResolvedValue({ ...testItems[0], id: 'new-item-1', name: 'New Thing' })
      mockCreateSale.mockResolvedValue({ sale: {} as SaleDTO, status: 201 })

      renderPage()
      const user = userEvent.setup()
      await user.upload(screen.getByLabelText(/select csv file/i), createValidFile())
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
      })
      await user.click(screen.getByRole('button', { name: /next/i }))

      // Wait for step 2
      await waitFor(() => {
        expect(screen.getByText('New Thing')).toBeInTheDocument()
      })

      // Click "Create new item"
      await user.click(screen.getByText(/create new item/i))

      // Fill mini-form
      const purchaseDateInput = screen.getByLabelText(/purchase date/i)
      await user.type(purchaseDateInput, '2023-01-01')
      const conditionSelect = screen.getByLabelText(/condition/i)
      await user.selectOptions(conditionSelect, 'GOOD')
      const purchasePriceInput = screen.getByLabelText(/purchase price/i)
      await user.type(purchasePriceInput, '50')

      // Go to step 3
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
      })
      await user.click(screen.getByRole('button', { name: /next/i }))

      // Confirm
      await user.click(screen.getByRole('button', { name: /confirm import/i }))

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledTimes(1)
        expect(mockCreateSale).toHaveBeenCalledTimes(1)
        expect(mockCreateSale).toHaveBeenCalledWith(
          expect.objectContaining({ itemId: 'new-item-1' }),
          undefined,
        )
      })
    })

    it('navigates to /sales on complete success', async () => {
      mockCreateSale.mockResolvedValue({ sale: {} as SaleDTO, status: 201 })
      const user = await goToStep3()

      await user.click(screen.getByRole('button', { name: /confirm import/i }))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/sales')
      })
    })
  })
})
