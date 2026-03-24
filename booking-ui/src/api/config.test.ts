import { describe, it, expect } from 'vitest'
import { API_BASE } from './config'

describe('API config', () => {
  it('API_BASE ends with /api/v1', () => {
    expect(API_BASE).toMatch(/\/api\/v1$/)
  })

  it('API_BASE uses VITE_API_URL prefix when set', () => {
    // In test env VITE_API_URL is not set, so API_BASE should be relative
    // This confirms the fallback behavior works
    if (!import.meta.env.VITE_API_URL) {
      expect(API_BASE).toBe('/api/v1')
    } else {
      expect(API_BASE).toBe(import.meta.env.VITE_API_URL + '/api/v1')
    }
  })
})
