import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { MonthBreakdown } from '../types'
import { CHART_COLORS } from '../utils/chartColors'

interface MonthlyTrendChartProps {
  data: MonthBreakdown[]
}

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
        <XAxis dataKey="month" stroke={CHART_COLORS.textMuted} />
        <YAxis stroke={CHART_COLORS.textMuted} />
        <Tooltip
          formatter={(value: number) => `$${value.toFixed(2)}`}
          contentStyle={{ background: CHART_COLORS.surface2, border: `1px solid ${CHART_COLORS.border}` }}
        />
        <Legend />
        <Line type="monotone" dataKey="totalRevenue" stroke={CHART_COLORS.gold} name="Revenue" />
        <Line type="monotone" dataKey="totalProfit" stroke={CHART_COLORS.profit} name="Profit" />
      </LineChart>
    </ResponsiveContainer>
  )
}
