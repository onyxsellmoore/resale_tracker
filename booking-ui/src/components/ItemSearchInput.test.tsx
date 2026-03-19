import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ItemSearchInput } from './ItemSearchInput'
import type { ItemDTO } from '../types'

const items: ItemDTO[] = [
  {
    id: '1', businessId: 'b1', name: 'Gucci Bag', brand: 'Gucci', category: 'Handbags',
    condition: 'EXCELLENT', purchasePrice: 250, purchaseDate: '2025-01-01T00:00:00Z',
    description: null, notes: null, status: 'AVAILABLE', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: '2', businessId: 'b1', name: 'Prada Shoes', brand: 'Prada', category: 'Shoes',
    condition: 'GOOD', purchasePrice: 100, purchaseDate: '2025-02-01T00:00:00Z',
    description: null, notes: null, status: 'AVAILABLE', createdAt: '2025-02-01T00:00:00Z', updatedAt: '2025-02-01T00:00:00Z',
  },
  {
    id: '3', businessId: 'b1', name: 'Louis Vuitton Wallet', brand: 'Louis Vuitton', category: 'Accessories',
    condition: 'FAIR', purchasePrice: 300, purchaseDate: '2025-03-01T00:00:00Z',
    description: null, notes: null, status: 'AVAILABLE', createdAt: '2025-03-01T00:00:00Z', updatedAt: '2025-03-01T00:00:00Z',
  },
]

// Generate 10 items to test the max-8 rule
const manyItems: ItemDTO[] = Array.from({ length: 10 }, (_, i) => ({
  id: `id-${i}`, businessId: 'b1', name: `Item ${i}`, brand: 'TestBrand', category: 'Cat',
  condition: 'GOOD' as const, purchasePrice: 10, purchaseDate: '2025-01-01T00:00:00Z',
  description: null, notes: null, status: 'AVAILABLE' as const, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
}))

describe('ItemSearchInput', () => {
  it('renders an input with the provided aria-label', () => {
    const onChange = vi.fn()
    render(<ItemSearchInput items={items} value={null} onChange={onChange} aria-label="Item" />)
    expect(screen.getByLabelText('Item')).toBeInTheDocument()
  })

  it('typing filters items by name (case-insensitive)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ItemSearchInput items={items} value={null} onChange={onChange} aria-label="Item" />)

    await user.type(screen.getByLabelText('Item'), 'gucci')
    expect(screen.getByText('Gucci Bag')).toBeInTheDocument()
    expect(screen.queryByText('Prada Shoes')).not.toBeInTheDocument()
  })

  it('typing filters items by brand (case-insensitive)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ItemSearchInput items={items} value={null} onChange={onChange} aria-label="Item" />)

    await user.type(screen.getByLabelText('Item'), 'prada')
    expect(screen.getByText('Prada Shoes')).toBeInTheDocument()
    expect(screen.queryByText('Gucci Bag')).not.toBeInTheDocument()
  })

  it('clicking a result calls onChange with the correct ItemDTO', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ItemSearchInput items={items} value={null} onChange={onChange} aria-label="Item" />)

    await user.type(screen.getByLabelText('Item'), 'gucci')
    await user.click(screen.getByText('Gucci Bag'))
    expect(onChange).toHaveBeenCalledWith(items[0])
  })

  it('selecting an item displays its name in the input', () => {
    const onChange = vi.fn()
    render(<ItemSearchInput items={items} value="1" onChange={onChange} aria-label="Item" />)
    expect(screen.getByLabelText('Item')).toHaveValue('Gucci Bag')
  })

  it('clearing the input calls onChange with null', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ItemSearchInput items={items} value="1" onChange={onChange} aria-label="Item" />)

    const input = screen.getByLabelText('Item')
    await user.clear(input)
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('shows at most 8 results', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ItemSearchInput items={manyItems} value={null} onChange={onChange} aria-label="Item" />)

    await user.type(screen.getByLabelText('Item'), 'Item')
    const resultItems = screen.getAllByRole('option')
    expect(resultItems.length).toBeLessThanOrEqual(8)
  })

  it('pressing Escape closes the results list', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ItemSearchInput items={items} value={null} onChange={onChange} aria-label="Item" />)

    await user.type(screen.getByLabelText('Item'), 'gucci')
    expect(screen.getByText('Gucci Bag')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByText('Gucci Bag')).not.toBeInTheDocument()
  })

  it('does not render results list when input is empty', () => {
    const onChange = vi.fn()
    render(<ItemSearchInput items={items} value={null} onChange={onChange} aria-label="Item" />)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
