import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { updateSale } from '../api/salesApi'
import type { SaleDTO } from '../types'
import './Form.css'

interface EditSaleFormProps {
  sale: SaleDTO
  onSuccess: () => void
}

export function EditSaleForm({ sale, onSuccess }: EditSaleFormProps) {
  const { token } = useAuth()
  const [platform, setPlatform] = useState(sale.platform)
  const [salePrice, setSalePrice] = useState(sale.salePrice.toString())
  const [platformFees, setPlatformFees] = useState(sale.platformFees.toString())
  const [soldAt, setSoldAt] = useState(sale.soldAt.split('T')[0])
  const [notes, setNotes] = useState(sale.notes ?? '')
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validationErrors: string[] = []
    if (!platform.trim()) validationErrors.push('Platform is required')
    const priceNum = parseFloat(salePrice)
    if (isNaN(priceNum) || priceNum < 0) validationErrors.push('Sale price must be 0 or greater')
    const feesNum = parseFloat(platformFees)
    if (isNaN(feesNum) || feesNum < 0) validationErrors.push('Platform fees must be 0 or greater')
    if (!soldAt) validationErrors.push('Date sold is required')

    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors([])
    setSubmitting(true)

    try {
      await updateSale(sale.id, {
        platform: platform.trim(),
        salePrice: priceNum,
        platformFees: feesNum,
        soldAt: new Date(soldAt).toISOString(),
        notes: notes.trim() || undefined,
      }, token ?? undefined)

      onSuccess()
    } catch {
      setErrors(['Failed to update sale'])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-card">
      <h2>Edit Sale</h2>

      {errors.map((err, i) => (
        <div key={i} className="form-error">{err}</div>
      ))}

      <div className="form-group">
        <label htmlFor="edit-sale-platform">Platform</label>
        <input id="edit-sale-platform" aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)} className="form-input" />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="edit-sale-price">Sale Price</label>
          <input id="edit-sale-price" aria-label="Sale Price" type="number" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="form-input" />
        </div>
        <div className="form-group">
          <label htmlFor="edit-sale-fees">Platform Fees</label>
          <input id="edit-sale-fees" aria-label="Platform Fees" type="number" step="0.01" value={platformFees} onChange={(e) => setPlatformFees(e.target.value)} className="form-input" />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="edit-sale-date">Date Sold</label>
        <input id="edit-sale-date" aria-label="Date Sold" type="date" value={soldAt} onChange={(e) => setSoldAt(e.target.value)} className="form-input" />
      </div>

      <div className="form-group">
        <label htmlFor="edit-sale-notes">Notes</label>
        <textarea id="edit-sale-notes" aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="form-input" />
      </div>

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  )
}
