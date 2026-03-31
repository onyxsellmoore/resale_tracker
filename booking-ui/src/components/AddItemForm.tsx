import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { createItem } from '../api/inventoryApi'
import type { ItemCondition } from '../types'
import './Form.css'

interface AddItemFormProps {
  businessId: string
  onItemAdded: () => void
}

type FieldErrors = Partial<Record<'name' | 'purchasePrice' | 'purchaseDate' | 'api', string>>

export function AddItemForm({ businessId, onItemAdded }: AddItemFormProps) {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [condition, setCondition] = useState<ItemCondition>('NEW')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function validate(): FieldErrors {
    const errs: FieldErrors = {}
    if (!name.trim()) errs.name = 'Name is required'
    const priceNum = parseFloat(purchasePrice)
    if (isNaN(priceNum) || priceNum < 0) errs.purchasePrice = 'Price must be 0 or greater'
    if (!purchaseDate) errs.purchaseDate = 'Purchase date is required'
    return errs
  }

  function resetFields() {
    setName('')
    setBrand('')
    setCategory('')
    setCondition('NEW')
    setPurchasePrice('')
    setPurchaseDate(new Date().toISOString().split('T')[0])
    setDescription('')
    setNotes('')
    setErrors({})
  }

  async function submitForm(closeOnSuccess: boolean) {
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})
    setSubmitting(true)

    try {
      await createItem({
        businessId,
        name: name.trim(),
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        condition,
        purchasePrice: parseFloat(purchasePrice),
        purchaseDate: new Date(purchaseDate).toISOString(),
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
      }, token ?? undefined)

      resetFields()
      if (closeOnSuccess) {
        onItemAdded()
      } else {
        queryClient.invalidateQueries({ queryKey: ['items', businessId] })
      }
    } catch {
      setErrors({ api: 'Failed to create item' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submitForm(true)
  }

  return (
    <form onSubmit={handleSubmit} className="form-card">
      <h2>Add Item</h2>

      {errors.api && <div className="form-error">{errors.api}</div>}

      <div className="form-group">
        <label htmlFor="item-name">Name</label>
        <input id="item-name" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} className="form-input" />
        {errors.name && <div className="form-error" data-testid="error-name">{errors.name}</div>}
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
          <option value="NEW">New</option>
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
          {errors.purchasePrice && <div className="form-error" data-testid="error-price">{errors.purchasePrice}</div>}
        </div>
        <div className="form-group">
          <label htmlFor="item-date">Purchase Date</label>
          <input id="item-date" aria-label="Purchase Date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="form-input" />
          {errors.purchaseDate && <div className="form-error" data-testid="error-date">{errors.purchaseDate}</div>}
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

      <div className="form-actions">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Adding...' : 'Add Item'}
        </button>
        <button type="button" disabled={submitting} className="btn-secondary" onClick={() => submitForm(false)}>
          Save &amp; Add Another
        </button>
      </div>
    </form>
  )
}
