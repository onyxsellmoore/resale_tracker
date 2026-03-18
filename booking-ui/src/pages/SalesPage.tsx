import { Routes, Route, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { getSales } from '../api/salesApi'
import { getItems } from '../api/inventoryApi'
import { SalesTable } from '../components/SalesTable'
import { RecordSaleForm } from '../components/RecordSaleForm'
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1>Sales</h1>
        <Link to="/sales/new">
          <button type="button" className="btn-primary">Record a Sale</button>
        </Link>
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
      {!isLoading && !error && sales.length > 0 && <SalesTable sales={sales} />}
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
      <Link to="/sales">&larr; Back to Sales</Link>
      <RecordSaleForm
        businessId={businessId}
        items={items}
        onSuccess={handleSuccess}
        preselectedItemId={preselectedItemId}
      />
    </div>
  )
}

export function SalesPage() {
  return (
    <div className="page-enter">
      <Routes>
        <Route index element={<SalesListView />} />
        <Route path="new" element={<RecordSaleView />} />
      </Routes>
    </div>
  )
}
