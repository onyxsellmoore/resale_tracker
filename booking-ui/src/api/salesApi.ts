import { apiFetch } from './apiClient'
import type { SaleDTO, CreateSalePayload, UpdateSalePayload } from '../types'

const API_BASE = '/api/v1'

function authHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export async function getSales(businessId: string, platform?: string, token?: string): Promise<SaleDTO[]> {
  const params = new URLSearchParams({ businessId })
  if (platform) params.append('platform', platform)
  const res = await apiFetch(`${API_BASE}/sales?${params}`, {
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error('Failed to fetch sales')
  return res.json()
}

export interface CreateSaleResult {
  sale?: SaleDTO
  error?: string
  status: number
}

export async function createSale(payload: CreateSalePayload, token?: string): Promise<CreateSaleResult> {
  const res = await apiFetch(`${API_BASE}/sales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  })
  const body = await res.json()
  if (res.status === 409) {
    return { error: body.message || 'Item is already sold', status: 409 }
  }
  if (!res.ok) {
    return { error: body.message || 'Failed to create sale', status: res.status }
  }
  return { sale: body, status: 201 }
}

export async function getSale(id: string, token?: string): Promise<SaleDTO> {
  const res = await apiFetch(`${API_BASE}/sales/${id}`, {
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error('Failed to fetch sale')
  return res.json()
}

export async function updateSale(id: string, payload: UpdateSalePayload, token?: string): Promise<SaleDTO> {
  const res = await apiFetch(`${API_BASE}/sales/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message ?? 'Failed to update sale')
  }
  return res.json()
}

export async function deleteSale(id: string, token?: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/sales/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error('Failed to delete sale')
}
