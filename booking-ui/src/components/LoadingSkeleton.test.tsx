import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LoadingSkeleton } from './LoadingSkeleton'

describe('LoadingSkeleton', () => {
  it('renders without crashing', () => {
    render(<LoadingSkeleton />)
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
  })

  it('the rendered element has a class that maps to the pulse animation', () => {
    render(<LoadingSkeleton />)
    const bars = screen.getByTestId('loading-skeleton').querySelectorAll('.skeleton-bar')
    expect(bars.length).toBeGreaterThan(0)
    bars.forEach((bar) => {
      expect(bar.className).toContain('skeleton-bar')
    })
  })
})
