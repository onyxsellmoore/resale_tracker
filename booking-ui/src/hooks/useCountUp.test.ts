import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCountUp } from './useCountUp'

describe('useCountUp', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0 on the first render', () => {
    const { result } = renderHook(() => useCountUp(100, 600))
    expect(result.current).toBe(0)
  })

  it('returns the target value once the duration has elapsed', () => {
    const { result } = renderHook(() => useCountUp(500, 600))

    // Advance time past the duration
    act(() => {
      vi.advanceTimersByTime(700)
    })

    expect(result.current).toBe(500)
  })

  it('returns 0 immediately when target is 0', () => {
    const { result } = renderHook(() => useCountUp(0, 600))
    expect(result.current).toBe(0)
  })
})
