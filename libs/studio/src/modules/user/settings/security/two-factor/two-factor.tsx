import { useCallback, useMemo, useState } from 'react'

import { useTranslation } from '@libs/i18n'
import { cn } from '@libs/ui-core'
import { Switch } from '@libs/ui-web'

import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardDescription,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsCardTitle
} from '../../../../../common/components/layout/settings-card'
import { RequirePassword } from '../require-password'
import { BackupCodesTile } from './backup-codes/backup-codes'
import { useBackupCodes } from './backup-codes/use-backup-codes'
import { TotpModal, TotpTile } from './totp/totp'
import { useTotp } from './totp/use-totp'
import { useTwoFactor } from './use-two-factor'

export const TwoFactorAuthentication = () => {
  const { t } = useTranslation(['auth', 'common'])
  const [twoFactorOpen, setTwoFactorOpen] = useState(false)
  const [totpOpen, setTotpOpen] = useState(false)

  const { setUri } = useTotp()
  const { setCodes } = useBackupCodes()
  const { enabled, enable, disable } = useTwoFactor()

  const onEnable = useCallback(
    async (data: { password: string }) => {
      const response = await enable.mutateAsync({ ...data, method: 'totp' })
      if (response.method !== 'totp') throw new Error('Expected a TOTP enrollment response')

      setUri(response.totpURI)
      setCodes(response.backupCodes)
      setTwoFactorOpen(false)
      setTotpOpen(true)
    },
    [enable, setUri, setCodes]
  )

  const onDisable = useCallback(
    async (data: { password: string }) => {
      await disable.mutateAsync(data)
    },
    [disable]
  )

  return (
    <SettingsCard className="h-fit w-full overflow-hidden">
      <SettingsCardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="space-y-1.5">
          <SettingsCardTitle>
            {t('auth:account.twoFactor.title', {
              defaultValue: 'Two-Factor Authentication'
            })}
          </SettingsCardTitle>
          <SettingsCardDescription>
            {t('auth:account.twoFactor.description', {
              defaultValue: 'Add an extra layer of security to your account.'
            })}
          </SettingsCardDescription>
        </div>

        <TwoFactorSwitch
          onSubmit={enabled ? onDisable : onEnable}
          open={twoFactorOpen}
          onOpenChange={setTwoFactorOpen}
        />
        <TotpModal open={totpOpen} onOpenChange={setTotpOpen} />
      </SettingsCardHeader>

      <SettingsCardContent className="space-y-4">
        <TotpTile />
        <BackupCodesTile />
      </SettingsCardContent>

      <SettingsCardFooter>
        <span>
          {t('auth:account.twoFactor.info', {
            defaultValue: '2FA provides additional security for your account.'
          })}
        </span>
      </SettingsCardFooter>
    </SettingsCard>
  )
}

function TwoFactorSwitch({
  open,
  onOpenChange,
  onSubmit
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSubmit: (data: { password: string }) => Promise<void>
}) {
  const { t } = useTranslation(['common', 'auth'])
  const { enabled } = useTwoFactor()

  const key = useMemo(() => (enabled ? 'disable' : 'enable'), [enabled])

  return (
    <RequirePassword
      onConfirm={onSubmit}
      open={open}
      onOpenChange={onOpenChange}
      title={t(`auth:account.twoFactor.${key}.title`, {
        defaultValue: enabled ? 'Disable 2FA' : 'Enable 2FA'
      })}
      description={t(`auth:account.twoFactor.${key}.description`, {
        defaultValue: enabled ? 'Are you sure you want to disable 2FA?' : 'Enter your password to enable 2FA.'
      })}
      cta={t(`common:${key}`, {
        defaultValue: enabled ? 'Disable' : 'Enable'
      })}
      render={
        <Switch
          checked={enabled}
          className={cn({
            'bg-input': !enabled,
            'bg-primary': enabled
          })}
        />
      }
    />
  )
}
