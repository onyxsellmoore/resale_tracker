import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
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
    createdAt: '2025-02-10T00:00:00Z',
    updatedAt: '2025-03-01T00:00:00Z',
  },
]

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

  it('AVAILABLE item shows green badge', () => {
    renderTable()
    const badge = screen.getByTestId('status-badge-1')
    expect(badge).toHaveTextContent('AVAILABLE')
    expect(badge.className).toContain('status-badge-available')
  })

  it('SOLD item shows grey badge', () => {
    renderTable()
    const badge = screen.getByTestId('status-badge-2')
    expect(badge).toHaveTextContent('SOLD')
    expect(badge.className).toContain('status-badge-sold')
  })

  it('"Record a Sale" button present for AVAILABLE item', () => {
    renderTable()
    const row = screen.getByTestId('item-row-1')
    expect(within(row).getByText('Record a Sale')).toBeInTheDocument()
  })

  it('"Record a Sale" button absent for SOLD item', () => {
    renderTable()
    const row = screen.getByTestId('item-row-2')
    expect(within(row).queryByText('Record a Sale')).not.toBeInTheDocument()
  })

  it('status filter "Available" hides SOLD rows', async () => {
    renderTable()
    const user = userEvent.setup()

    const filter = screen.getByLabelText('Status filter')
    await user.selectOptions(filter, 'AVAILABLE')

    expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
    expect(screen.queryByText('Prada Shoes')).not.toBeInTheDocument()
  })
})
