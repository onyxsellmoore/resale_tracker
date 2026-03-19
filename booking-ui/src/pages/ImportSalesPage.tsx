import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { getSales, createSale } from '../api/salesApi'
import { getItems, createItem } from '../api/inventoryApi'
import { validateCsvStructure, parseImportFile } from '../utils/importParser'
import { ItemSearchInput } from '../components/ItemSearchInput'
import type { ParsedSaleRow, ItemDTO, SaleDTO, ItemCondition } from '../types'
import '../components/Form.css'

interface RowState {
  row: ParsedSaleRow
  isDuplicate: boolean
  skipped: boolean
  matchedItemId: string | null
  newItem: NewItemState | null
  showNewItemForm: boolean
}

interface NewItemState {
  purchaseDate: string
  condition: ItemCondition
  purchasePrice: string
  brand: string
  category: string
}

export function ImportSalesPage() {
  const navigate = useNavigate()
  const { orgId, token } = useAuth()
  const businessId = orgId ?? 'default'
  const queryClient = useQueryClient()

  const [step, setStep] = useState(1)
  const [parsedRows, setParsedRows] = useState<ParsedSaleRow[]>([])
  const [rowStates, setRowStates] = useState<RowState[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null)
  const [existingSales, setExistingSales] = useState<SaleDTO[]>([])

  const { data: availableItems = [] } = useQuery({
    queryKey: ['items', businessId, 'AVAILABLE'],
    queryFn: () => getItems(businessId, 'AVAILABLE', token ?? undefined),
    enabled: step >= 2,
  })

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setValidationError(null)
    setParsedRows([])
    setDetectedPlatform(null)

    const text = await file.text()
    const validation = validateCsvStructure(text)

    if (!validation.valid) {
      setValidationError(validation.error ?? 'Invalid file')
      return
    }

    const rows = parseImportFile(text)
    if (rows.length > 0) {
      setDetectedPlatform(rows[0].platform)
    }
    setParsedRows(rows)

    // Load existing sales for duplicate detection
    try {
      const sales = await getSales(businessId, undefined, token ?? undefined)
      setExistingSales(sales)
    } catch {
      setExistingSales([])
    }
  }, [businessId, token])

  function goToStep2() {
    // Build row states with duplicate detection
    const states: RowState[] = parsedRows.map((row) => {
      const isDuplicate = existingSales.some(
        (s) => s.platform === row.platform && s.platformOrderId === row.platformOrderId
      )
      return {
        row,
        isDuplicate,
        skipped: false,
        matchedItemId: null,
        newItem: null,
        showNewItemForm: false,
      }
    })
    setRowStates(states)
    setStep(2)
  }

  function updateRowState(index: number, updates: Partial<RowState>) {
    setRowStates((prev) => prev.map((rs, i) => (i === index ? { ...rs, ...updates } : rs)))
  }

  function isRowResolved(rs: RowState): boolean {
    if (rs.isDuplicate) return true
    if (rs.skipped) return true
    if (rs.matchedItemId) return true
    // If the new-item form is open, the row can only be resolved if the form is valid
    if (rs.showNewItemForm) {
      if (!rs.newItem || !rs.newItem.purchaseDate || !rs.newItem.condition) return false
      // Need purchasePrice if not prefilled
      if (rs.row.prefill.purchasePrice == null) {
        const price = parseFloat(rs.newItem.purchasePrice)
        if (isNaN(price) || rs.newItem.purchasePrice === '') return false
      }
      return true
    }
    return false
  }

  function isStep2Complete(): boolean {
    return rowStates.every(isRowResolved)
  }

  const importableRows = rowStates.filter((rs) => !rs.isDuplicate && !rs.skipped)
  const skippedCount = rowStates.filter((rs) => rs.skipped).length
  const duplicateCount = rowStates.filter((rs) => rs.isDuplicate).length
  const newItemCount = importableRows.filter((rs) => rs.newItem).length

  async function handleConfirmImport() {
    setImporting(true)
    setImportError(null)

    const toImport = importableRows
    setImportProgress({ current: 0, total: toImport.length })

    for (let i = 0; i < toImport.length; i++) {
      setImportProgress({ current: i + 1, total: toImport.length })
      const rs = toImport[i]

      try {
        let itemId = rs.matchedItemId

        if (rs.newItem) {
          const newItemPayload = {
            businessId,
            name: rs.row.title,
            brand: rs.row.prefill.brand ?? (rs.newItem.brand || undefined),
            category: rs.row.prefill.category ?? (rs.newItem.category || undefined),
            condition: rs.newItem.condition,
            purchasePrice: rs.row.prefill.purchasePrice ?? parseFloat(rs.newItem.purchasePrice),
            purchaseDate: new Date(rs.newItem.purchaseDate).toISOString(),
          }
          const created = await createItem(newItemPayload, token ?? undefined)
          itemId = created.id
        }

        const result = await createSale({
          businessId,
          itemId: itemId!,
          platform: rs.row.platform,
          salePrice: rs.row.salePrice,
          platformFees: rs.row.platformFees,
          soldAt: rs.row.soldAt,
          platformOrderId: rs.row.platformOrderId,
        }, token ?? undefined)

        if (result.status === 409) {
          // Race condition: already imported elsewhere, continue
          continue
        }

        if (result.error) {
          setImportError(`Failed to import '${rs.row.title}': ${result.error}`)
          setImporting(false)
          return
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setImportError(`Failed to import '${rs.row.title}': ${msg}`)
        setImporting(false)
        return
      }
    }

    queryClient.invalidateQueries({ queryKey: ['sales', businessId] })
    queryClient.invalidateQueries({ queryKey: ['items', businessId] })
    setImporting(false)
    navigate('/sales')
  }

  // Step 1: Upload
  if (step === 1) {
    return (
      <div className="page-enter" style={{ maxWidth: 700, margin: '0 auto' }}>
        <h1>Import Sales</h1>
        <div className="form-card">
          <div className="form-group">
            <label htmlFor="csv-upload">Select CSV file</label>
            <input
              id="csv-upload"
              aria-label="Select CSV file"
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="form-input"
            />
          </div>

          {validationError && (
            <div className="form-error">{validationError}</div>
          )}

          {parsedRows.length > 0 && !validationError && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Detected <strong>{detectedPlatform}</strong> export — {parsedRows.length} rows parsed.
            </p>
          )}

          <button
            type="button"
            className="btn-primary"
            disabled={parsedRows.length === 0 || !!validationError}
            onClick={goToStep2}
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  // Step 2: Match Items
  if (step === 2) {
    return (
      <div className="page-enter" style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1>Match Items</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
          Match each sale to an existing inventory item or create a new one.
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Platform</th>
              <th style={thStyle}>Sale Price</th>
              <th style={thStyle}>Fees</th>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Match</th>
            </tr>
          </thead>
          <tbody>
            {rowStates.map((rs, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={tdStyle}>{rs.row.title}</td>
                <td style={tdStyle}>{rs.row.platform}</td>
                <td style={tdStyle}>${rs.row.salePrice.toFixed(2)}</td>
                <td style={tdStyle}>${rs.row.platformFees.toFixed(2)}</td>
                <td style={tdStyle}>{rs.row.soldAt.split('T')[0]}</td>
                <td style={tdStyle}>
                  {rs.isDuplicate ? (
                    <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Already imported</span>
                  ) : rs.showNewItemForm ? (
                    <NewItemMiniForm
                      row={rs.row}
                      state={rs.newItem}
                      onChange={(newItem) => updateRowState(idx, { newItem, matchedItemId: null })}
                      onCancel={() => updateRowState(idx, { showNewItemForm: false, newItem: null })}
                    />
                  ) : (
                    <div>
                      <ItemSearchInput
                        items={availableItems}
                        value={rs.matchedItemId}
                        onChange={(item) => updateRowState(idx, { matchedItemId: item?.id ?? null, newItem: null })}
                        aria-label={`Match ${rs.row.title}`}
                        placeholder="Search items..."
                      />
                      <button
                        type="button"
                        style={{ marginTop: 4, background: 'none', border: 'none', color: 'var(--color-brand-hover)', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}
                        onClick={() => updateRowState(idx, {
                          showNewItemForm: true,
                          newItem: {
                            purchaseDate: '',
                            condition: 'NEW',
                            purchasePrice: rs.row.prefill.purchasePrice?.toString() ?? '',
                            brand: rs.row.prefill.brand ?? '',
                            category: rs.row.prefill.category ?? '',
                          },
                          matchedItemId: null,
                        })}
                      >
                        ＋ Create new item
                      </button>
                      <label style={{ display: 'block', marginTop: 4, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        <input
                          type="checkbox"
                          checked={rs.skipped}
                          onChange={(e) => updateRowState(idx, { skipped: e.target.checked })}
                          aria-label={`Skip ${rs.row.title}`}
                        />{' '}
                        Skip this row
                      </label>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 16 }}>
          <button type="button" className="btn-secondary" onClick={() => setStep(1)} style={{ marginRight: 8 }}>
            Back
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!isStep2Complete()}
            onClick={() => setStep(3)}
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  // Step 3: Review & Confirm
  return (
    <div className="page-enter" style={{ maxWidth: 700, margin: '0 auto' }}>
      <h1>Review & Confirm</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
        {importableRows.length} sale{importableRows.length !== 1 ? 's' : ''} to import
        ({newItemCount} new item{newItemCount !== 1 ? 's' : ''} to create, {skippedCount} skipped, {duplicateCount} already imported)
      </p>

      {importableRows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <thead>
            <tr>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Platform</th>
              <th style={thStyle}>Sale Price</th>
              <th style={thStyle}>Fees</th>
              <th style={thStyle}>Item</th>
            </tr>
          </thead>
          <tbody>
            {importableRows.map((rs, idx) => {
              const matched = availableItems.find((i) => i.id === rs.matchedItemId)
              return (
                <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={tdStyle}>{rs.row.title}</td>
                  <td style={tdStyle}>{rs.row.platform}</td>
                  <td style={tdStyle}>${rs.row.salePrice.toFixed(2)}</td>
                  <td style={tdStyle}>${rs.row.platformFees.toFixed(2)}</td>
                  <td style={tdStyle}>{matched ? matched.name : `New: ${rs.row.title}`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {importError && <div className="form-error">{importError}</div>}

      {importProgress && importing && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Importing {importProgress.current} of {importProgress.total}…
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        <button type="button" className="btn-secondary" onClick={() => setStep(2)} style={{ marginRight: 8 }} disabled={importing}>
          Back
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleConfirmImport}
          disabled={importing || importableRows.length === 0}
        >
          {importing ? 'Importing...' : 'Confirm Import'}
        </button>
      </div>
    </div>
  )
}

function NewItemMiniForm({
  row,
  state,
  onChange,
  onCancel,
}: {
  row: ParsedSaleRow
  state: NewItemState | null
  onChange: (state: NewItemState) => void
  onCancel: () => void
}) {
  const s = state ?? { purchaseDate: '', condition: 'NEW' as ItemCondition, purchasePrice: '', brand: '', category: '' }

  function update(field: keyof NewItemState, value: string) {
    onChange({ ...s, [field]: value })
  }

  return (
    <div style={{ fontSize: '0.85rem' }}>
      <div className="form-group">
        <label htmlFor={`pd-${row.platformOrderId}`}>Purchase Date</label>
        <input
          id={`pd-${row.platformOrderId}`}
          aria-label="Purchase Date"
          type="date"
          className="form-input"
          value={s.purchaseDate}
          onChange={(e) => update('purchaseDate', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor={`cond-${row.platformOrderId}`}>Condition</label>
        <select
          id={`cond-${row.platformOrderId}`}
          aria-label="Condition"
          className="form-input"
          value={s.condition}
          onChange={(e) => update('condition', e.target.value)}
        >
          <option value="NEW">New</option>
          <option value="EXCELLENT">Excellent</option>
          <option value="GOOD">Good</option>
          <option value="FAIR">Fair</option>
          <option value="POOR">Poor</option>
        </select>
      </div>

      {!row.prefill.purchasePrice && (
        <div className="form-group">
          <label htmlFor={`pp-${row.platformOrderId}`}>Purchase Price</label>
          <input
            id={`pp-${row.platformOrderId}`}
            aria-label="Purchase Price"
            type="number"
            step="0.01"
            className="form-input"
            value={s.purchasePrice}
            onChange={(e) => update('purchasePrice', e.target.value)}
          />
        </div>
      )}

      {!row.prefill.brand && (
        <div className="form-group">
          <label htmlFor={`brand-${row.platformOrderId}`}>Brand</label>
          <input
            id={`brand-${row.platformOrderId}`}
            aria-label="Brand"
            className="form-input"
            value={s.brand}
            onChange={(e) => update('brand', e.target.value)}
          />
        </div>
      )}

      <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>
        Cancel
      </button>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px',
  borderBottom: '2px solid var(--color-border)',
  color: 'var(--color-text-muted)',
  fontSize: '0.85rem',
}

const tdStyle: React.CSSProperties = {
  padding: '8px',
  fontSize: '0.9rem',
}
