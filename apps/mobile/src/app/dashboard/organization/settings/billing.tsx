import * as Linking from 'expo-linking'
import { Pressable, View } from 'react-native'

import { useTranslation } from '@libs/i18n'
import { Text } from '@libs/ui-native'

export default function Billing() {
  const { t } = useTranslation(['common', 'marketing'])

  return (
    <View className="bg-background flex flex-1 items-center justify-center px-6">
      <View className="items-center gap-6 text-center">
        <Text className="font-sans-bold mt-4 text-3xl tracking-tight">{t('workInProgress.title')}</Text>
        <Text className="text-muted-foreground text-center text-pretty">
          {t('workInProgress.description', {
            feature: t('organizationBilling')
          })}
        </Text>
        <Pressable onPress={() => Linking.openURL('https://github.com/orgs/turbostarter/projects/1')} className="mt-6">
          <Text className="text-primary underline">{t('seeRoadmap')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
