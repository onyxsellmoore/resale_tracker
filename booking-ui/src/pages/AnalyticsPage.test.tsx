import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { AnalyticsPage } from './AnalyticsPage'

vi.mock('../api/analyticsApi', () => ({
  getAnalytics: vi.fn(),
}))

import { getAnalytics } from '../api/analyticsApi'
const mockGetAnalytics = vi.mocked(getAnalytics)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    })
    mockGetAnalytics.mockResolvedValue({
      summary: { itemsSold: 0, totalRevenue: 0, totalFees: 0, totalNetProceeds: 0, totalCostOfGoods: 0, totalProfit: 0, averageMargin: 0, pendingCostItemsCount: 0 },
      byPlatform: [],
      byCategory: [],
      byMonth: [],
    })
  })

  it('renders without throwing', () => {
    expect(() => renderPage()).not.toThrow()
  })

  it('shows pending cost banner when pendingCostItemsCount > 0', async () => {
    mockGetAnalytics.mockResolvedValue({
      summary: { itemsSold: 3, totalRevenue: 300, totalFees: 30, totalNetProceeds: 270, totalCostOfGoods: 0, totalProfit: 270, averageMargin: 90, pendingCostItemsCount: 5 },
      byPlatform: [], byCategory: [], byMonth: [],
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('pending-count')).toHaveTextContent('5')
    })
    expect(screen.getByText(/estimated \$0 purchase price/i)).toBeInTheDocument()
  })

  it('hides pending cost banner after dismiss click', async () => {
    mockGetAnalytics.mockResolvedValue({
      summary: { itemsSold: 3, totalRevenue: 300, totalFees: 30, totalNetProceeds: 270, totalCostOfGoods: 0, totalProfit: 270, averageMargin: 90, pendingCostItemsCount: 2 },
      byPlatform: [], byCategory: [], byMonth: [],
    })
    renderPage()
    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByTestId('pending-count')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByTestId('pending-count')).not.toBeInTheDocument()
  })

  it('does not show pending banner when pendingCostItemsCount is 0', async () => {
    mockGetAnalytics.mockResolvedValue({
      summary: { itemsSold: 3, totalRevenue: 300, totalFees: 30, totalNetProceeds: 270, totalCostOfGoods: 100, totalProfit: 170, averageMargin: 56.7, pendingCostItemsCount: 0 },
      byPlatform: [], byCategory: [], byMonth: [],
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('card-totalProfit')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('pending-count')).not.toBeInTheDocument()
  })

  it('clicking "This Month" sets from to first day and to to last day of current month', async () => {
    renderPage()
    const user = userEvent.setup()
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate()
    const expectedFrom = `${year}-${month}-01`
    const expectedTo = `${year}-${month}-${String(lastDay).padStart(2, '0')}`

    await user.click(screen.getByRole('button', { name: /this month/i }))

    await waitFor(() => {
      const fromInput = screen.getByLabelText(/from/i) as HTMLInputElement
      const toInput = screen.getByLabelText(/to/i) as HTMLInputElement
      expect(fromInput.value).toBe(expectedFrom)
      expect(toInput.value).toBe(expectedTo)
    })
  })
})
