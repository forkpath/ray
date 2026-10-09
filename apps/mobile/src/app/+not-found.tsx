import { router } from 'expo-router'
import { View } from 'react-native'

import { useTranslation } from '@libs/i18n'
import { Button, Text } from '@libs/ui-native'

import { pathsConfig } from '~/config/paths'

export default function NotFound() {
  const { t } = useTranslation('common')

  return (
    <View className="bg-background flex flex-1 items-center justify-center gap-8 px-6">
      <View className="items-center justify-center gap-4">
        <Text className="font-sans-bold text-center text-4xl">{t('error.notFound')}</Text>
        <Text className="text-muted-foreground max-w-md text-center">{t('error.resourceDoesNotExist')}</Text>
      </View>

      <Button onPress={() => router.replace(pathsConfig.index)} variant="outline">
        <Text>{t('goBackHome')}</Text>
      </Button>
    </View>
  )
}
