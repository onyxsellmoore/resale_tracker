import type { ItemDTO, CreateItemPayload } from '../types'

const API_BASE = '/api/v1'

function authHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export async function getItems(businessId: string, status?: string, token?: string): Promise<ItemDTO[]> {
  const params = new URLSearchParams({ businessId })
  if (status) params.append('status', status)
  const res = await fetch(`${API_BASE}/items?${params}`, {
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error('Failed to fetch items')
  return res.json()
}

export async function createItem(payload: CreateItemPayload, token?: string): Promise<ItemDTO> {
  const res = await fetch(`${API_BASE}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to create item')
  return res.json()
}
