import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../utils/format'
import type { SaleDTO } from '../types'
import './SalesTable.css'

interface SalesTableProps {
  sales: SaleDTO[]
  onDelete?: (saleId: string) => void
}

type SortKey = 'platform' | 'salePrice' | 'profit' | 'soldAt' | null
type SortDir = 'asc' | 'desc'

const columns: { key: SortKey; label: string }[] = [
  { key: null, label: 'Item Name' },
  { key: null, label: 'Brand' },
  { key: 'platform', label: 'Platform' },
  { key: 'salePrice', label: 'Sale Price' },
  { key: null, label: 'Fees' },
  { key: null, label: 'Net Proceeds' },
  { key: 'profit', label: 'Profit' },
  { key: 'soldAt', label: 'Date Sold' },
  { key: null, label: 'Actions' },
]

function compareSales(a: SaleDTO, b: SaleDTO, key: SortKey, dir: SortDir): number {
  if (!key) return 0
  let cmp = 0
  if (key === 'platform') cmp = a.platform.localeCompare(b.platform)
  else if (key === 'salePrice') cmp = a.salePrice - b.salePrice
  else if (key === 'profit') cmp = a.profit - b.profit
  else if (key === 'soldAt') cmp = a.soldAt.localeCompare(b.soldAt)
  return dir === 'desc' ? -cmp : cmp
}

export function SalesTable({ sales, onDelete }: SalesTableProps) {
  const [platformFilter, setPlatformFilter] = useState('ALL')
  const [sortKey, setSortKey] = useState<SortKey>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const platforms = useMemo(() => {
    const set = new Set(sales.map((s) => s.platform))
    return Array.from(set).sort()
  }, [sales])

  function handleSort(key: SortKey) {
    if (!key) return
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortKey(null); setSortDir('asc') }
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = platformFilter === 'ALL'
    ? sales
    : sales.filter((s) => s.platform === platformFilter)

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => compareSales(a, b, sortKey, sortDir))
  }, [filtered, sortKey, sortDir])

  return (
    <div className="sales-card">
      <div className="sales-filter">
        <label htmlFor="platform-filter">Platform filter</label>
        <select
          id="platform-filter"
          aria-label="Platform filter"
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
        >
          <option value="ALL">All</option>
          {platforms.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="table-scroll-wrapper">
        <table className="sales-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.label}
                  onClick={col.key ? () => handleSort(col.key) : undefined}
                  className={col.key ? 'sortable-th' : ''}
                >
                  {col.label}
                  {sortKey === col.key && col.key && (
                    <span className="sort-indicator">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((sale) => (
              <tr key={sale.id}>
                <td>{sale.itemName}</td>
                <td>{sale.itemBrand}</td>
                <td>{sale.platform}</td>
                <td data-testid={`salePrice-${sale.id}`}>{formatCurrency(sale.salePrice)}</td>
                <td data-testid={`fees-${sale.id}`}>{formatCurrency(sale.platformFees)}</td>
                <td data-testid={`netProceeds-${sale.id}`}>{formatCurrency(sale.netProceeds)}</td>
                <td
                  data-testid={`profit-${sale.id}`}
                  className={sale.profit >= 0 ? 'profit-positive' : 'profit-negative'}
                >
                  {formatCurrency(sale.profit)}
                </td>
                <td>{new Date(sale.soldAt).toLocaleDateString()}</td>
                <td>
                  <Link to={`/sales/edit/${sale.id}`} className="btn-secondary" style={{ textDecoration: 'none' }}>Edit</Link>
                  {onDelete && (
                    <button
                      type="button"
                      className="btn-danger"
                      style={{ marginLeft: 8 }}
                      onClick={() => onDelete(sale.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
