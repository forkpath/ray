import type { ThemeConfig } from '@libs/ui-core'

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { logger } from '@libs/common'

import { getStorage, StorageKey, useStorage } from '~/lib/storage'

describe('extension theme storage', () => {
  it('uses the configured fallback, writes and removes a preference', async () => {
    const { result } = renderHook(() => useStorage(StorageKey.THEME))
    expect(result.current.data).toEqual({ mode: 'system', color: 'orange' })
    act(() => result.current.set({ mode: 'dark', color: 'blue' }))
    await waitFor(() => expect(result.current.data).toEqual({ mode: 'dark', color: 'blue' }))
    expect(await getStorage(StorageKey.THEME).getValue()).toEqual({ mode: 'dark', color: 'blue' })
    act(() => result.current.remove())
    await waitFor(() => expect(result.current.data).toEqual({ mode: 'system', color: 'orange' }))
  })

  it('reads an existing value and reacts to another extension context', async () => {
    const item = getStorage(StorageKey.THEME)
    await item.setValue({ mode: 'light', color: 'green' })
    const { result, unmount } = renderHook(() => useStorage(StorageKey.THEME))
    await waitFor(() => expect(result.current.data.mode).toBe('light'))
    await act(() => item.setValue({ mode: 'dark', color: 'green' }))
    expect(result.current.data.mode).toBe('dark')
    unmount()
  })

  it('unsubscribes from browser changes on unmount', () => {
    const stop = vi.fn()
    vi.spyOn(getStorage(StorageKey.THEME), 'watch').mockReturnValue(stop)
    const { unmount } = renderHook(() => useStorage(StorageKey.THEME))
    unmount()
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('does not overwrite a new preference with a late initial read', async () => {
    let completeRead: (value: ThemeConfig) => void = () => {
      throw new Error('Read not started')
    }
    const initialRead = new Promise<ThemeConfig>(resolve => {
      completeRead = resolve
    })
    const item = getStorage(StorageKey.THEME)
    vi.spyOn(item, 'getValue').mockReturnValueOnce(initialRead)
    const { result } = renderHook(() => useStorage(StorageKey.THEME))
    await act(() => item.setValue({ mode: 'dark', color: 'blue' }))
    await act(async () => {
      completeRead({ mode: 'system', color: 'orange' })
    })
    expect(result.current.data).toEqual({ mode: 'dark', color: 'blue' })
  })

  it('keeps the fallback and reports an unavailable storage backend', async () => {
    const failure = new Error('Storage unavailable')
    vi.spyOn(getStorage(StorageKey.THEME), 'getValue').mockRejectedValueOnce(failure)
    const log = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    const { result } = renderHook(() => useStorage(StorageKey.THEME))
    await waitFor(() => expect(log).toHaveBeenCalledWith('Failed to read extension storage:', failure))
    expect(result.current.data).toEqual({ mode: 'system', color: 'orange' })
  })
})
