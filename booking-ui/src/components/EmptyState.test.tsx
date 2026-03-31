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

  it('renders without crashing when icon and action are omitted', () => {
    render(<EmptyState title="No data" description="Nothing here." />)
    expect(screen.getByText('No data')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(document.querySelector('.empty-state-icon')).not.toBeInTheDocument()
  })

  it('renders the icon above the title when provided', () => {
    render(
      <EmptyState
        icon={<span data-testid="test-icon">icon</span>}
        title="No items yet"
        description="Add your first item."
      />
    )
    const icon = screen.getByTestId('test-icon')
    expect(icon).toBeInTheDocument()

    // Icon appears before the title in DOM order
    const container = icon.closest('.empty-state')!
    const children = Array.from(container.children)
    const iconWrapper = children.find((el) => el.classList.contains('empty-state-icon'))!
    const title = container.querySelector('h3')!
    expect(children.indexOf(iconWrapper)).toBeLessThan(children.indexOf(title))
  })
})
