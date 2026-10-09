import type { ThemeConfig } from '@libs/ui-core'
import type { WxtStorageItem } from 'wxt/utils/storage'

import { useEffect, useState } from 'react'

import { storage as browserStorage } from 'wxt/utils/storage'

import { logger } from '@libs/common'

import { appConfig } from '~/config/app'

export const StorageKey = {
  THEME: 'local:theme'
} as const

export type StorageKey = (typeof StorageKey)[keyof typeof StorageKey]

const storage = {
  [StorageKey.THEME]: browserStorage.defineItem<ThemeConfig>(StorageKey.THEME, {
    fallback: appConfig.theme
  })
} as const

type Value<T extends StorageKey> =
  (typeof storage)[T] extends WxtStorageItem<infer V, Record<string, unknown>> ? V : never

export const getStorage = <K extends StorageKey>(key: K) => {
  return storage[key]
}

export const useStorage = <K extends StorageKey>(key: K) => {
  const item = storage[key] as WxtStorageItem<Value<K>, Record<string, unknown>>
  const [value, setValue] = useState<Value<K> | null>(null)

  useEffect(() => {
    let disposed = false
    let changed = false
    const unwatch = item.watch(value => {
      changed = true
      setValue(value)
    })

    void item
      .getValue()
      .then(value => {
        // A change event may arrive before the initial async read completes.
        // Never replace the newer preference with that stale snapshot.
        if (!disposed && !changed) setValue(value)
      })
      .catch(error => {
        if (!disposed) logger.error('Failed to read extension storage:', error)
      })

    return () => {
      disposed = true
      unwatch()
    }
  }, [item])

  const remove = () => {
    void item.removeValue()
  }

  const set = (value: Value<K>) => {
    void item.setValue(value)
  }

  return { data: value ?? item.fallback, remove, set }
}
