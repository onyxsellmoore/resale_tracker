import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { createSale } from '../api/salesApi'
import { formatCurrency } from '../utils/format'
import { EmptyState } from './EmptyState'
import type { ItemDTO } from '../types'
import './Form.css'

interface RecordSaleFormProps {
  businessId: string
  items: ItemDTO[]
  onSuccess: () => void
  preselectedItemId?: string
}

export function RecordSaleForm({ businessId, items, onSuccess, preselectedItemId }: RecordSaleFormProps) {
  const { token } = useAuth()
  const availableItems = useMemo(
    () => items.filter((i) => i.status === 'AVAILABLE'),
    [items]
  )

  const [selectedItemId, setSelectedItemId] = useState(preselectedItemId ?? '')
  const [platform, setPlatform] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [platformFees, setPlatformFees] = useState('')
  const [soldAt, setSoldAt] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  if (availableItems.length === 0) {
    return (
      <EmptyState
        title="No items in inventory yet"
        description="Add items to your inventory before recording a sale."
        action={<Link to="/inventory">Go to Inventory</Link>}
      />
    )
  }

  const selectedItem = availableItems.find((i) => i.id === selectedItemId)
  const purchasePrice = selectedItem?.purchasePrice ?? 0
  const salePriceNum = parseFloat(salePrice) || 0
  const feesNum = parseFloat(platformFees) || 0
  const netProceeds = salePriceNum - feesNum
  const profit = netProceeds - purchasePrice

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validationErrors: string[] = []
    if (!selectedItemId) validationErrors.push('Please select an item')
    if (!platform.trim()) validationErrors.push('Platform is required')
    if (salePriceNum <= 0) validationErrors.push('Sale price must be greater than 0')
    if (feesNum < 0) validationErrors.push('Platform fees must be >= 0')
    if (!soldAt) validationErrors.push('Date sold is required')

    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors([])
    setSubmitting(true)

    try {
      const result = await createSale({
        businessId,
        itemId: selectedItemId,
        platform: platform.trim(),
        salePrice: salePriceNum,
        platformFees: feesNum,
        soldAt: new Date(soldAt).toISOString(),
        notes: notes.trim() || undefined,
      }, token ?? undefined)

      if (result.status === 409) {
        setErrors([result.error ?? 'Item is already sold'])
        return
      }

      if (result.error) {
        setErrors([result.error])
        return
      }

      onSuccess()
    } catch {
      setErrors(['Failed to create sale'])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-card">
      <h2>Record a Sale</h2>

      {errors.map((err, i) => (
        <div key={i} className="form-error">{err}</div>
      ))}

      <div className="form-group">
        <label htmlFor="sale-item">Item</label>
        <select id="sale-item" aria-label="Item" value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} className="form-input">
          <option value="">Select an item...</option>
          {availableItems.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="sale-platform">Platform</label>
        <input id="sale-platform" aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="e.g. Poshmark, Mercari, Vestiaire" className="form-input" />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="sale-price">Sale Price</label>
          <input id="sale-price" aria-label="Sale Price" type="number" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="form-input" />
        </div>
        <div className="form-group">
          <label htmlFor="sale-fees">Platform Fees</label>
          <input id="sale-fees" aria-label="Platform Fees" type="number" step="0.01" value={platformFees} onChange={(e) => setPlatformFees(e.target.value)} className="form-input" />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="sale-date">Date Sold</label>
        <input id="sale-date" aria-label="Date Sold" type="date" value={soldAt} onChange={(e) => setSoldAt(e.target.value)} className="form-input" />
      </div>

      <div className="form-group">
        <label htmlFor="sale-notes">Notes</label>
        <textarea id="sale-notes" aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="form-input" />
      </div>

      {selectedItem && (
        <div data-testid="profit-preview" className="profit-preview">
          <div>Purchase price: {formatCurrency(purchasePrice)} | Net proceeds: {formatCurrency(netProceeds)}</div>
          <div className={`profit-value ${profit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
            Profit: {formatCurrency(profit)}
          </div>
        </div>
      )}

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? 'Recording...' : 'Record Sale'}
      </button>
    </form>
  )
}
