import { useState, useCallback, useRef, useMemo } from 'react'
import { Routes, Route, Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { getItems, getItem, deleteItem } from '../api/inventoryApi'
import type { ItemDTO } from '../types'
import { InventoryTable } from '../components/InventoryTable'
import { AddItemForm } from '../components/AddItemForm'
import { EditItemForm } from '../components/EditItemForm'
import { CostEntryModal } from '../components/CostEntryModal'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ErrorMessage } from '../components/ErrorMessage'
import { EmptyState } from '../components/EmptyState'
import { Toast } from '../components/Toast'
import './InventoryPage.css'

interface PendingDelete {
  itemId: string
  snapshot: ItemDTO
  timer: ReturnType<typeof setTimeout>
}

/** Returns the sessionStorage key for the import-banner dismissal. */
function bannerKey(businessId: string): string {
  return `importBannerDismissed_${businessId}`
}

function InventoryListView() {
  const { orgId, token } = useAuth()
  const businessId = orgId ?? 'default'
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = searchParams.get('filter')
  const importedRaw = searchParams.get('imported')
  const importedCount = importedRaw && /^\d+$/.test(importedRaw) ? importedRaw : null

  const [showAddForm, setShowAddForm] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [undoHandler, setUndoHandler] = useState<(() => void) | null>(null)
  const pendingDeleteRef = useRef<PendingDelete | null>(null)
  const [modalItem, setModalItem] = useState<ItemDTO | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(() =>
    sessionStorage.getItem(bannerKey(businessId)) === '1',
  )

  const showBanner = importedCount && !bannerDismissed

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['items', businessId],
    queryFn: () => getItems(businessId, undefined, token ?? undefined),
  })

  /** Client-side filter for costPending items (MVP). */
  const displayItems = useMemo(() => {
    if (filter === 'costPending') return items.filter((i) => i.costEntryPending)
    return items
  }, [items, filter])

  /** Dismisses the import banner and cleans the URL. */
  function handleDismissBanner() {
    sessionStorage.setItem(bannerKey(businessId), '1')
    setBannerDismissed(true)
    const next = new URLSearchParams(searchParams)
    next.delete('imported')
    setSearchParams(next, { replace: true })
  }

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
    return (
      <InventoryTable
        items={displayItems}
        onDelete={handleDeleteItem}
        onCostEntry={setModalItem}
      />
    )
  }

  return (
    <>
      {showBanner && (
        <div className="import-banner" role="status">
          <p>
            You imported <strong>{importedCount}</strong> sales with estimated profit.
            Add purchase prices to see accurate totals.{' '}
            <button
              type="button"
              className="import-banner-link"
              onClick={() => setSearchParams({ filter: 'costPending' }, { replace: true })}
            >
              Review pending items
            </button>
          </p>
          <button
            type="button"
            className="import-banner-dismiss"
            aria-label="Dismiss"
            onClick={handleDismissBanner}
          >
            &times;
          </button>
        </div>
      )}
      <div className="inventory-header">
        <h1>Inventory</h1>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowAddForm((prev) => !prev)}
        >
          {showAddForm ? 'Hide Form' : 'Add Item'}
        </button>
      </div>
      <div className="inventory-body">
        <div className="inventory-main">{renderContent()}</div>
        {showAddForm && (
          <div className="slide-in-right inventory-sidebar">
            <AddItemForm businessId={businessId} onItemAdded={handleItemAdded} />
          </div>
        )}
      </div>
      {modalItem && (
        <CostEntryModal item={modalItem} onClose={() => setModalItem(null)} />
      )}
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
    <div className="edit-item-container">
      <Link to="/inventory" className="edit-item-back-link">&larr; Back to Inventory</Link>
      <EditItemForm item={item} onItemUpdated={handleItemUpdated} />
    </div>
  )
}

/** Inventory page with nested routes for list and edit views. */
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
