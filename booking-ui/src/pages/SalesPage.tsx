import { Routes, Route, Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { getSales, getSale, deleteSale } from '../api/salesApi'
import { getItems } from '../api/inventoryApi'
import { SalesTable } from '../components/SalesTable'
import { RecordSaleForm } from '../components/RecordSaleForm'
import { EditSaleForm } from '../components/EditSaleForm'
import { ImportSalesPage } from './ImportSalesPage'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ErrorMessage } from '../components/ErrorMessage'
import { EmptyState } from '../components/EmptyState'

function SalesListView() {
  const { orgId, token } = useAuth()
  const businessId = orgId ?? 'default'
  const queryClient = useQueryClient()
  const { data: sales = [], isLoading, error } = useQuery({
    queryKey: ['sales', businessId],
    queryFn: () => getSales(businessId, undefined, token ?? undefined),
  })

  async function handleDeleteSale(saleId: string) {
    try {
      await deleteSale(saleId, token ?? undefined)
      queryClient.invalidateQueries({ queryKey: ['sales', businessId] })
      queryClient.invalidateQueries({ queryKey: ['items', businessId] })
    } catch {
      // silently fail for now
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Sales</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Link to="/sales/import">
            <button type="button" className="btn-action">Import Sales</button>
          </Link>
          <Link to="/sales/new">
            <button type="button" className="btn-action btn-primary">Record a Sale</button>
          </Link>
        </div>
      </div>
      {isLoading && <LoadingSkeleton rows={6} />}
      {error && (
        <ErrorMessage
          message="Failed to load sales."
          onRetry={() => queryClient.refetchQueries({ queryKey: ['sales', businessId] })}
        />
      )}
      {!isLoading && !error && sales.length === 0 && (
        <EmptyState
          title="No sales recorded"
          description="Once you have items in inventory, record your first sale."
          action={<Link to="/inventory">Go to Inventory</Link>}
        />
      )}
      {!isLoading && !error && sales.length > 0 && <SalesTable sales={sales} onDelete={handleDeleteSale} />}
    </div>
  )
}

function RecordSaleView() {
  const { orgId, token } = useAuth()
  const businessId = orgId ?? 'default'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const preselectedItemId = searchParams.get('itemId') ?? undefined

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['items', businessId],
    queryFn: () => getItems(businessId, undefined, token ?? undefined),
  })

  function handleSuccess() {
    queryClient.invalidateQueries({ queryKey: ['sales', businessId] })
    queryClient.invalidateQueries({ queryKey: ['items', businessId] })
    navigate('/sales')
  }

  if (isLoading) return <LoadingSkeleton rows={4} />
  if (error) {
    return (
      <ErrorMessage
        message="Failed to load items."
        onRetry={() => queryClient.refetchQueries({ queryKey: ['items', businessId] })}
      />
    )
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 8 }}>
        <Link to="/sales">&larr; Back to Sales</Link>
        <Link to="/sales/import">
          <button type="button" className="btn-secondary">Import Sales</button>
        </Link>
      </div>
      <RecordSaleForm
        businessId={businessId}
        items={items}
        onSuccess={handleSuccess}
        preselectedItemId={preselectedItemId}
      />
    </div>
  )
}

function EditSaleView() {
  const { id } = useParams<{ id: string }>()
  const { token, orgId } = useAuth()
  const businessId = orgId ?? 'default'
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: sale, isLoading, error } = useQuery({
    queryKey: ['sale', id],
    queryFn: () => getSale(id!, token ?? undefined),
    enabled: !!id,
  })

  function handleSuccess() {
    queryClient.invalidateQueries({ queryKey: ['sales', businessId] })
    navigate('/sales')
  }

  if (isLoading) return <LoadingSkeleton rows={4} />
  if (error || !sale) {
    return (
      <ErrorMessage
        message="Failed to load sale."
        onRetry={() => queryClient.refetchQueries({ queryKey: ['sale', id] })}
      />
    )
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <Link to="/sales">&larr; Back to Sales</Link>
      <EditSaleForm sale={sale} onSuccess={handleSuccess} />
    </div>
  )
}

export function SalesPage() {
  return (
    <div className="page-enter">
      <Routes>
        <Route index element={<SalesListView />} />
        <Route path="new" element={<RecordSaleView />} />
        <Route path="edit/:id" element={<EditSaleView />} />
        <Route path="import" element={<ImportSalesPage />} />
      </Routes>
    </div>
  )
}
