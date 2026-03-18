import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProfitByPlatformChart } from './ProfitByPlatformChart'
import type { PlatformBreakdown } from '../types'

const mockData: PlatformBreakdown[] = [
  { platform: 'Poshmark', itemsSold: 3, totalRevenue: 1500.0, totalProfit: 600.0 },
  { platform: 'Mercari', itemsSold: 2, totalRevenue: 400.0, totalProfit: -50.0 },
]

describe('ProfitByPlatformChart', () => {
  it('renders without crashing given mock data', () => {
    const { container } = render(<ProfitByPlatformChart data={mockData} />)
    expect(container).toBeTruthy()
  })
})
