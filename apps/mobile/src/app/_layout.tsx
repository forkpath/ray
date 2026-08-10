import { useEffect } from 'react'

import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, useFonts } from '@expo-google-fonts/geist'
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono'
import * as Sentry from '@sentry/react-native'
import { router, Stack, useNavigationContainerRef } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { View } from 'react-native'

import { useTranslation } from '@libs/i18n'
import { Button, Text } from '@libs/ui-native'

import '~/assets/styles/globals.css'

import type { ErrorBoundaryProps } from 'expo-router'

import { pathsConfig } from '~/config/paths'
import { authClient } from '~/lib/auth'
import { navigationIntegration } from '~/lib/monitoring/sentry'
import { Providers } from '~/lib/providers/providers'
import { useTheme } from '~/modules/common/hooks/use-theme'
import { Updates } from '~/modules/common/updates'

void SplashScreen.preventAutoHideAsync()

SplashScreen.setOptions({
  duration: 500,
  fade: true
})

const RootNavigator = ({ navigationRef }: { navigationRef: ReturnType<typeof useNavigationContainerRef> }) => {
  return (
    <Providers>
      <Updates />
      <Stack
        ref={navigationRef}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 200
        }}
      />
    </Providers>
  )
}

const useSetupAuth = () => {
  const session = authClient.useSession()
  const activeOrganization = authClient.useActiveOrganization()
  const activeMember = authClient.useActiveMember()

  if (session.isPending) {
    return false
  }

  if (!session.data) {
    return true
  }

  return !activeOrganization.isPending && !activeMember.isPending
}

const RootLayout = () => {
  const navigationRef = useNavigationContainerRef()

  useEffect(() => {
    if (navigationRef) {
      navigationIntegration.registerNavigationContainer(navigationRef)
    }
  }, [navigationRef])

  useTheme()
  const [fontsLoaded] = useFonts({
    GeistMono_400Regular,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold
  })

  const authLoaded = useSetupAuth()

  const loaded = fontsLoaded && authLoaded

  if (loaded) {
    SplashScreen.hide()
  }

  return <RootNavigator navigationRef={navigationRef} />
}

export default Sentry.wrap(RootLayout)

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation('common')

  return (
    <View className="bg-background flex-1 items-center justify-center gap-8 px-6">
      <View className="flex flex-col items-center justify-center gap-4">
        <Text className="font-sans-bold text-center text-4xl">{t('error.general')}</Text>
        <Text className="text-muted-foreground text-center">{error.message || t('error.apologies')}</Text>
      </View>

      <View className="flex-row items-center justify-center gap-4">
        <Button onPress={retry}>
          <Text>{t('tryAgain')}</Text>
        </Button>

        <Button onPress={() => router.replace(pathsConfig.index)} variant="outline">
          <Text>{t('goBackHome')}</Text>
        </Button>
      </View>
    </View>
  )
}
