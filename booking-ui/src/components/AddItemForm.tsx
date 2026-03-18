import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { createItem } from '../api/inventoryApi'
import type { ItemCondition } from '../types'
import './Form.css'

interface AddItemFormProps {
  businessId: string
  onItemAdded: () => void
}

export function AddItemForm({ businessId, onItemAdded }: AddItemFormProps) {
  const { token } = useAuth()
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [condition, setCondition] = useState<ItemCondition>('GOOD')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
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
      await createItem({
        businessId,
        name: name.trim(),
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        condition,
        purchasePrice: priceNum,
        purchaseDate: new Date(purchaseDate).toISOString(),
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
      }, token ?? undefined)

      setName('')
      setBrand('')
      setCategory('')
      setCondition('GOOD')
      setPurchasePrice('')
      setPurchaseDate(new Date().toISOString().split('T')[0])
      setDescription('')
      setNotes('')
      onItemAdded()
    } catch {
      setErrors(['Failed to create item'])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-card">
      <h2>Add Item</h2>

      {errors.map((err, i) => (
        <div key={i} className="form-error">{err}</div>
      ))}

      <div className="form-group">
        <label htmlFor="item-name">Name</label>
        <input id="item-name" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} className="form-input" />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="item-brand">Brand</label>
          <input id="item-brand" aria-label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} className="form-input" />
        </div>
        <div className="form-group">
          <label htmlFor="item-category">Category</label>
          <input id="item-category" aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="form-input" />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="item-condition">Condition</label>
        <select id="item-condition" aria-label="Condition" value={condition} onChange={(e) => setCondition(e.target.value as ItemCondition)} className="form-input">
          <option value="EXCELLENT">Excellent</option>
          <option value="GOOD">Good</option>
          <option value="FAIR">Fair</option>
          <option value="POOR">Poor</option>
        </select>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="item-price">Purchase Price</label>
          <input id="item-price" aria-label="Purchase Price" type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="form-input" />
        </div>
        <div className="form-group">
          <label htmlFor="item-date">Purchase Date</label>
          <input id="item-date" aria-label="Purchase Date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="form-input" />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="item-description">Description</label>
        <textarea id="item-description" aria-label="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="form-input" />
      </div>

      <div className="form-group">
        <label htmlFor="item-notes">Notes</label>
        <textarea id="item-notes" aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="form-input" />
      </div>

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? 'Adding...' : 'Add Item'}
      </button>
    </form>
  )
}
