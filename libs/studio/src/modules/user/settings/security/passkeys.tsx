import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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
  Icons,
  Skeleton
} from '@libs/ui-web'

import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardDescription,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsCardTitle
} from '../../../../common/components/layout/settings-card'
import { authClient } from '../../../../lib/auth/client'
import { auth } from '../../../auth/lib/api'

export const Passkeys = () => {
  const { t, i18n } = useTranslation(['auth', 'common'])
  const session = authClient.useSession()
  const sessionData = session as unknown as {
    data?: { user?: { id: string } }
  }

  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    ...auth.queries.passkeys.getAll,
    enabled: !!sessionData.data?.user?.id
  })

  const passkeys =
    (data as unknown as {
      id: string
      deviceType: string
      createdAt: string
    }[]) ?? []

  const add = useMutation({
    ...auth.mutations.passkeys.add,
    onSuccess: async () => {
      await queryClient.invalidateQueries(auth.queries.passkeys.getAll)
      toast.success(
        t('auth:account.passkeys.add.success', {
          defaultValue: 'Passkey added'
        })
      )
    }
  })

  const remove = useMutation({
    ...auth.mutations.passkeys.delete,
    onSuccess: async () => {
      await queryClient.invalidateQueries(auth.queries.passkeys.getAll)
      toast.success(
        t('auth:account.passkeys.remove.success', {
          defaultValue: 'Passkey removed'
        })
      )
    }
  })

  return (
    <SettingsCard>
      <SettingsCardHeader>
        <SettingsCardTitle>
          {t('auth:account.passkeys.title', {
            defaultValue: 'Passkeys'
          })}
        </SettingsCardTitle>
        <SettingsCardDescription>
          {t('auth:account.passkeys.description', {
            defaultValue: 'Manage your passkeys for passwordless login.'
          })}
        </SettingsCardDescription>
      </SettingsCardHeader>

      <SettingsCardContent className="space-y-4">
        {isLoading && <Skeleton className="h-24" />}

        {passkeys.length > 0 && (
          <ul className="overflow-hidden rounded-md border">
            {passkeys.map(passkey => (
              <li key={passkey.id} className="flex min-w-0 items-center gap-3 border-b px-4 py-3 last:border-b-0">
                <Icons.Key className="size-6 shrink-0" />

                <div className="mr-auto grid grid-cols-1">
                  <span className="truncate text-sm font-medium capitalize">{passkey.deviceType}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {t('auth:account.passkeys.addedAt', {
                      defaultValue: 'Added',
                      date: new Date(passkey.createdAt).toLocaleDateString(i18n.language)
                    })}
                  </span>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={remove.isPending} className="shrink-0">
                      <Icons.Trash className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t('auth:account.passkeys.remove.cta', {
                          defaultValue: 'Remove Passkey'
                        })}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('auth:account.passkeys.remove.disclaimer', {
                          defaultValue: 'This passkey will be permanently removed.'
                        })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove.mutate({ id: passkey.id })}>
                        {t('common:continue', {
                          defaultValue: 'Continue'
                        })}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        )}

        {!isLoading && (
          <Button variant="outline" className="w-full gap-2" disabled={add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? (
              <Icons.Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Icons.Plus className="size-4" />
                {t('auth:account.passkeys.add.cta', {
                  defaultValue: 'Add Passkey'
                })}
              </>
            )}
          </Button>
        )}
      </SettingsCardContent>

      <SettingsCardFooter>
        {t('auth:account.passkeys.info', {
          defaultValue: 'Passkeys provide a secure passwordless login.'
        })}
      </SettingsCardFooter>
    </SettingsCard>
  )
}
