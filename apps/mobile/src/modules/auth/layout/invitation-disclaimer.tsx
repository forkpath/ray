'use client'

import { useTranslation } from '@libs/i18n'
import { Alert, AlertDescription, AlertTitle, Icons } from '@libs/ui-native'

export const InvitationDisclaimer = () => {
  const { t } = useTranslation('organization')

  return (
    <Alert icon={Icons.MailPlus} variant="primary">
      <AlertTitle>{t('invitations.disclaimer.title')}</AlertTitle>
      <AlertDescription>{t('invitations.disclaimer.description')}</AlertDescription>
    </Alert>
  )
}
