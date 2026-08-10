import { pathsConfig } from '~/config/paths'
import { Link } from '~/modules/common/styled'
import { useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'

import { useTranslation } from '@libs/i18n'
import { Icons, Text } from '@libs/ui-native'

const AuthError = () => {
  const { error } = useLocalSearchParams<{ error?: string }>()
  const { t } = useTranslation(['auth', 'common'])

  return (
    <View className="bg-background flex-1 flex-col items-center justify-center gap-4 px-8">
      <Icons.CircleX className="text-destructive" strokeWidth={1.2} size={80} />
      <Text className="font-sans-semibold text-center text-2xl">{t('error.general')}</Text>

      {error && <Text className="bg-muted rounded-md px-2 py-0.5 font-mono">{error}</Text>}

      <Link href={pathsConfig.setup.auth.login} replace className="text-muted-foreground mt-3 font-sans underline">
        {t('goToLogin')}
      </Link>
    </View>
  )
}

export default AuthError
