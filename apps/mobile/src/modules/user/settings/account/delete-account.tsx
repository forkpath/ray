import { useMutation } from '@tanstack/react-query'

import { pathsConfig } from '~/config/paths'
import { authClient } from '~/lib/auth'
import { SettingsTile } from '~/modules/common/settings-tile'
import { Spinner } from '~/modules/common/spinner'
import { user } from '~/modules/user/lib/api'
import { router } from 'expo-router'
import { Alert } from 'react-native'

import { useTranslation } from '@libs/i18n'
import { Icons, Text } from '@libs/ui-native'

export const DeleteAccount = () => {
  const { t } = useTranslation(['common', 'auth'])
  const session = authClient.useSession()
  const isAnonymous = session.data?.user.isAnonymous ?? false
  const deleteUser = useMutation({
    ...user.mutations.delete.user,
    onSuccess: () => {
      Alert.alert(t('account.delete.confirmation.success'), undefined, [
        {
          onPress: () => {
            router.back()
          }
        }
      ])
    }
  })
  const deleteAnonymousAccount = useMutation({
    ...user.mutations.delete.anonymous,
    onSuccess: async () => {
      await session.refetch()
      router.replace(pathsConfig.index)
      Alert.alert(t('account.delete.anonymous.confirmation.success'))
    }
  })

  const disclaimer = isAnonymous ? t('account.delete.anonymous.disclaimer') : t('account.delete.disclaimer')

  const cta = isAnonymous ? t('account.delete.cta') : t('account.delete.confirmation.cta')

  return (
    <>
      <SettingsTile
        destructive
        icon={Icons.Trash2}
        onPress={() => {
          Alert.alert(t('account.delete.title'), disclaimer, [
            {
              text: t('cancel'),
              style: 'cancel'
            },
            {
              text: cta,
              style: 'destructive',
              onPress: () => {
                if (isAnonymous) {
                  deleteAnonymousAccount.mutate(undefined)
                  return
                }

                deleteUser.mutate({
                  callbackURL: pathsConfig.index
                })
              }
            }
          ])
        }}
      >
        <Text>{t('account.delete.title')}</Text>
      </SettingsTile>
      {(deleteUser.isPending || deleteAnonymousAccount.isPending) && <Spinner />}
    </>
  )
}
