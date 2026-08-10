import type { ColorVariable, ThemeConfig } from '@libs/ui-core'

import { useCallback, useEffect, useMemo } from 'react'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { appConfig } from '~/config/app'
import { useColorScheme } from 'react-native'
import { Uniwind } from 'uniwind'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { logger } from '@libs/common'
import { captureException } from '@libs/monitoring/mobile'
import { ThemeMode, themes } from '@libs/ui-core'

const useThemeConfig = create<{
  config: ThemeConfig
  setConfig: (config: ThemeConfig) => void
}>()(
  persist(
    set => ({
      config: appConfig.theme,
      setConfig: config => set({ config })
    }),
    {
      name: 'theme-config',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
)

export const useTheme = () => {
  const colorScheme = useColorScheme()
  const { config, setConfig } = useThemeConfig()

  const isDark = useMemo(
    () => config.mode === ThemeMode.DARK || (config.mode === ThemeMode.SYSTEM && colorScheme === ThemeMode.DARK),
    [config.mode, colorScheme]
  )

  const resolvedTheme = useMemo(() => (isDark ? ThemeMode.DARK : ThemeMode.LIGHT), [isDark])

  const updateTheme = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!config) {
      return
    }

    try {
      Uniwind.setTheme(config.mode)

      const colors = themes[config.color][resolvedTheme]
      Uniwind.updateCSSVariables(
        resolvedTheme,
        Object.entries(colors).reduce(
          (acc, [key, value]: [string, ColorVariable]) => {
            const [l, c, h, a] = value
            acc[`--${key}`] = a !== undefined ? `oklch(${l} ${c} ${h} / ${a * 100}%)` : `oklch(${l} ${c} ${h})`
            return acc
          },
          {} as Record<string, string>
        )
      )
    } catch (error) {
      logger.error(error)
      captureException(error)
    }
  }, [resolvedTheme, config])

  useEffect(() => {
    updateTheme()
  }, [updateTheme])

  return {
    config,
    setConfig,
    resolvedTheme
  }
}
