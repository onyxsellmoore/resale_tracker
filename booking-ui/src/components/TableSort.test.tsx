import { render, screen } from '@testing-library/react'
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
    status: 'AVAILABLE',
    costEntryPending: false,
    createdAt: '2025-02-10T00:00:00Z',
    updatedAt: '2025-02-10T00:00:00Z',
  },
  {
    id: '3',
    businessId: 'biz1',
    name: 'Armani Jacket',
    brand: 'Armani',
    category: 'Outerwear',
    condition: 'FAIR',
    purchasePrice: 400.0,
    purchaseDate: '2025-03-05T00:00:00Z',
    description: null,
    notes: null,
    status: 'AVAILABLE',
    costEntryPending: false,
    createdAt: '2025-03-05T00:00:00Z',
    updatedAt: '2025-03-05T00:00:00Z',
  },
]

function renderTable() {
  return render(
    <MemoryRouter>
      <InventoryTable items={mockItems} />
    </MemoryRouter>
  )
}

describe('TableSort', () => {
  it('clicking a sortable header once sorts rows ascending', async () => {
    renderTable()
    const user = userEvent.setup()

    // Click "Name" header to sort ascending
    await user.click(screen.getByText('Name'))

    const rows = screen.getAllByRole('row')
    // rows[0] is header, rows[1..3] are data
    expect(rows[1]).toHaveTextContent('Armani Jacket')
    expect(rows[2]).toHaveTextContent('Gucci Bag')
    expect(rows[3]).toHaveTextContent('Prada Shoes')
  })

  it('clicking the same header again sorts rows descending', async () => {
    renderTable()
    const user = userEvent.setup()

    // Click "Name" header twice
    await user.click(screen.getByText('Name'))
    await user.click(screen.getByText('Name'))

    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Prada Shoes')
    expect(rows[2]).toHaveTextContent('Gucci Bag')
    expect(rows[3]).toHaveTextContent('Armani Jacket')
  })

  it('a sort indicator (▲ or ▼) is present on the sorted column', async () => {
    renderTable()
    const user = userEvent.setup()

    await user.click(screen.getByText('Name'))
    expect(screen.getByText(/Name/)).toHaveTextContent(/▲/)

    await user.click(screen.getByText(/Name/))
    expect(screen.getByText(/Name/)).toHaveTextContent(/▼/)
  })
})
