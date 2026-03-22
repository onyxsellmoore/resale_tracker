import { useState, useCallback } from 'react'
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { getItems, getItem, deleteItem } from '../api/inventoryApi'
import { InventoryTable } from '../components/InventoryTable'
import { AddItemForm } from '../components/AddItemForm'
import { EditItemForm } from '../components/EditItemForm'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ErrorMessage } from '../components/ErrorMessage'
import { EmptyState } from '../components/EmptyState'
import { Toast } from '../components/Toast'

function InventoryListView() {
  const { orgId, token } = useAuth()
  const businessId = orgId ?? 'default'
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['items', businessId],
    queryFn: () => getItems(businessId, undefined, token ?? undefined),
  })

  const handleDismissToast = useCallback(() => setToast(null), [])

  function handleItemAdded() {
    queryClient.invalidateQueries({ queryKey: ['items', businessId] })
    setToast('Item added to inventory.')
  }

  async function handleDeleteItem(itemId: string) {
    try {
      await deleteItem(itemId, token ?? undefined)
      queryClient.invalidateQueries({ queryKey: ['items', businessId] })
      setToast('Item deleted.')
    } catch {
      setToast('Failed to delete item.')
    }
  }

  function renderContent() {
    if (isLoading) return <LoadingSkeleton rows={6} />
    if (error) {
      return (
        <ErrorMessage
          message="Failed to load inventory."
          onRetry={() => queryClient.refetchQueries({ queryKey: ['items', businessId] })}
        />
      )
    }
    if (items.length === 0) {
      return (
        <EmptyState
          title="No items yet"
          description="Add your first item to start tracking inventory."
          action={
            <button type="button" className="btn-primary" onClick={() => setShowAddForm(true)}>
              Add Item
            </button>
          }
        />
      )
    }
    return <InventoryTable items={items} onDelete={handleDeleteItem} />
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1>Inventory</h1>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowAddForm((prev) => !prev)}
        >
          {showAddForm ? 'Hide Form' : 'Add Item'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 40 }}>
        <div style={{ flex: 2 }}>{renderContent()}</div>
        {showAddForm && (
          <div style={{ flex: 1, maxWidth: 380 }}>
            <AddItemForm businessId={businessId} onItemAdded={handleItemAdded} />
          </div>
        )}
      </div>
      {toast && <Toast message={toast} onDismiss={handleDismissToast} />}
    </>
  )
}

function EditItemView() {
  const { id } = useParams<{ id: string }>()
  const { orgId, token } = useAuth()
  const businessId = orgId ?? 'default'
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: item, isLoading, error } = useQuery({
    queryKey: ['items', businessId, id],
    queryFn: () => getItem(id!, token ?? undefined),
    enabled: !!id,
  })

  function handleItemUpdated() {
    queryClient.invalidateQueries({ queryKey: ['items', businessId] })
    navigate('/inventory')
  }

  if (isLoading) return <LoadingSkeleton rows={4} />
  if (error || !item) {
    return (
      <ErrorMessage
        message="Failed to load item."
        onRetry={() => queryClient.refetchQueries({ queryKey: ['items', businessId, id] })}
      />
    )
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <Link to="/inventory" style={{ marginBottom: 8, display: 'inline-block' }}>&larr; Back to Inventory</Link>
      <EditItemForm item={item} onItemUpdated={handleItemUpdated} />
    </div>
  )
}

export function InventoryPage() {
  return (
    <div className="page-enter">
      <Routes>
        <Route index element={<InventoryListView />} />
        <Route path="edit/:id" element={<EditItemView />} />
      </Routes>
    </div>
  )
}
