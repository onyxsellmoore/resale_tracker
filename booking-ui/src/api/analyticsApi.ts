import { apiFetch } from './apiClient'
import { API_BASE } from './config'
import type { AnalyticsResult } from '../types'

function authHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export async function getAnalytics(
  businessId: string,
  from: string,
  to: string,
  token?: string,
): Promise<AnalyticsResult> {
  const params = new URLSearchParams({ businessId, from, to })
  const res = await apiFetch(`${API_BASE}/analytics?${params}`, {
    headers: authHeaders(token),
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch analytics: ${res.status}`)
  }
  return res.json() as Promise<AnalyticsResult>
}
