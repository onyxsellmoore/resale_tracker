// @ts-nocheck
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('ThemeTest', () => {
  const themeCss = readFileSync(resolve(__dirname, 'theme.css'), 'utf-8')

  it('src/theme.css exists and contains "--color-gold"', () => {
    expect(themeCss).toContain('--color-gold')
  })

  it('src/theme.css contains "--font-display"', () => {
    expect(themeCss).toContain('--font-display')
  })

  it('src/theme.css contains "--color-bg"', () => {
    expect(themeCss).toContain('--color-bg')
  })
})
