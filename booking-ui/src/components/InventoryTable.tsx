import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { ItemDTO, ItemStatus } from '../types'
import './InventoryTable.css'

interface InventoryTableProps {
  items: ItemDTO[]
  onDelete?: (itemId: string) => void
}

const badgeClass: Record<string, string> = {
  AVAILABLE: 'status-badge status-badge-available',
  SOLD: 'status-badge status-badge-sold',
  UNKNOWN: 'status-badge status-badge-unknown',
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

export function InventoryTable({ items, onDelete }: InventoryTableProps) {
  const [statusFilter, setStatusFilter] = useState<FilterValue>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

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

  const filtered = useMemo(() => {
    let result = statusFilter === 'ALL'
      ? items
      : items.filter((item) => item.status === statusFilter)

    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase()
      result = result.filter(
        (item) =>
          (item.name ?? '').toLowerCase().includes(query) ||
          (item.brand ?? '').toLowerCase().includes(query)
      )
    }

    return result
  }, [items, statusFilter, debouncedSearch])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => compareItems(a, b, sortKey, sortDir))
  }, [filtered, sortKey, sortDir])

  return (
    <div className="inventory-card">
      <div className="inventory-filter">
        <div className="search-filter">
          <label htmlFor="search-input">Search</label>
          <input
            id="search-input"
            type="text"
            aria-label="Search inventory"
            placeholder="Search by name or brand…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="status-filter-row">
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
            <option value="UNKNOWN">Unknown</option>
          </select>
        </div>
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
              <tr key={item.id} data-testid={`item-row-${item.id}`} className={confirmingDeleteId === item.id ? 'row-delete-confirm' : ''}>
                <td>{item.name}</td>
                <td>{item.brand}</td>
                <td className="hide-mobile">{item.category}</td>
                <td className="hide-mobile">{item.condition}</td>
                <td>${item.purchasePrice.toFixed(2)}</td>
                <td>{new Date(item.purchaseDate).toLocaleDateString()}</td>
                <td>
                  <span
                    data-testid={`status-badge-${item.id}`}
                    className={badgeClass[item.status] ?? 'status-badge status-badge-unknown'}
                  >
                    {item.status.charAt(0) + item.status.slice(1).toLowerCase()}
                  </span>
                </td>
                <td>
                  <div className="actions-cell">
                    <Link to={`/inventory/edit/${item.id}`} className="btn-action">Edit</Link>
                    {item.status === 'AVAILABLE' && (
                      <Link to={`/sales/new?itemId=${item.id}`} className="btn-action">Mark Sold</Link>
                    )}
                    {item.status !== 'SOLD' && (
                      <>
                        {onDelete && confirmingDeleteId === item.id ? (
                          <>
                            <button
                              type="button"
                              className="btn-action btn-confirm-delete"
                              onClick={() => { onDelete(item.id); setConfirmingDeleteId(null) }}
                            >
                              Yes, delete
                            </button>
                            <button
                              type="button"
                              className="btn-action btn-ghost"
                              onClick={() => setConfirmingDeleteId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : onDelete && (
                          <button
                            type="button"
                            className="btn-action btn-danger"
                            onClick={() => setConfirmingDeleteId(item.id)}
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {debouncedSearch && sorted.length === 0 && (
          <div className="search-empty-state" data-testid="search-empty-state">
            <div className="search-empty-icon" aria-hidden="true">&#x1F50D;</div>
            <p>No items matching &apos;{debouncedSearch}&apos;</p>
            <button type="button" className="btn-action" onClick={() => setSearchQuery('')}>
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
