import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { toast } from 'sonner'

import { useTranslation } from '@libs/i18n'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Icons
} from '@libs/ui-web'

import {
  SettingsCard,
  SettingsCardDescription,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsCardTitle
} from '../../../../common/components/layout/settings-card'
import { pathsConfig } from '../../../../config/paths'
import { authClient } from '../../../../lib/auth/client'
import { user } from '../../lib/api'

export const DeleteAccount = () => {
  const { t } = useTranslation(['common', 'auth'])
  const navigate = useNavigate()
  const session = authClient.useSession()
  const sessionData = session as unknown as {
    data?: { user?: { isAnonymous?: boolean | null } }
  }
  const isAnonymous = sessionData.data?.user?.isAnonymous ?? false

  const deleteAccount = useMutation({
    ...user.mutations.delete.user,
    onSuccess: () => {
      toast.success(t('auth:account.delete.confirmation.success', { defaultValue: 'Account deleted' }))
    }
  })

  const deleteAnonymousAccount = useMutation({
    ...user.mutations.delete.anonymous,
    onSuccess: async () => {
      await (session as unknown as { refetch: () => Promise<void> }).refetch()
      void navigate({ to: pathsConfig.index })
      toast.success(
        t('auth:account.delete.anonymous.confirmation.success', { defaultValue: 'Anonymous account deleted' })
      )
    }
  })

  const handleDelete = () => {
    if (isAnonymous) {
      deleteAnonymousAccount.mutate(undefined)
    } else {
      deleteAccount.mutate({ callbackURL: pathsConfig.index })
    }
  }

  const isPending = deleteAccount.isPending || deleteAnonymousAccount.isPending

  return (
    <SettingsCard variant="destructive">
      <SettingsCardHeader>
        <SettingsCardTitle>{t('auth:account.delete.title', { defaultValue: 'Delete Account' })}</SettingsCardTitle>
        <SettingsCardDescription>
          {t('auth:account.delete.description', {
            defaultValue: 'Permanently delete your account and all associated data.'
          })}
        </SettingsCardDescription>
      </SettingsCardHeader>

      <SettingsCardFooter>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" className="ml-auto" variant="destructive">
              {t('auth:account.delete.cta', { defaultValue: 'Delete Account' })}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('auth:account.delete.title', { defaultValue: 'Delete Account' })}</AlertDialogTitle>
              <AlertDialogDescription className="whitespace-pre-line">
                {isAnonymous
                  ? t('auth:account.delete.anonymous.disclaimer', {
                      defaultValue: 'This will permanently delete your anonymous account.'
                    })
                  : t('auth:account.delete.disclaimer', {
                      defaultValue: 'This action cannot be undone. All your data will be permanently deleted.'
                    })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isPending}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {isPending ? (
                  <Icons.Loader2 className="size-4 animate-spin" />
                ) : (
                  t('auth:account.delete.cta', { defaultValue: 'Delete Account' })
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SettingsCardFooter>
    </SettingsCard>
  )
}
