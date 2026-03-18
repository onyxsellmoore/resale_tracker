import { useMemo } from 'react'
import type { CategoryBreakdown } from '../types'
import { formatCurrency } from '../utils/format'
import './CategoryTable.css'

interface CategoryTableProps {
  data: CategoryBreakdown[]
}

export function CategoryTable({ data }: CategoryTableProps) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.totalProfit - a.totalProfit),
    [data],
  )

  return (
    <div className="category-card">
      <div className="table-scroll-wrapper">
        <table className="category-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Items Sold</th>
              <th>Revenue</th>
              <th>Profit</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.category}>
                <td>{row.category}</td>
                <td>{row.itemsSold}</td>
                <td data-testid={`cat-revenue-${row.category}`}>
                  {formatCurrency(row.totalRevenue)}
                </td>
                <td
                  className={row.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}
                  data-testid={`cat-profit-${row.category}`}
                >
                  {formatCurrency(row.totalProfit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
