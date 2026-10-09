import type { Icon } from '@libs/ui-native'
import type { RoutePath } from 'expo-router'

import { memo } from 'react'
import { useMutation } from '@tanstack/react-query'

import { GoogleSignin, isCancelledResponse, isSuccessResponse } from '@react-native-google-signin/google-signin'
import * as AppleAuthentication from 'expo-apple-authentication'
import { router } from 'expo-router'
import { View } from 'react-native'

import { SocialProvider as SocialProviderType } from '@libs/auth-contract'
import { Trans, useTranslation } from '@libs/i18n'
import { Badge, Button, Icons, Spin, Text } from '@libs/ui-native'

import { authConfig } from '~/config/auth'
import { pathsConfig } from '~/config/paths'
import { authClient } from '~/lib/auth'
import { mobileEnv } from '~/lib/env'
import { auth } from '~/modules/auth/lib/api'
import { isAndroid, isIOS } from '~/utils/device'

interface SocialProvidersProps {
  readonly providers: SocialProviderType[]
  readonly redirectTo?: RoutePath
}

export const SocialIcons: Record<SocialProviderType, Icon> = {
  [SocialProviderType.GITHUB]: Icons.Github,
  [SocialProviderType.GOOGLE]: Icons.Google,
  [SocialProviderType.APPLE]: Icons.Apple
}

if (authConfig.providers.oAuth.includes(SocialProviderType.GOOGLE) && isAndroid) {
  GoogleSignin.configure({
    webClientId: mobileEnv.auth.googleClientId
  })
}

const SocialProvider = ({
  provider,
  onPress,
  isSubmitting
}: {
  provider: SocialProviderType
  isSubmitting: boolean
  onPress: () => void
}) => {
  const { t } = useTranslation('common')
  const Icon = SocialIcons[provider]

  return (
    <Button
      key={provider}
      variant="outline"
      size="lg"
      className="relative w-full flex-row justify-center gap-2.5"
      onPress={onPress}
      disabled={isSubmitting}
    >
      {isSubmitting ? (
        <Spin>
          <Icons.Loader2 className="text-foreground size-5" />
        </Spin>
      ) : (
        <>
          <View className="size-5">
            <Icon className="text-foreground" />
          </View>
          <Text>
            <Trans
              ns="auth"
              i18nKey="login.social"
              values={{ provider }}
              components={{
                capitalize: <Text className="capitalize" />
              }}
            />
          </Text>
        </>
      )}

      {authClient.isLastUsedLoginMethod(provider) && (
        <Badge className="absolute -top-2 -right-3 shadow-sm">
          <Text>{t('lastUsed')}</Text>
        </Badge>
      )}
    </Button>
  )
}

export const SocialProviders = memo<SocialProvidersProps>(({ providers, redirectTo = pathsConfig.index }) => {
  const signIn = useMutation({
    ...auth.mutations.signIn.social,
    onSuccess: async () => {
      const session = await authClient.getSession({
        fetchOptions: { throw: true }
      })

      if (session?.session) {
        router.navigate(redirectTo)
      }
    }
  })

  const getParams = async (provider: SocialProviderType) => {
    const shared = {
      provider,
      callbackURL: redirectTo,
      errorCallbackURL: pathsConfig.setup.auth.error
    }

    if (provider === SocialProviderType.APPLE && isIOS) {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL
        ]
      })

      return {
        ...shared,
        ...(credential.identityToken ? { idToken: { token: credential.identityToken } } : {})
      }
    }

    if (provider === SocialProviderType.GOOGLE && isAndroid) {
      await GoogleSignin.hasPlayServices()
      const response = await GoogleSignin.signIn()

      if (isCancelledResponse(response)) {
        return null
      }

      const tokens = await GoogleSignin.getTokens()

      return {
        ...shared,
        ...(isSuccessResponse(response)
          ? {
              idToken: {
                token: tokens.idToken,
                accessToken: tokens.accessToken
              }
            }
          : {})
      }
    }

    return shared
  }

  return (
    <View className="flex w-full items-stretch justify-center gap-2">
      {Object.values(providers).map(provider => (
        <SocialProvider
          key={provider}
          provider={provider}
          onPress={async () => {
            const params = await getParams(provider)
            if (params) {
              await signIn.mutateAsync(params)
            }
          }}
          isSubmitting={signIn.isPending && signIn.variables.provider === provider}
        />
      ))}
    </View>
  )
})

SocialProviders.displayName = 'SocialProviders'
