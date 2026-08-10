import { pathsConfig } from '~/config/paths'
import { authClient } from '~/lib/auth'
import { SettingsTile } from '~/modules/common/settings-tile'
import { DeleteOrganization } from '~/modules/organization/settings/delete-organization'
import { LeaveOrganization } from '~/modules/organization/settings/leave-organization'
import { router } from 'expo-router'
import { View } from 'react-native'

import { toMemberRole } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import { Icons } from '@libs/ui-shared/mobile/components/icons'
import { Text } from '@libs/ui-shared/mobile/components/text'

export default function Organization() {
  const { t } = useTranslation('common')
  const { data: activeMember } = authClient.useActiveMember()

  const hasUpdatePermission = authClient.organization.checkRolePermission({
    permissions: {
      organization: ['update']
    },
    role: toMemberRole(activeMember?.role)
  })

  return (
    <View className="bg-background flex-1 gap-6 py-2">
      {hasUpdatePermission && (
        <SettingsTile
          icon={Icons.IdCard}
          onPress={() => router.navigate(pathsConfig.dashboard.organization.settings.organization.name)}
        >
          <Text>{t('name')}</Text>
        </SettingsTile>
      )}
      <LeaveOrganization />
      <DeleteOrganization />
    </View>
  )
}
