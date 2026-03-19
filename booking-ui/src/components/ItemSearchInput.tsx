import { useState, useRef, useEffect, useMemo } from 'react'
import type { ItemDTO } from '../types'
import './ItemSearchInput.css'

interface ItemSearchInputProps {
  items: ItemDTO[]
  value: string | null
  onChange: (item: ItemDTO | null) => void
  placeholder?: string
  id?: string
  'aria-label'?: string
}

export function ItemSearchInput({ items, value, onChange, placeholder, id, 'aria-label': ariaLabel }: ItemSearchInputProps) {
  const selectedItem = useMemo(() => items.find((i) => i.id === value) ?? null, [items, value])
  const [query, setQuery] = useState(selectedItem?.name ?? '')
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync display text when value changes externally
  useEffect(() => {
    setQuery(selectedItem?.name ?? '')
  }, [selectedItem])

  const filtered = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return items
      .filter((i) => i.name.toLowerCase().includes(q) || (i.brand && i.brand.toLowerCase().includes(q)))
      .slice(0, 8)
  }, [items, query])

  function handleInputChange(val: string) {
    setQuery(val)
    setOpen(val.trim().length > 0)
    setHighlightIndex(-1)
    if (!val.trim()) {
      onChange(null)
    }
  }

  function selectItem(item: ItemDTO) {
    setQuery(item.name)
    setOpen(false)
    onChange(item)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open || filtered.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightIndex >= 0 && highlightIndex < filtered.length) {
        selectItem(filtered[highlightIndex])
      }
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="item-search-container">
      <input
        ref={inputRef}
        id={id}
        aria-label={ariaLabel}
        type="text"
        className="form-input"
        placeholder={placeholder ?? 'Search items...'}
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (query.trim()) setOpen(true) }}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="item-search-results" role="listbox">
          {filtered.map((item, idx) => (
            <li
              key={item.id}
              role="option"
              aria-selected={idx === highlightIndex}
              className={`item-search-result ${idx === highlightIndex ? 'highlighted' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); selectItem(item) }}
            >
              <span className="item-search-name">{item.name}</span>
              {item.brand && <span className="item-search-brand">{item.brand}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
