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
import './AnalyticsPage.css'

type Preset = 'this-month' | 'last-month' | 'this-year' | null

function getPresetDates(preset: 'this-month' | 'last-month' | 'this-year') {
  const now = new Date()
  const year = now.getFullYear()

  if (preset === 'this-month') {
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate()
    return {
      from: `${year}-${month}-01`,
      to: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
    }
  }

  if (preset === 'last-month') {
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
    const prevYear = now.getMonth() === 0 ? year - 1 : year
    const month = String(prevMonth + 1).padStart(2, '0')
    const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate()
    return {
      from: `${prevYear}-${month}-01`,
      to: `${prevYear}-${month}-${String(lastDay).padStart(2, '0')}`,
    }
  }

  // this-year
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  }
}

function getCurrentMonth() {
  return getPresetDates('this-month')
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
  const [activePreset, setActivePreset] = useState<Preset>('this-month')
  const queryClient = useQueryClient()

  function applyPreset(preset: 'this-month' | 'last-month' | 'this-year') {
    const dates = getPresetDates(preset)
    setFrom(dates.from)
    setTo(dates.to)
    setActivePreset(preset)
  }

  function handleFromChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFrom(e.target.value)
    setActivePreset(null)
  }

  function handleToChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTo(e.target.value)
    setActivePreset(null)
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', businessId, from, to],
    queryFn: () => getAnalytics(businessId, from, to, token ?? undefined),
  })

  return (
    <div className="page-enter">
      <h1>Analytics</h1>

      <div className="analytics-presets">
        <button
          type="button"
          className={`analytics-preset-btn${activePreset === 'this-month' ? ' analytics-preset-btn-active' : ''}`}
          onClick={() => applyPreset('this-month')}
        >
          This Month
        </button>
        <button
          type="button"
          className={`analytics-preset-btn${activePreset === 'last-month' ? ' analytics-preset-btn-active' : ''}`}
          onClick={() => applyPreset('last-month')}
        >
          Last Month
        </button>
        <button
          type="button"
          className={`analytics-preset-btn${activePreset === 'this-year' ? ' analytics-preset-btn-active' : ''}`}
          onClick={() => applyPreset('this-year')}
        >
          This Year
        </button>
      </div>

      <div className="analytics-date-range">
        <label>
          From:{' '}
          <input type="date" value={from} onChange={handleFromChange} className="form-input analytics-date-input" />
        </label>
        <label>
          To:{' '}
          <input type="date" value={to} onChange={handleToChange} className="form-input analytics-date-input" />
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
          icon={<span aria-hidden="true">&#x1F4CA;</span>}
          title="No data for this period"
          description="Try a wider date range or record a sale first."
        />
      )}

      {data && !isEmptyData(data) && (
        <>
          <SummaryCards summary={data.summary} />

          <div className="chart-grid">
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
