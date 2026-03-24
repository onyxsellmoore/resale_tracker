import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import type { PlatformBreakdown } from '../types'
import { CHART_COLORS } from '../utils/chartColors'

interface ProfitByPlatformChartProps {
  data: PlatformBreakdown[]
}

export function ProfitByPlatformChart({ data }: ProfitByPlatformChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
        <XAxis dataKey="platform" stroke={CHART_COLORS.textMuted} />
        <YAxis stroke={CHART_COLORS.textMuted} />
        <Tooltip
          formatter={((value: number) => [`$${value.toFixed(2)}`, 'Profit']) as any}
          contentStyle={{ background: CHART_COLORS.surface2, border: `1px solid ${CHART_COLORS.border}` }}
        />
        <Bar dataKey="totalProfit">
          {data.map((entry) => (
            <Cell key={entry.platform} fill={entry.totalProfit >= 0 ? CHART_COLORS.profit : CHART_COLORS.loss} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
