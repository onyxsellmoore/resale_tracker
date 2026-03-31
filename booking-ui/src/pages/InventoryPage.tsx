import { useState, useCallback, useRef } from 'react'
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { getItems, getItem, deleteItem } from '../api/inventoryApi'
import type { ItemDTO } from '../types'
import { InventoryTable } from '../components/InventoryTable'
import { AddItemForm } from '../components/AddItemForm'
import { EditItemForm } from '../components/EditItemForm'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ErrorMessage } from '../components/ErrorMessage'
import { EmptyState } from '../components/EmptyState'
import { Toast } from '../components/Toast'

interface PendingDelete {
  itemId: string
  snapshot: ItemDTO
  timer: ReturnType<typeof setTimeout>
}

function InventoryListView() {
  const { orgId, token } = useAuth()
  const businessId = orgId ?? 'default'
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [undoHandler, setUndoHandler] = useState<(() => void) | null>(null)
  const pendingDeleteRef = useRef<PendingDelete | null>(null)

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['items', businessId],
    queryFn: () => getItems(businessId, undefined, token ?? undefined),
  })

  const handleDismissToast = useCallback(() => {
    setToast(null)
    setUndoHandler(null)
  }, [])

  function handleItemAdded() {
    queryClient.invalidateQueries({ queryKey: ['items', businessId] })
    setToast('Item added to inventory.')
    setUndoHandler(null)
  }

  function handleDeleteItem(itemId: string) {
    const queryKey = ['items', businessId]
    const currentItems = queryClient.getQueryData<ItemDTO[]>(queryKey)
    const snapshot = currentItems?.find((item) => item.id === itemId)
    if (!snapshot) return

    // Optimistically remove from cache
    queryClient.setQueryData<ItemDTO[]>(queryKey, (old) =>
      old ? old.filter((item) => item.id !== itemId) : []
    )

    // Clear any previous pending delete
    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timer)
    }

    const timer = setTimeout(async () => {
      pendingDeleteRef.current = null
      try {
        await deleteItem(itemId, token ?? undefined)
        queryClient.invalidateQueries({ queryKey: queryKey })
      } catch {
        // Restore on API failure
        queryClient.setQueryData<ItemDTO[]>(queryKey, (old) =>
          old ? [...old, snapshot] : [snapshot]
        )
        setToast('Failed to delete item.')
        setUndoHandler(null)
      }
    }, 5000)

    pendingDeleteRef.current = { itemId, snapshot, timer }

    setToast('Item deleted.')
    setUndoHandler(() => () => {
      const pending = pendingDeleteRef.current
      if (!pending) return
      clearTimeout(pending.timer)
      pendingDeleteRef.current = null
      queryClient.setQueryData<ItemDTO[]>(queryKey, (old) =>
        old ? [...old, pending.snapshot] : [pending.snapshot]
      )
    })
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
          icon={<span aria-hidden="true">&#x1F4E6;</span>}
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
          <div className="slide-in-right" style={{ flex: 1, maxWidth: 380 }}>
            <AddItemForm businessId={businessId} onItemAdded={handleItemAdded} />
          </div>
        )}
      </div>
      {toast && (
        <Toast
          message={toast}
          onDismiss={handleDismissToast}
          duration={undoHandler ? 5000 : 3000}
          onUndo={undoHandler ?? undefined}
        />
      )}
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
