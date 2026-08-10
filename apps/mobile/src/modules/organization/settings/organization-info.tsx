import { useMutation } from '@tanstack/react-query'

import { authClient } from '~/lib/auth'
import {
  AvatarForm,
  AvatarFormPreview,
  AvatarFormRemoveButton,
  AvatarFormUploadButton
} from '~/modules/common/avatar-form'
import { organization } from '~/modules/organization/lib/api'
import { View } from 'react-native'

import { toMemberRole } from '@libs/auth-contract'
import { isKey, useTranslation } from '@libs/i18n'
import { Badge } from '@libs/ui-shared/mobile/components/badge'
import { Skeleton } from '@libs/ui-shared/mobile/components/skeleton'
import { Text } from '@libs/ui-shared/mobile/components/text'

const OrganizationInfoSkeleton = () => {
  return (
    <View className="items-center">
      <Skeleton className="mb-4 size-28 rounded-full" />
      <Skeleton className="mb-3 h-5 w-40" />
      <Skeleton className="h-5 w-20" />
    </View>
  )
}

export const OrganizationInfo = () => {
  const { t, i18n } = useTranslation('common')

  const activeOrganization = authClient.useActiveOrganization()
  const activeMember = authClient.useActiveMember()

  const updateOrganization = useMutation(organization.mutations.update)

  if (activeOrganization.isPending || !activeOrganization.data || activeMember.isPending || !activeMember.data) {
    return <OrganizationInfoSkeleton />
  }

  const role = activeMember.data.role

  const hasUpdatePermission = authClient.organization.checkRolePermission({
    permissions: {
      organization: ['update']
    },
    role: toMemberRole(role)
  })

  return (
    <View className="items-center gap-4">
      <AvatarForm
        key={activeOrganization.data.id}
        id={activeOrganization.data.id}
        image={activeOrganization.data.logo}
        update={image =>
          updateOrganization.mutateAsync({
            data: {
              logo: image ?? ''
            },
            organizationId: activeOrganization.data?.id ?? ''
          })
        }
      >
        <View className="relative">
          <AvatarFormPreview
            alt={activeOrganization.data.name}
            fallback={
              <Text className="text-muted-foreground text-4xl leading-none">
                {activeOrganization.data.name.charAt(0).toUpperCase()}
              </Text>
            }
          />
          {hasUpdatePermission && <AvatarFormUploadButton onUpload={activeOrganization.refetch} />}
          {hasUpdatePermission && <AvatarFormRemoveButton onRemove={activeOrganization.refetch} />}
        </View>
      </AvatarForm>
      <View className="items-center gap-2.5">
        <Text className="font-sans-semibold text-xl">{activeOrganization.data.name}</Text>

        {role && (
          <Badge variant="outline">
            <Text>{isKey(role, i18n, 'common') ? t(role) : role}</Text>
          </Badge>
        )}
      </View>
    </View>
  )
}
