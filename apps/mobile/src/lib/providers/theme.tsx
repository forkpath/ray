import { memo } from 'react'

import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native'
import { useTheme } from '~/modules/common/hooks/use-theme'
import { isAndroid } from '~/utils/device'
import * as NavigationBar from 'expo-navigation-bar'
import { StatusBar, View } from 'react-native'

import { ThemeMode } from '@libs/ui-core'

interface ThemeProviderProps {
  readonly children: React.ReactNode
}

export const ThemeProvider = memo<ThemeProviderProps>(({ children }) => {
  const { resolvedTheme } = useTheme()

  if (isAndroid) {
    void NavigationBar.setButtonStyleAsync(resolvedTheme === ThemeMode.DARK ? ThemeMode.LIGHT : ThemeMode.DARK)
  }

  return (
    <NavigationThemeProvider value={resolvedTheme === ThemeMode.DARK ? DarkTheme : DefaultTheme}>
      <View className="bg-background flex-1">{children}</View>
      <StatusBar
        barStyle={resolvedTheme === ThemeMode.DARK ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
    </NavigationThemeProvider>
  )
})

ThemeProvider.displayName = 'ThemeProvider'
