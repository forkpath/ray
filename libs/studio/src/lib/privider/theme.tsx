import type { ThemeColor, ThemeMode } from '@libs/ui-core'

import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { ThemeProvider as NextThemeProvider, useTheme as useNextTheme } from 'next-themes'

import { appConfig } from '../../config/app'

// ============================================================================
// Types
// ============================================================================

interface ThemeContextValue {
  /** 当前主题模式 (light/dark/system) */
  mode: ThemeMode
  /** 当前主题颜色 */
  color: ThemeColor
  /** 实际应用的模式 (light/dark)，system 会被解析为实际值 */
  resolvedMode: 'light' | 'dark'
  /** 设置主题模式 */
  setMode: (mode: ThemeMode) => void
  /** 设置主题颜色 */
  setColor: (color: ThemeColor) => void
  /** 切换 light/dark 模式 */
  toggleMode: () => void
}

interface ThemeProviderProps {
  readonly children: React.ReactNode
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_COLOR = 'theme-color'

// ============================================================================
// Context
// ============================================================================

const ThemeColorContext = createContext<{
  color: ThemeColor
  setColor: (color: ThemeColor) => void
} | null>(null)

// ============================================================================
// Color Provider (内部组件，处理 body data-theme)
// ============================================================================

function ThemeColorProvider({ children }: { children: React.ReactNode }) {
  const [color, setColorState] = useState<ThemeColor>(appConfig.theme.color)
  const [mounted, setMounted] = useState(false)

  // 客户端挂载后从 localStorage 读取
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_COLOR) as ThemeColor | null
    if (stored) {
      setColorState(stored)
    }
    setMounted(true)
  }, [])

  // 设置 body data-theme
  useEffect(() => {
    if (!mounted) return
    document.body.dataset.theme = color
  }, [color, mounted])

  const setColor = useCallback((newColor: ThemeColor) => {
    setColorState(newColor)
    localStorage.setItem(STORAGE_KEY_COLOR, newColor)
  }, [])

  const value = useMemo(() => ({ color, setColor }), [color, setColor])

  return <ThemeColorContext.Provider value={value}>{children}</ThemeColorContext.Provider>
}

// ============================================================================
// Provider
// ============================================================================

export const ThemeProvider = memo<ThemeProviderProps>(({ children }) => {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme={appConfig.theme.mode}
      storageKey="theme-mode"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeColorProvider>{children}</ThemeColorProvider>
    </NextThemeProvider>
  )
})

ThemeProvider.displayName = 'ThemeProvider'

// ============================================================================
// Hook
// ============================================================================

/**
 * 获取当前主题状态和控制方法
 *
 * @example
 * ```tsx
 * const { mode, color, resolvedMode, setMode, setColor, toggleMode } = useTheme()
 *
 * // 切换 dark/light
 * <Button onClick={toggleMode}>{resolvedMode === 'dark' ? '🌙' : '☀️'}</Button>
 *
 * // 设置模式
 * <Select value={mode} onChange={setMode}>
 *   <option value="light">Light</option>
 *   <option value="dark">Dark</option>
 *   <option value="system">System</option>
 * </Select>
 *
 * // 设置颜色
 * <Select value={color} onChange={setColor}>
 *   <option value="orange">Orange</option>
 *   <option value="blue">Blue</option>
 * </Select>
 * ```
 */
export function useTheme(): ThemeContextValue {
  const { theme, setTheme, resolvedTheme } = useNextTheme()

  const colorContext = useContext(ThemeColorContext)

  if (!colorContext) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  const { color, setColor } = colorContext

  const mode = (theme ?? 'system') as ThemeMode
  const resolvedMode = (resolvedTheme ?? 'light') as 'light' | 'dark'

  const setMode = useCallback(
    (newMode: ThemeMode) => {
      setTheme(newMode)
    },
    [setTheme]
  )

  const toggleMode = useCallback(() => {
    setTheme(resolvedMode === 'dark' ? 'light' : 'dark')
  }, [resolvedMode, setTheme])

  return useMemo(
    () => ({
      mode,
      color,
      resolvedMode,
      setMode,
      setColor,
      toggleMode
    }),
    [mode, color, resolvedMode, setMode, setColor, toggleMode]
  )
}
