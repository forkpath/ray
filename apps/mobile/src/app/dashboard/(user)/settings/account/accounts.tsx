import type { SocialProvider } from '@libs/auth-contract'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Alert, View } from 'react-native'

import { capitalize } from '@libs/common'
import { useTranslation } from '@libs/i18n'
import { Button, Icons, Spin, Text } from '@libs/ui-native'

import { authConfig } from '~/config/auth'
import { pathsConfig } from '~/config/paths'
import { authClient } from '~/lib/auth'
import { SocialIcons } from '~/modules/auth/form/social-providers'
import { auth } from '~/modules/auth/lib/api'

export default function AccountsScreen() {
  const { t, i18n } = useTranslation(['auth', 'common'])

  const { data: session } = authClient.useSession()

  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    ...auth.queries.accounts.getAll,
    enabled: !!session?.user.id
  })

  const accounts = data ?? []
  const socials = accounts.filter(account =>
    (authConfig.providers.oAuth as readonly string[]).includes(account.providerId)
  )
  const missing = authConfig.providers.oAuth.filter(provider => !socials.some(social => social.providerId === provider))

  const connect = useMutation({
    ...auth.mutations.accounts.connect,
    onSuccess: async () => {
      await queryClient.invalidateQueries(auth.queries.accounts.getAll)
    }
  })

  const disconnect = useMutation({
    ...auth.mutations.accounts.disconnect,
    onSuccess: async () => {
      await queryClient.invalidateQueries(auth.queries.accounts.getAll)
    }
  })

  const handleDisconnect = (provider: SocialProvider, accountId: string) => {
    Alert.alert(
      t('account.accounts.disconnect.cta', {
        provider: capitalize(provider)
      }),
      t('account.accounts.disconnect.disclaimer', {
        provider: capitalize(provider)
      }),
      [
        {
          text: t('cancel'),
          style: 'cancel'
        },
        {
          text: t('continue'),
          onPress: () => disconnect.mutate({ accountId })
        }
      ]
    )
  }

  return (
    <View className="bg-background flex-1 gap-6 p-6">
      <Text className="text-muted-foreground font-sans-medium text-base">{t('account.accounts.description')}</Text>

      {isLoading ? (
        <View className="p-6">
          <Spin>
            <Icons.Loader2 className="text-foreground mx-auto size-6" />
          </Spin>
        </View>
      ) : (
        <>
          {socials.length > 0 && (
            <View className="border-border overflow-hidden rounded-lg border">
              {socials.map(social => {
                const provider = social.providerId as SocialProvider
                const Icon = SocialIcons[provider]

                return (
                  <View key={social.id} className="border-border flex-row items-center border-b p-4 last:border-b-0">
                    <Icon className="text-foreground size-8" />
                    <View className="ml-3 flex-1">
                      <Text className="font-sans-medium capitalize">{social.providerId}</Text>
                      <Text className="text-muted-foreground text-xs">
                        {t('account.accounts.connectedAt', {
                          date: social.updatedAt.toLocaleDateString(i18n.language)
                        })}
                      </Text>
                    </View>

                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={accounts.length === 1 || disconnect.isPending}
                      onPress={() => handleDisconnect(provider, social.id)}
                    >
                      {disconnect.isPending && disconnect.variables.accountId === social.id ? (
                        <Spin>
                          <Icons.Loader2 className="text-foreground size-5" />
                        </Spin>
                      ) : (
                        <Icons.Trash className="text-foreground" size={20} />
                      )}
                    </Button>
                  </View>
                )
              })}
            </View>
          )}

          {missing.length > 0 && (
            <View className="border-border gap-3 rounded-lg border border-dashed px-5 py-4">
              <Text className="font-sans-medium text-sm">{t('addNew')}</Text>
              <View className="bg-border h-px" />
              <View className="flex-row flex-wrap gap-2">
                {missing.map(provider => {
                  const Icon = SocialIcons[provider]

                  return (
                    <Button
                      key={provider}
                      variant="outline"
                      disabled={connect.isPending}
                      onPress={() =>
                        connect.mutate({
                          provider,
                          callbackURL: pathsConfig.dashboard.user.settings.account.accounts,
                          errorCallbackURL: pathsConfig.setup.auth.error
                        })
                      }
                      className="h-[44px] flex-row items-center gap-2 px-4"
                    >
                      {connect.isPending && connect.variables.provider === provider ? (
                        <Spin>
                          <Icons.Loader2 className="size-5" />
                        </Spin>
                      ) : (
                        <Icon className="text-foreground size-5" />
                      )}
                      <Text className="capitalize">{provider}</Text>
                    </Button>
                  )
                })}
              </View>
            </View>
          )}
        </>
      )}

      <Text className="text-muted-foreground -mt-3 max-w-80 text-sm">{t('account.accounts.info')}</Text>
    </View>
  )
}
