import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { ItemDTO, ItemStatus } from '../types'
import './InventoryTable.css'

interface InventoryTableProps {
  items: ItemDTO[]
}

const badgeClass: Record<string, string> = {
  AVAILABLE: 'status-badge status-badge-available',
  SOLD: 'status-badge status-badge-sold',
}

type FilterValue = 'ALL' | ItemStatus
type SortKey = 'name' | 'brand' | 'purchasePrice' | 'purchaseDate' | null
type SortDir = 'asc' | 'desc'

const columns: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'brand', label: 'Brand' },
  { key: null, label: 'Category' },
  { key: null, label: 'Condition' },
  { key: 'purchasePrice', label: 'Purchase Price' },
  { key: 'purchaseDate', label: 'Date Purchased' },
  { key: null, label: 'Status' },
  { key: null, label: 'Actions' },
]

function compareItems(a: ItemDTO, b: ItemDTO, key: SortKey, dir: SortDir): number {
  if (!key) return 0
  let cmp = 0
  if (key === 'name') cmp = (a.name ?? '').localeCompare(b.name ?? '')
  else if (key === 'brand') cmp = (a.brand ?? '').localeCompare(b.brand ?? '')
  else if (key === 'purchasePrice') cmp = a.purchasePrice - b.purchasePrice
  else if (key === 'purchaseDate') cmp = a.purchaseDate.localeCompare(b.purchaseDate)
  return dir === 'desc' ? -cmp : cmp
}

export function InventoryTable({ items }: InventoryTableProps) {
  const [statusFilter, setStatusFilter] = useState<FilterValue>('ALL')
  const [sortKey, setSortKey] = useState<SortKey>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

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

  const filtered = statusFilter === 'ALL'
    ? items
    : items.filter((item) => item.status === statusFilter)

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => compareItems(a, b, sortKey, sortDir))
  }, [filtered, sortKey, sortDir])

  return (
    <div className="inventory-card">
      <div className="inventory-filter">
        <label htmlFor="status-filter">Status filter</label>
        <select
          id="status-filter"
          aria-label="Status filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FilterValue)}
        >
          <option value="ALL">All</option>
          <option value="AVAILABLE">Available</option>
          <option value="SOLD">Sold</option>
        </select>
      </div>

      <div className="table-scroll-wrapper" data-testid="table-scroll-wrapper">
        <table className="inventory-table">
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
            {sorted.map((item) => (
              <tr key={item.id} data-testid={`item-row-${item.id}`}>
                <td>{item.name}</td>
                <td>{item.brand}</td>
                <td className="hide-mobile">{item.category}</td>
                <td className="hide-mobile">{item.condition}</td>
                <td>${item.purchasePrice.toFixed(2)}</td>
                <td>{new Date(item.purchaseDate).toLocaleDateString()}</td>
                <td>
                  <span
                    data-testid={`status-badge-${item.id}`}
                    className={badgeClass[item.status] ?? 'status-badge status-badge-sold'}
                  >
                    {item.status}
                  </span>
                </td>
                <td>
                  {item.status === 'AVAILABLE' && (
                    <Link to={`/sales/new?itemId=${item.id}`} className="record-sale-link">Record a Sale</Link>
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
