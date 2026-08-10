import { describe, expect, it } from 'vitest'

import { cn, ThemeColor, ThemeMode, themes } from '../index'

describe('ui-core', () => {
  it('merges utility classes deterministically', () => {
    expect(cn('px-2', 'px-4', { hidden: false, block: true })).toBe('px-4 block')
  })

  it('provides a complete light and dark palette for every theme color', () => {
    expect(Object.keys(themes).sort()).toEqual(Object.values(ThemeColor).sort())

    for (const palette of Object.values(themes)) {
      expect(palette[ThemeMode.LIGHT].background).toBeDefined()
      expect(palette[ThemeMode.DARK].background).toBeDefined()
    }
  })

  it('keeps system mode separate from concrete palette modes', () => {
    expect(ThemeMode.SYSTEM).toBe('system')
    expect(Object.keys(themes.orange)).toEqual([ThemeMode.LIGHT, ThemeMode.DARK])
  })
})
