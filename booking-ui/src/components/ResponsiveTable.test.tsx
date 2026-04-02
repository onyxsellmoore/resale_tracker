import { render, screen } from '@testing-library/react'
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
]

describe('ResponsiveTable', () => {
  it("the table's wrapper element has overflow-x auto", () => {
    render(
      <MemoryRouter>
        <InventoryTable items={mockItems} />
      </MemoryRouter>
    )
    const wrapper = screen.getByTestId('table-scroll-wrapper')
    expect(wrapper).toBeInTheDocument()
    // The wrapper should have the class that sets overflow-x: auto
    expect(wrapper.className).toContain('table-scroll-wrapper')
  })
})
