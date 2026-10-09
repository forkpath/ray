import type { QueryClient } from '@tanstack/react-query'

import { useQueryClient } from '@tanstack/react-query'

import Constants from 'expo-constants'
import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import * as StoreReview from 'expo-store-review'
import { Share, View } from 'react-native'

import { useTranslation } from '@libs/i18n'
import { Icons, Text } from '@libs/ui-native'

import { appConfig } from '~/config/app'
import { pathsConfig } from '~/config/paths'
import { SettingsTile } from '~/modules/common/settings-tile'
import { SafeAreaView, ScrollView } from '~/modules/common/styled'
import { organization } from '~/modules/organization/lib/api'
import { OrganizationInfo } from '~/modules/organization/settings/organization-info'

const sections = (queryClient: QueryClient) =>
  [
    [
      {
        title: 'organization',
        icon: Icons.Building,
        onPress: () => router.navigate(pathsConfig.dashboard.organization.settings.organization.index),
        visible: true
      }
    ],
    [
      {
        title: 'account',
        icon: Icons.UserRound,
        onPress: () => {
          void queryClient.getMutationCache().build(queryClient, organization.mutations.setActive).execute({
            organizationId: null
          })

          router.navigate(pathsConfig.dashboard.user.settings.index)
        },
        visible: true
      }
    ],
    [
      {
        title: 'rate',
        icon: Icons.ThumbsUp,
        onPress: async () => {
          const available = await StoreReview.hasAction()

          if (available) {
            return await StoreReview.requestReview()
          }

          return Share.share({
            title: Constants.expoConfig?.name,
            message: appConfig.url
          })
        },
        visible: true
      },
      {
        title: 'share',
        icon: Icons.Share2,
        onPress: () =>
          Share.share({
            title: Constants.expoConfig?.name,
            message: appConfig.url
          }),
        visible: true
      },
      {
        title: 'privacy',
        icon: Icons.Lock,
        onPress: () => Linking.openURL(`${appConfig.url}/legal/privacy-policy`),
        visible: true
      }
    ]
  ] as const

export default function Settings() {
  const { t } = useTranslation('common')

  const queryClient = useQueryClient()

  return (
    <SafeAreaView className="bg-background flex-1">
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-8 py-6" bounces={false}>
        <OrganizationInfo />

        <View className="gap-6">
          {sections(queryClient).map((section, index) => (
            <View key={index}>
              {section.map(item => (
                <SettingsTile {...item} key={item.title}>
                  <Text>{t(item.title)}</Text>
                </SettingsTile>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
