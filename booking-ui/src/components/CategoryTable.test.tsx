import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CategoryTable } from './CategoryTable'
import type { CategoryBreakdown } from '../types'

const mockData: CategoryBreakdown[] = [
  { category: 'Shoes', itemsSold: 2, totalRevenue: 500.0, totalProfit: 150.0 },
  { category: 'Bags', itemsSold: 3, totalRevenue: 3000.0, totalProfit: 1200.0 },
  { category: 'Watches', itemsSold: 1, totalRevenue: 800.0, totalProfit: -50.0 },
]

describe('CategoryTable', () => {
  it('renders correct rows from mock data', () => {
    render(<CategoryTable data={mockData} />)
    const rows = screen.getAllByRole('row')
    // header + 3 data rows
    expect(rows.length).toBe(4)
  })

  it('rows sorted by profit descending', () => {
    render(<CategoryTable data={mockData} />)
    const rows = screen.getAllByRole('row')
    // row[1] should be Bags (profit 1200), row[2] Shoes (150), row[3] Watches (-50)
    expect(rows[1]).toHaveTextContent('Bags')
    expect(rows[2]).toHaveTextContent('Shoes')
    expect(rows[3]).toHaveTextContent('Watches')
  })

  it('revenue and profit formatted as currency', () => {
    render(<CategoryTable data={mockData} />)
    expect(screen.getByTestId('cat-revenue-Bags')).toHaveTextContent('$3,000.00')
    expect(screen.getByTestId('cat-profit-Bags')).toHaveTextContent('$1,200.00')
  })
})
