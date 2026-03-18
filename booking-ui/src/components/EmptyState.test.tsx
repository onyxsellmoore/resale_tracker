import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders the title and description props', () => {
    render(<EmptyState title="No items yet" description="Add your first item." />)
    expect(screen.getByText('No items yet')).toBeInTheDocument()
    expect(screen.getByText('Add your first item.')).toBeInTheDocument()
  })

  it('renders the action element when provided', () => {
    render(
      <EmptyState
        title="No items yet"
        description="Add your first item."
        action={<button>Add Item</button>}
      />
    )
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument()
  })

  it('renders without crashing when action is omitted', () => {
    render(<EmptyState title="No data" description="Nothing here." />)
    expect(screen.getByText('No data')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
