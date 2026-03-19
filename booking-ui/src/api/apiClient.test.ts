import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetch, AuthError } from './apiClient'

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('passes through successful responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 })))
    const res = await apiFetch('/api/v1/items')
    expect(res.status).toBe(200)
  })

  it('throws AuthError on 401 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 })))
    await expect(apiFetch('/api/v1/items')).rejects.toThrow(AuthError)
  })

  it('AuthError has message "Session expired"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 })))
    await expect(apiFetch('/api/v1/items')).rejects.toThrow('Session expired')
  })

  it('passes headers and options through to fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', mockFetch)

    await apiFetch('/api/v1/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: '{}',
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/items', expect.objectContaining({
      method: 'POST',
      body: '{}',
    }))
    const passedHeaders = mockFetch.mock.calls[0][1].headers
    expect(passedHeaders['Authorization']).toBe('Bearer tok')
  })

  it('does not throw AuthError on non-401 error responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad', { status: 400 })))
    const res = await apiFetch('/api/v1/items')
    expect(res.status).toBe(400)
  })
})
