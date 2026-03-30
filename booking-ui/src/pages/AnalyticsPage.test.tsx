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
      summary: { itemsSold: 0, totalRevenue: 0, totalFees: 0, totalNetProceeds: 0, totalCostOfGoods: 0, totalProfit: 0, averageMargin: 0 },
      byPlatform: [],
      byCategory: [],
      byMonth: [],
    })
  })

  it('renders without throwing', () => {
    expect(() => renderPage()).not.toThrow()
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
