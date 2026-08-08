import { describe, expect, it, vi } from 'vitest'

import { reconcile } from '../reconcile'

interface App {
  name: string
}

describe('reconcile', () => {
  it('creates only missing items', async () => {
    const existing: Array<{ id: string; name: string }> = [{ id: '1', name: 'ray-web' }]
    const create = vi.fn(async (a: App) => ({ id: 'new-' + a.name }))
    const desired: App[] = [{ name: 'ray-web' }, { name: 'ray-mobile' }]

    const result = await reconcile(
      { list: async () => existing, create },
      desired,
      d => d.name,
      e => e.name
    )

    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({ name: 'ray-mobile' })
    expect(result.created).toEqual(['ray-mobile'])
    expect(result.skipped).toEqual(['ray-web'])
  })

  it('is idempotent on a second run (everything already exists)', async () => {
    const existing = [{ name: 'ray-web' }, { name: 'ray-mobile' }]
    const create = vi.fn(async (a: App) => ({ id: a.name }))

    const result = await reconcile(
      { list: async () => existing, create },
      [{ name: 'ray-web' }, { name: 'ray-mobile' }],
      d => d.name,
      e => e.name
    )

    expect(create).not.toHaveBeenCalled()
    expect(result.created).toEqual([])
    expect(result.skipped).toEqual(['ray-web', 'ray-mobile'])
  })

  it('does not create the same key twice within one batch', async () => {
    const create = vi.fn(async (a: App) => ({ id: a.name }))
    const result = await reconcile(
      { list: async (): Promise<App[]> => [], create },
      [{ name: 'dup' }, { name: 'dup' }],
      d => d.name,
      e => e.name
    )
    expect(create).toHaveBeenCalledTimes(1)
    expect(result.created).toEqual(['dup'])
    expect(result.skipped).toEqual(['dup'])
  })
})
