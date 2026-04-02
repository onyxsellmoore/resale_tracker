import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { updateItem } from '../api/inventoryApi'
import type { ItemDTO } from '../types'
import './CostEntryModal.css'

interface CostEntryModalProps {
  item: ItemDTO
  onClose: () => void
}

/**
 * Modal for entering purchase price and date on imported items.
 * Validates input client-side before calling PATCH /items/:id.
 * Invalidates items, sales, and analytics caches on success.
 */
export function CostEntryModal({ item, onClose }: CostEntryModalProps) {
  if (!item.id || !item.costEntryPending) {
    throw new Error('CostEntryModal requires an item with a valid id and costEntryPending=true')
  }

  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      updateItem(item.id, { purchasePrice: Number(purchasePrice), purchaseDate }, token ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      onClose()
    },
    onError: () => {
      setFieldError('Failed to save — please try again')
    },
  })

  /** Validates inputs and triggers the mutation. */
  function handleSubmit() {
    const parsed = Number(purchasePrice)
    if (purchasePrice === '' || isNaN(parsed)) {
      setFieldError('Purchase price is required')
      return
    }
    if (parsed < 0) {
      setFieldError('Purchase price cannot be negative')
      return
    }
    if (!purchaseDate) {
      setFieldError('Purchase date is required')
      return
    }
    setFieldError(null)
    mutation.mutate()
  }

  return (
    <div className="cost-modal-backdrop" onClick={onClose}>
      <div className="cost-modal-box" role="dialog" aria-label={`Update Purchase Price — ${item.name}`} onClick={(e) => e.stopPropagation()}>
        <h2>Update Purchase Price — {item.name}</h2>

        <label className="cost-modal-label" htmlFor="cost-price">
          Purchase Price
        </label>
        <input
          id="cost-price"
          type="number"
          step="0.01"
          min="0"
          value={purchasePrice}
          onChange={(e) => { setPurchasePrice(e.target.value); setFieldError(null) }}
          className="cost-modal-input"
        />

        <label className="cost-modal-label" htmlFor="cost-date">
          Purchase Date
        </label>
        <input
          id="cost-date"
          type="date"
          value={purchaseDate}
          onChange={(e) => { setPurchaseDate(e.target.value); setFieldError(null) }}
          className="cost-modal-input"
        />

        {fieldError && <p className="cost-modal-error" role="alert">{fieldError}</p>}

        <div className="cost-modal-actions">
          <button
            type="button"
            className="btn-action"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-action btn-primary"
            onClick={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
