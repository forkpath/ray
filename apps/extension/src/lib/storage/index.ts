import type { ThemeConfig } from '@libs/ui-shared/common'
import type { WxtStorageItem } from 'wxt/utils/storage'

import { useEffect, useState } from 'react'

import { appConfig } from '~/config/app'
import { storage as browserStorage } from 'wxt/utils/storage'

export interface CachedCategories {
  list: Array<{ id: string; name: string; isDefault: boolean; color: string | null }>
  fetchedAt: number
}

export const StorageKey = {
  THEME: 'local:theme',
  CATEGORIES: 'local:categories'
} as const

export type StorageKey = (typeof StorageKey)[keyof typeof StorageKey]

const storage = {
  [StorageKey.THEME]: browserStorage.defineItem<ThemeConfig>(StorageKey.THEME, {
    fallback: appConfig.theme
  }),
  [StorageKey.CATEGORIES]: browserStorage.defineItem<CachedCategories | null>(StorageKey.CATEGORIES, {
    fallback: null
  })
} as const

type Value<T extends StorageKey> = (typeof storage)[T] extends WxtStorageItem<infer V, infer _> ? V : never

export const getStorage = <K extends StorageKey>(key: K) => {
  return storage[key]
}

export const useStorage = <K extends StorageKey>(key: K) => {
  const item = storage[key] as WxtStorageItem<Value<K>, Record<string, unknown>>
  const [value, setValue] = useState<Value<K> | null>(null)

  useEffect(() => {
    const unwatch = item.watch(value => {
      setValue(value)
    })

    return () => {
      unwatch()
    }
  }, [item])

  useEffect(() => {
    void (async () => {
      const value = await item.getValue()
      setValue(value)
    })()
  }, [item])

  const remove = () => {
    void item.removeValue()
  }

  const set = (value: Value<K>) => {
    void item.setValue(value)
  }

  return { data: value ?? item.fallback, remove, set }
}
