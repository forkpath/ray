import { useTranslation } from '@libs/i18n'
import { Icons } from '@libs/ui-web'

export const InvitationDisclaimer = () => {
  const { t } = useTranslation('organization')

  return (
    <div className="bg-primary/10 border-primary/20 flex items-start gap-3 rounded-lg border p-4">
      <Icons.MailPlus className="text-primary mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <h4 className="text-sm font-medium">{t('invitations.disclaimer.title')}</h4>
        <p className="text-muted-foreground mt-1 text-sm">{t('invitations.disclaimer.description')}</p>
      </div>
    </div>
  )
}
