import { useMutation, useQuery } from '@tanstack/react-query'

import { pathsConfig } from '~/config/paths'
import { authClient } from '~/lib/auth'
import { SettingsTile } from '~/modules/common/settings-tile'
import { Spinner } from '~/modules/common/spinner'
import { organization } from '~/modules/organization/lib/api'
import { router } from 'expo-router'
import { Alert } from 'react-native'

import { MemberRole } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import { Icons, Text } from '@libs/ui-native'

export const LeaveOrganization = () => {
  const { t } = useTranslation(['common', 'organization'])
  const activeOrganization = authClient.useActiveOrganization()
  const listOrganizations = authClient.useListOrganizations()
  const activeMember = authClient.useActiveMember()

  const { data: isOnlyOwner } = useQuery({
    ...organization.queries.members.getIsOnlyOwner({
      id: activeOrganization.data?.id ?? ''
    }),
    enabled: activeMember.data?.role === MemberRole.OWNER
  })

  const leaveOrganization = useMutation({
    ...organization.mutations.leave,
    onSuccess: async () => {
      await activeOrganization.refetch()
      await listOrganizations.refetch()
      await activeMember.refetch()
      router.replace(pathsConfig.dashboard.user.index)
    }
  })

  const canLeave = !isOnlyOwner?.isOnlyOwner

  if (!activeOrganization.data || !canLeave) {
    return null
  }

  return (
    <>
      <SettingsTile
        icon={Icons.LogOut}
        destructive
        onPress={() => {
          Alert.alert(t('leave.title'), t('leave.disclaimer'), [
            { text: t('cancel'), style: 'cancel' },
            {
              text: t('leave.cta'),
              style: 'destructive',
              onPress: () => {
                leaveOrganization.mutate({
                  organizationId: activeOrganization.data?.id ?? ''
                })
              }
            }
          ])
        }}
      >
        <Text>{t('leave.title')}</Text>
      </SettingsTile>
      {leaveOrganization.isPending && <Spinner />}
    </>
  )
}
