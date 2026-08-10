import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { toast } from 'sonner'

import { useTranslation } from '@libs/i18n'
import { Badge, Button, Icons, Skeleton } from '@libs/ui-web'

import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardDescription,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsCardTitle
} from '../../../../common/components/layout/settings-card'
import { pathsConfig } from '../../../../config/paths'
import { authClient } from '../../../../lib/auth/client'
import { auth } from '../../../auth/lib/api'

export const Sessions = () => {
  const { t } = useTranslation(['common', 'auth'])
  const currentSession = authClient.useSession()
  const navigate = useNavigate()

  const sessionData = currentSession as unknown as {
    data?: { user?: { id: string }; session?: { token: string } }
  }

  const signOut = useMutation({
    ...auth.mutations.signOut,
    onSuccess: () => {
      void navigate({ to: pathsConfig.index })
    }
  })

  const {
    data: sessions,
    isLoading,
    refetch
  } = useQuery({
    ...auth.queries.sessions.getAll,
    enabled: !!sessionData.data?.user?.id
  })

  const sessionList =
    (sessions as unknown as {
      id: string
      token: string
      ipAddress: string
      userAgent: string
    }[]) ?? []

  const revoke = useMutation<unknown, Error, string>({
    mutationKey: auth.mutations.sessions.revoke.mutationKey,
    mutationFn: token => authClient.revokeSession({ token }),
    onSuccess: async (_: unknown, token: string) => {
      toast.success(
        t('auth:account.sessions.revoke.success', {
          defaultValue: 'Session revoked'
        })
      )
      await refetch()
      if (token === sessionData.data?.session?.token) {
        await signOut.mutateAsync(undefined)
      }
    }
  })

  return (
    <SettingsCard>
      <SettingsCardHeader>
        <SettingsCardTitle>
          {t('auth:account.sessions.title', {
            defaultValue: 'Active Sessions'
          })}
        </SettingsCardTitle>
        <SettingsCardDescription>
          {t('auth:account.sessions.description', {
            defaultValue: 'Manage your active sessions across devices.'
          })}
        </SettingsCardDescription>
      </SettingsCardHeader>

      <SettingsCardContent>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : sessionList.length > 0 ? (
          <ul className="overflow-hidden rounded-md border">
            {sessionList.map(session => (
              <li key={session.id} className="flex min-w-0 items-center gap-3 border-b px-4 py-3 last:border-b-0">
                <Icons.MonitorSmartphone className="size-6 shrink-0" />

                <div className="mr-auto grid grid-cols-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-sm font-medium capitalize">{session.ipAddress}</span>
                    {session.token === sessionData.data?.session?.token && (
                      <Badge variant="outline" className="mb-0.5">
                        {t('common:current', {
                          defaultValue: 'Current'
                        })}
                      </Badge>
                    )}
                  </div>
                  <span className="text-muted-foreground truncate text-xs">{session.userAgent}</span>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  disabled={revoke.isPending && revoke.variables === session.token}
                  onClick={() => revoke.mutate(session.token)}
                >
                  <span className="sr-only">
                    {t('auth:account.sessions.revoke.cta', {
                      defaultValue: 'Revoke session'
                    })}
                  </span>
                  {revoke.isPending && revoke.variables === session.token ? (
                    <Icons.Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Icons.Trash className="size-4" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center justify-center rounded-md border border-dashed p-6">
            <p className="text-center">
              {t('auth:account.sessions.noSessions', {
                defaultValue: 'No active sessions'
              })}
            </p>
          </div>
        )}
      </SettingsCardContent>

      <SettingsCardFooter>
        <span>
          {t('auth:account.sessions.info', {
            defaultValue: 'Revoking a session will sign out that device.'
          })}
        </span>
      </SettingsCardFooter>
    </SettingsCard>
  )
}
