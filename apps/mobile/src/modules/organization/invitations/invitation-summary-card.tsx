import type { Invitation } from '@libs/auth-native'

import dayjs from 'dayjs'
import { View } from 'react-native'

import { useTranslation } from '@libs/i18n'
import { Avatar, AvatarFallback, AvatarImage } from '@libs/ui-shared/mobile/components/avatar'
import { Badge } from '@libs/ui-shared/mobile/components/badge'
import { Card } from '@libs/ui-shared/mobile/components/card'
import { Text } from '@libs/ui-shared/mobile/components/text'

interface InvitationSummaryCardProps {
  readonly invitation: Invitation
  readonly organization: {
    slug: string | null
    name: string
    logo: string | null
  }
}

export const InvitationSummaryCard = ({ invitation, organization }: InvitationSummaryCardProps) => {
  const { t } = useTranslation('common')

  return (
    <Card className="flex-row items-center gap-4 p-4">
      <Avatar className="size-10" alt={organization.name}>
        <AvatarImage source={{ uri: organization.logo ?? undefined }} />
        <AvatarFallback>
          <Text className="text-muted-foreground text-xl uppercase">{organization.name.charAt(0)}</Text>
        </AvatarFallback>
      </Avatar>

      <View>
        <Text className="font-sans-medium leading-tight" numberOfLines={1}>
          {organization.name}
        </Text>
        <Text className="text-muted-foreground text-sm">
          {t('expires')} {dayjs(invitation.expiresAt).fromNow()}
        </Text>
      </View>

      <Badge variant="outline" className="ml-auto">
        <Text>{t(invitation.role)}</Text>
      </Badge>
    </Card>
  )
}
