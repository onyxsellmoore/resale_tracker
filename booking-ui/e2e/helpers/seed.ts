import { type APIRequestContext } from '@playwright/test'

const API_BASE = 'http://localhost:8080/api/v1'

export async function createAvailableItem(
  request: APIRequestContext,
  adminToken: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const payload = {
    name: `E2E Item ${Date.now()}`,
    brand: 'Test Brand',
    category: 'Test Category',
    condition: 'GOOD',
    purchasePrice: 100.00,
    purchaseDate: new Date().toISOString(),
    ...overrides,
  }

  const res = await request.post(`${API_BASE}/items`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    data: payload,
  })

  const body = await res.json()
  return body.id
}

export async function getAdminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      email: process.env.ADMIN_EMAIL ?? 'admin@test.com',
      password: process.env.ADMIN_PASSWORD ?? 'TestAdmin1!',
    },
  })

  const body = await res.json()
  return body.token
}
