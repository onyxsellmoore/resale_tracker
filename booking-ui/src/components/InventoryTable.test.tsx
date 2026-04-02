import { render, screen, within, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { InventoryTable } from './InventoryTable'
import type { ItemDTO } from '../types'

const mockItems: ItemDTO[] = [
  {
    id: '1',
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
    costEntryPending: false,
    createdAt: '2025-01-15T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z',
  },
  {
    id: '2',
    businessId: 'biz1',
    name: 'Prada Shoes',
    brand: 'Prada',
    category: 'Shoes',
    condition: 'GOOD',
    purchasePrice: 180.0,
    purchaseDate: '2025-02-10T00:00:00Z',
    description: null,
    notes: null,
    status: 'SOLD',
    costEntryPending: false,
    createdAt: '2025-02-10T00:00:00Z',
    updatedAt: '2025-03-01T00:00:00Z',
  },
]

/** Item with legacy/unrecognized status that the backend maps to UNKNOWN. */
const unknownItem: ItemDTO = {
  id: '3',
  businessId: 'biz1',
  name: 'Legacy Chanel Bag',
  brand: 'Chanel',
  category: 'Bags',
  condition: 'FAIR',
  purchasePrice: 300.0,
  purchaseDate: '2025-03-01T00:00:00Z',
  description: null,
  notes: null,
  status: 'UNKNOWN',
  costEntryPending: false,
  createdAt: '2025-03-01T00:00:00Z',
  updatedAt: '2025-03-01T00:00:00Z',
}

function renderTable(items: ItemDTO[] = mockItems) {
  return render(
    <MemoryRouter>
      <InventoryTable items={items} />
    </MemoryRouter>
  )
}

describe('InventoryTable', () => {
  it('renders correct number of rows from mock data', () => {
    renderTable()
    const rows = screen.getAllByRole('row')
    // header + 2 data rows
    expect(rows.length).toBe(3)
  })

  it('AVAILABLE item shows green badge with title-case text', () => {
    renderTable()
    const badge = screen.getByTestId('status-badge-1')
    expect(badge).toHaveTextContent('Available')
    expect(badge.className).toContain('status-badge-available')
  })

  it('SOLD item shows grey badge with title-case text', () => {
    renderTable()
    const badge = screen.getByTestId('status-badge-2')
    expect(badge).toHaveTextContent('Sold')
    expect(badge.className).toContain('status-badge-sold')
  })

  it('status badge data-testid still uses original uppercase status value', () => {
    renderTable()
    expect(screen.getByTestId('status-badge-1')).toBeInTheDocument()
    expect(screen.getByTestId('status-badge-2')).toBeInTheDocument()
  })

  it('Mark Sold link present for AVAILABLE item with btn-action class', () => {
    renderTable()
    const row = screen.getByTestId('item-row-1')
    const link = within(row).getByText('Mark Sold')
    expect(link).toBeInTheDocument()
    expect(link.className).toContain('btn-action')
  })

  it('Edit button rendered for every item and links to /inventory/edit/[id]', () => {
    renderTable()
    const row1 = screen.getByTestId('item-row-1')
    const editLink1 = within(row1).getByText('Edit')
    expect(editLink1).toBeInTheDocument()
    expect(editLink1).toHaveAttribute('href', '/inventory/edit/1')

    const row2 = screen.getByTestId('item-row-2')
    const editLink2 = within(row2).getByText('Edit')
    expect(editLink2).toBeInTheDocument()
    expect(editLink2).toHaveAttribute('href', '/inventory/edit/2')
  })

  it('"Record a Sale" button absent for SOLD item', () => {
    renderTable()
    const row = screen.getByTestId('item-row-2')
    expect(within(row).queryByText('Mark Sold')).not.toBeInTheDocument()
  })

  it('status filter "Available" hides SOLD rows', async () => {
    renderTable()
    const user = userEvent.setup()

    const filter = screen.getByLabelText('Status filter')
    await user.selectOptions(filter, 'AVAILABLE')

    expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
    expect(screen.queryByText('Prada Shoes')).not.toBeInTheDocument()
  })

  it('Delete button shown for AVAILABLE item when onDelete is provided', () => {
    const onDelete = vi.fn()
    render(
      <MemoryRouter>
        <InventoryTable items={mockItems} onDelete={onDelete} />
      </MemoryRouter>
    )
    const row = screen.getByTestId('item-row-1')
    expect(within(row).getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('Delete button NOT shown for SOLD item', () => {
    const onDelete = vi.fn()
    render(
      <MemoryRouter>
        <InventoryTable items={mockItems} onDelete={onDelete} />
      </MemoryRouter>
    )
    const row = screen.getByTestId('item-row-2')
    expect(within(row).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('clicking Delete shows confirmation, does NOT call onDelete immediately', async () => {
    const onDelete = vi.fn()
    render(
      <MemoryRouter>
        <InventoryTable items={mockItems} onDelete={onDelete} />
      </MemoryRouter>
    )
    const user = userEvent.setup()
    const row = screen.getByTestId('item-row-1')
    await user.click(within(row).getByRole('button', { name: /delete/i }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /yes, delete/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('clicking Cancel hides the confirmation and does not call onDelete', async () => {
    const onDelete = vi.fn()
    render(
      <MemoryRouter>
        <InventoryTable items={mockItems} onDelete={onDelete} />
      </MemoryRouter>
    )
    const user = userEvent.setup()
    const row = screen.getByTestId('item-row-1')
    await user.click(within(row).getByRole('button', { name: /delete/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByText(/permanently delete/i)).not.toBeInTheDocument()
  })

  it('clicking "Yes, delete" calls onDelete with the correct item id', async () => {
    const onDelete = vi.fn()
    render(
      <MemoryRouter>
        <InventoryTable items={mockItems} onDelete={onDelete} />
      </MemoryRouter>
    )
    const user = userEvent.setup()
    const row = screen.getByTestId('item-row-1')
    await user.click(within(row).getByRole('button', { name: /delete/i }))
    const confirmBtn = screen.getByRole('button', { name: /yes, delete/i })
    expect(confirmBtn.className).toContain('btn-confirm-delete')
    await user.click(confirmBtn)
    expect(onDelete).toHaveBeenCalledWith('1')
  })

  it('clicking Delete adds row-delete-confirm class to the row', async () => {
    const onDelete = vi.fn()
    render(
      <MemoryRouter>
        <InventoryTable items={mockItems} onDelete={onDelete} />
      </MemoryRouter>
    )
    const user = userEvent.setup()
    const row = screen.getByTestId('item-row-1')
    await user.click(within(row).getByRole('button', { name: /delete/i }))
    expect(row.className).toContain('row-delete-confirm')
  })

  it('clicking Cancel removes the row-delete-confirm class', async () => {
    const onDelete = vi.fn()
    render(
      <MemoryRouter>
        <InventoryTable items={mockItems} onDelete={onDelete} />
      </MemoryRouter>
    )
    const user = userEvent.setup()
    const row = screen.getByTestId('item-row-1')
    await user.click(within(row).getByRole('button', { name: /delete/i }))
    expect(row.className).toContain('row-delete-confirm')
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(row.className).not.toContain('row-delete-confirm')
  })

  it('search input is present in the DOM', () => {
    renderTable()
    expect(screen.getByLabelText('Search inventory')).toBeInTheDocument()
  })

  it('after typing a query, only items whose name or brand contains that string are rendered', () => {
    vi.useFakeTimers()
    renderTable()

    const input = screen.getByLabelText('Search inventory')
    fireEvent.change(input, { target: { value: 'gucci' } })
    act(() => { vi.advanceTimersByTime(300) })

    expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
    expect(screen.queryByText('Prada Shoes')).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it('empty state message appears and contains the query string when no results match', () => {
    vi.useFakeTimers()
    renderTable()

    const input = screen.getByLabelText('Search inventory')
    fireEvent.change(input, { target: { value: 'zzznomatch' } })
    act(() => { vi.advanceTimersByTime(300) })

    expect(screen.getByTestId('search-empty-state')).toBeInTheDocument()
    expect(screen.getByText(/No items matching 'zzznomatch'/)).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('clicking "Clear" empties the search input and restores all status-filtered items', () => {
    vi.useFakeTimers()
    renderTable()

    const input = screen.getByLabelText('Search inventory')
    fireEvent.change(input, { target: { value: 'zzznomatch' } })
    act(() => { vi.advanceTimersByTime(300) })

    const clearBtn = screen.getByRole('button', { name: /clear/i })
    fireEvent.click(clearBtn)
    act(() => { vi.advanceTimersByTime(300) })

    expect(input).toHaveValue('')
    expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
    expect(screen.getByText('Prada Shoes')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('Edit, Mark Sold, and Delete buttons all have the btn-action class', () => {
    const onDelete = vi.fn()
    render(
      <MemoryRouter>
        <InventoryTable items={mockItems} onDelete={onDelete} />
      </MemoryRouter>
    )
    const row = screen.getByTestId('item-row-1')
    const editBtn = within(row).getByText('Edit')
    const markSoldBtn = within(row).getByText('Mark Sold')
    const deleteBtn = within(row).getByRole('button', { name: /delete/i })

    expect(editBtn.className).toContain('btn-action')
    expect(markSoldBtn.className).toContain('btn-action')
    expect(deleteBtn.className).toContain('btn-action')
  })

  describe('UNKNOWN status (legacy items)', () => {
    /** Renders the table with all mock items including the UNKNOWN-status item. */
    function renderWithUnknown(onDelete?: (id: string) => void) {
      return render(
        <MemoryRouter>
          <InventoryTable items={[...mockItems, unknownItem]} onDelete={onDelete} />
        </MemoryRouter>
      )
    }

    it('UNKNOWN item shows gold badge with title-case text', () => {
      renderWithUnknown()
      const badge = screen.getByTestId('status-badge-3')
      expect(badge).toHaveTextContent('Unknown')
      expect(badge.className).toContain('status-badge-unknown')
    })

    it('UNKNOWN item shows Edit link', () => {
      renderWithUnknown()
      const row = screen.getByTestId('item-row-3')
      const editLink = within(row).getByText('Edit')
      expect(editLink).toHaveAttribute('href', '/inventory/edit/3')
    })

    it('UNKNOWN item does NOT show Mark Sold link', () => {
      renderWithUnknown()
      const row = screen.getByTestId('item-row-3')
      expect(within(row).queryByText('Mark Sold')).not.toBeInTheDocument()
    })

    it('UNKNOWN item shows Delete button when onDelete is provided', () => {
      const onDelete = vi.fn()
      renderWithUnknown(onDelete)
      const row = screen.getByTestId('item-row-3')
      expect(within(row).getByRole('button', { name: /delete/i })).toBeInTheDocument()
    })

    it('status filter "Unknown" shows only UNKNOWN items', async () => {
      const user = userEvent.setup()
      renderWithUnknown()
      const filter = screen.getByLabelText('Status filter')
      await user.selectOptions(filter, 'UNKNOWN')
      expect(screen.getByText('Legacy Chanel Bag')).toBeInTheDocument()
      expect(screen.queryByText('Gucci Bag')).not.toBeInTheDocument()
      expect(screen.queryByText('Prada Shoes')).not.toBeInTheDocument()
    })
  })
})
