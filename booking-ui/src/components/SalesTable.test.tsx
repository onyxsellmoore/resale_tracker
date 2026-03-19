import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SalesTable } from './SalesTable'
import type { SaleDTO } from '../types'

const mockSales: SaleDTO[] = [
  {
    id: '1',
    businessId: 'biz1',
    itemId: 'item1',
    itemName: 'Gucci Bag',
    itemBrand: 'Gucci',
    platform: 'Poshmark',
    salePrice: 1500.0,
    platformFees: 300.0,
    netProceeds: 1200.0,
    profit: 950.0,
    soldAt: '2025-06-01T12:00:00Z',
    platformOrderId: null,
    notes: null,
    createdAt: '2025-06-01T12:00:00Z',
  },
  {
    id: '2',
    businessId: 'biz1',
    itemId: 'item2',
    itemName: 'Prada Shoes',
    itemBrand: 'Prada',
    platform: 'Mercari',
    salePrice: 80.0,
    platformFees: 20.0,
    netProceeds: 60.0,
    profit: -40.0,
    soldAt: '2025-07-15T12:00:00Z',
    platformOrderId: null,
    notes: null,
    createdAt: '2025-07-15T12:00:00Z',
  },
]

describe('SalesTable', () => {
  it('renders correct number of rows from mock data', () => {
    render(<SalesTable sales={mockSales} />)
    const rows = screen.getAllByRole('row')
    // header + 2 data rows
    expect(rows.length).toBe(3)
  })

  it('positive profit displays in green', () => {
    render(<SalesTable sales={mockSales} />)
    const profitCell = screen.getByTestId('profit-1')
    expect(profitCell.className).toContain('profit-positive')
    expect(profitCell).toHaveTextContent('$950.00')
  })

  it('negative profit displays in red', () => {
    render(<SalesTable sales={mockSales} />)
    const profitCell = screen.getByTestId('profit-2')
    expect(profitCell.className).toContain('profit-negative')
    expect(profitCell).toHaveTextContent('-$40.00')
  })

  it('all money values formatted as "$X,XXX.00"', () => {
    render(<SalesTable sales={mockSales} />)
    // Sale price of 1500 should be formatted as $1,500.00
    expect(screen.getByTestId('salePrice-1')).toHaveTextContent('$1,500.00')
    expect(screen.getByTestId('fees-1')).toHaveTextContent('$300.00')
    expect(screen.getByTestId('netProceeds-1')).toHaveTextContent('$1,200.00')
  })

  it('platform filter hides non-matching rows', async () => {
    render(<SalesTable sales={mockSales} />)
    const user = userEvent.setup()

    const filter = screen.getByLabelText('Platform filter')
    await user.selectOptions(filter, 'Mercari')

    expect(screen.queryByText('Gucci Bag')).not.toBeInTheDocument()
    expect(screen.getByText('Prada Shoes')).toBeInTheDocument()
  })

  it('Delete button shown for each sale when onDelete is provided', () => {
    const onDelete = vi.fn()
    render(<SalesTable sales={mockSales} onDelete={onDelete} />)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    expect(deleteButtons).toHaveLength(2)
  })

  it('clicking Delete calls onDelete with sale id', async () => {
    const onDelete = vi.fn()
    render(<SalesTable sales={mockSales} onDelete={onDelete} />)
    const user = userEvent.setup()
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[0])
    expect(onDelete).toHaveBeenCalledWith('1')
  })

  it('no Delete buttons when onDelete is not provided', () => {
    render(<SalesTable sales={mockSales} />)
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })
})
