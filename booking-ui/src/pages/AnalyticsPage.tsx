import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { getAnalytics } from '../api/analyticsApi'
import { SummaryCards } from '../components/SummaryCards'
import { ProfitByPlatformChart } from '../components/ProfitByPlatformChart'
import { MonthlyTrendChart } from '../components/MonthlyTrendChart'
import { CategoryTable } from '../components/CategoryTable'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ErrorMessage } from '../components/ErrorMessage'
import { EmptyState } from '../components/EmptyState'

function getCurrentMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate()
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

function isEmptyData(data: Awaited<ReturnType<typeof getAnalytics>>): boolean {
  return data.summary.itemsSold === 0
}

export function AnalyticsPage() {
  const { orgId, token } = useAuth()
  const businessId = orgId ?? 'default'
  const defaults = getCurrentMonth()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', businessId, from, to],
    queryFn: () => getAnalytics(businessId, from, to, token ?? undefined),
  })

  return (
    <div className="page-enter">
      <h1>Analytics</h1>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
        <label>
          From:{' '}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="form-input" style={{ display: 'inline', width: 'auto' }} />
        </label>
        <label>
          To:{' '}
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="form-input" style={{ display: 'inline', width: 'auto' }} />
        </label>
      </div>

      {isLoading && <LoadingSkeleton rows={8} />}

      {error && (
        <ErrorMessage
          message="Failed to load analytics."
          onRetry={() => queryClient.refetchQueries({ queryKey: ['analytics', businessId, from, to] })}
        />
      )}

      {data && isEmptyData(data) && (
        <EmptyState
          title="No data for this period"
          description="Try selecting a wider date range."
        />
      )}

      {data && !isEmptyData(data) && (
        <>
          <SummaryCards summary={data.summary} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
            <div className="chart-card">
              <h2>Profit by Platform</h2>
              <ProfitByPlatformChart data={data.byPlatform} />
            </div>
            <div className="chart-card">
              <h2>Monthly Trend</h2>
              <MonthlyTrendChart data={data.byMonth} />
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <h2>By Category</h2>
            <CategoryTable data={data.byCategory} />
          </div>
        </>
      )}
    </div>
  )
}
