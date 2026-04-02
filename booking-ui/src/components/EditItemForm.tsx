import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { updateItem } from '../api/inventoryApi'
import type { ItemDTO, ItemCondition } from '../types'
import './Form.css'

interface EditItemFormProps {
  item: ItemDTO
  onItemUpdated: () => void
}

export function EditItemForm({ item, onItemUpdated }: EditItemFormProps) {
  const { token } = useAuth()
  const [name, setName] = useState(item.name)
  const [brand, setBrand] = useState(item.brand ?? '')
  const [category, setCategory] = useState(item.category ?? '')
  const [condition, setCondition] = useState<ItemCondition>(item.condition)
  const [purchasePrice, setPurchasePrice] = useState(item.purchasePrice.toString())
  const [purchaseDate, setPurchaseDate] = useState(item.purchaseDate?.split('T')[0] ?? '')
  const [description, setDescription] = useState(item.description ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validationErrors: string[] = []
    if (!name.trim()) validationErrors.push('Name is required')
    const priceNum = parseFloat(purchasePrice)
    if (isNaN(priceNum) || priceNum < 0) validationErrors.push('Price must be 0 or greater')
    if (!purchaseDate) validationErrors.push('Purchase date is required')

    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors([])
    setSubmitting(true)

    try {
      await updateItem(item.id, {
        name: name.trim(),
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        condition,
        purchasePrice: priceNum,
        purchaseDate: new Date(purchaseDate).toISOString(),
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
      }, token ?? undefined)

      onItemUpdated()
    } catch {
      setErrors(['Failed to update item'])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-card">
      <h2>Edit Item</h2>

      {errors.map((err, i) => (
        <div key={i} className="form-error">{err}</div>
      ))}

      <div className="form-group">
        <label htmlFor="edit-item-name">Name</label>
        <input id="edit-item-name" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} className="form-input" />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="edit-item-brand">Brand</label>
          <input id="edit-item-brand" aria-label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} className="form-input" />
        </div>
        <div className="form-group">
          <label htmlFor="edit-item-category">Category</label>
          <input id="edit-item-category" aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="form-input" />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="edit-item-condition">Condition</label>
        <select id="edit-item-condition" aria-label="Condition" value={condition} onChange={(e) => setCondition(e.target.value as ItemCondition)} className="form-input">
          <option value="NEW">New</option>
          <option value="EXCELLENT">Excellent</option>
          <option value="GOOD">Good</option>
          <option value="FAIR">Fair</option>
          <option value="POOR">Poor</option>
        </select>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="edit-item-price">Purchase Price</label>
          <input id="edit-item-price" aria-label="Purchase Price" type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="form-input" />
        </div>
        <div className="form-group">
          <label htmlFor="edit-item-date">Purchase Date</label>
          <input id="edit-item-date" aria-label="Purchase Date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="form-input" />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="edit-item-description">Description</label>
        <textarea id="edit-item-description" aria-label="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="form-input" />
      </div>

      <div className="form-group">
        <label htmlFor="edit-item-notes">Notes</label>
        <textarea id="edit-item-notes" aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="form-input" />
      </div>

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  )
}
