import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MonthlyTrendChart } from './MonthlyTrendChart'
import type { MonthBreakdown } from '../types'

const mockData: MonthBreakdown[] = [
  { month: '2025-01', itemsSold: 3, totalRevenue: 1500.0, totalProfit: 600.0 },
  { month: '2025-02', itemsSold: 2, totalRevenue: 800.0, totalProfit: 200.0 },
  { month: '2025-03', itemsSold: 4, totalRevenue: 2000.0, totalProfit: 900.0 },
]

describe('MonthlyTrendChart', () => {
  it('renders without crashing given mock data', () => {
    const { container } = render(<MonthlyTrendChart data={mockData} />)
    expect(container).toBeTruthy()
  })
})
