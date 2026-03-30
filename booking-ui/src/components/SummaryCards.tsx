import type { AnalyticsSummary } from '../types'
import { formatCurrency } from '../utils/format'
import { useCountUp } from '../hooks/useCountUp'
import './SummaryCards.css'

interface SummaryCardsProps {
  summary: AnalyticsSummary
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const animatedItemsSold = useCountUp(summary.itemsSold)
  const animatedRevenue = useCountUp(summary.totalRevenue)
  const animatedProfit = useCountUp(summary.totalProfit)

  const profitClass = summary.totalProfit >= 0 ? 'summary-card-value-gold' : 'summary-card-value-loss'

  const profitMargin = summary.totalRevenue === 0
    ? '—'
    : `${((summary.totalProfit / summary.totalRevenue) * 100).toFixed(1)}%`

  const marginClass = summary.totalRevenue === 0
    ? ''
    : summary.totalProfit >= 0 ? 'summary-card-value-gold' : 'summary-card-value-loss'

  const cards = [
    { label: 'Items Sold', value: String(Math.round(animatedItemsSold)), testId: 'card-itemsSold' },
    { label: 'Total Revenue', value: formatCurrency(animatedRevenue), testId: 'card-totalRevenue' },
    { label: 'Total Fees', value: formatCurrency(summary.totalFees), testId: 'card-totalFees' },
    { label: 'Net Proceeds', value: formatCurrency(summary.totalNetProceeds), testId: 'card-netProceeds' },
    { label: 'Cost of Goods', value: formatCurrency(summary.totalCostOfGoods), testId: 'card-costOfGoods' },
    {
      label: 'Total Profit',
      value: formatCurrency(animatedProfit),
      testId: 'card-totalProfit',
      valueClass: profitClass,
      isProfit: true,
    },
    {
      label: 'Profit Margin',
      value: profitMargin,
      testId: 'card-profitMargin',
      valueClass: marginClass,
    },
  ]

  return (
    <div className="summary-grid">
      {cards.map((card) => (
        <div
          key={card.testId}
          data-testid={card.testId}
          className={`summary-card${card.isProfit ? ' summary-card-profit' : ''}`}
        >
          <div className="summary-card-label">{card.label}</div>
          <div className={`summary-card-value ${card.valueClass ?? ''}`}>{card.value}</div>
        </div>
      ))}
    </div>
  )
}
