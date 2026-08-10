import { describe, expect, it } from 'vitest'

import { cn } from './cn'

describe('ui-native class composition', () => {
  it('reuses the universal class merger', () => {
    expect(cn('px-2', 'px-4', { hidden: false, flex: true })).toBe('px-4 flex')
  })
})
