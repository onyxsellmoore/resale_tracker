import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SummaryCards } from './SummaryCards'
import type { AnalyticsSummary } from '../types'

const positiveSummary: AnalyticsSummary = {
  itemsSold: 5,
  totalRevenue: 2500.0,
  totalFees: 350.0,
  totalNetProceeds: 2150.0,
  totalCostOfGoods: 800.0,
  totalProfit: 1350.0,
  averageMargin: 54.0,
}

const negativeSummary: AnalyticsSummary = {
  itemsSold: 2,
  totalRevenue: 100.0,
  totalFees: 30.0,
  totalNetProceeds: 70.0,
  totalCostOfGoods: 200.0,
  totalProfit: -130.0,
  averageMargin: -130.0,
}

describe('SummaryCards', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  function renderAndFinishAnimations(summary: AnalyticsSummary) {
    render(<SummaryCards summary={summary} />)
    act(() => { vi.advanceTimersByTime(700) })
  }

  it('renders all 6 cards', () => {
    renderAndFinishAnimations(positiveSummary)
    expect(screen.getByText('Items Sold')).toBeInTheDocument()
    expect(screen.getByText('Total Revenue')).toBeInTheDocument()
    expect(screen.getByText('Total Fees')).toBeInTheDocument()
    expect(screen.getByText('Net Proceeds')).toBeInTheDocument()
    expect(screen.getByText('Cost of Goods')).toBeInTheDocument()
    expect(screen.getByText('Total Profit')).toBeInTheDocument()
  })

  it('revenue formatted as "$X,XXX.00"', () => {
    renderAndFinishAnimations(positiveSummary)
    expect(screen.getByTestId('card-totalRevenue')).toHaveTextContent('$2,500.00')
  })

  it('positive profit card has green styling', () => {
    renderAndFinishAnimations(positiveSummary)
    const profitCard = screen.getByTestId('card-totalProfit')
    expect(profitCard.className).toContain('summary-card-profit')
  })

  it('negative profit card has red styling', () => {
    renderAndFinishAnimations(negativeSummary)
    const profitCard = screen.getByTestId('card-totalProfit')
    expect(profitCard.querySelector('.summary-card-value-loss')).toBeTruthy()
  })
})
