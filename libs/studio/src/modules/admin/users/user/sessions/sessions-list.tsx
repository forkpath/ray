import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { toast } from 'sonner'

import { useTranslation } from '@libs/i18n'
import { Button, Icons } from '@libs/ui-web'

import { admin } from '../../../lib/api'

interface SessionsListProps {
  readonly id: string
}

export function SessionsList({ id }: SessionsListProps) {
  const { t, i18n } = useTranslation(['common', 'admin'])
  const queryClient = useQueryClient()
  const { data: sessions, isLoading } = useQuery(admin.queries.users.getSessions({ id }))

  const revokeSession = useMutation({
    ...admin.mutations.users.sessions.revoke,
    onSuccess: async () => {
      await queryClient.invalidateQueries(admin.queries.users.getSessions({ id }))
      toast.success(
        t('admin:users.user.sessions.revoke.success', {
          defaultValue: 'Session revoked'
        })
      )
    }
  })

  const revokeAll = useMutation({
    ...admin.mutations.users.sessions.revokeAll,
    onSuccess: async () => {
      await queryClient.invalidateQueries(admin.queries.users.getSessions({ id }))
      toast.success(
        t('admin:users.user.sessions.revokeAll.success', {
          defaultValue: 'All sessions revoked'
        })
      )
    }
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Icons.Loader2 className="size-4 animate-spin" />
        <span className="text-muted-foreground text-sm">{t('loading')}</span>
      </div>
    )
  }

  const sessionList = sessions?.sessions ?? []

  return (
    <section className="flex w-full flex-col gap-4">
      <header className="flex items-center justify-between">
        <h3 className="text-xl font-semibold tracking-tight">{t('sessions')}</h3>
        {sessionList.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => revokeAll.mutate({ userId: id })}
            disabled={revokeAll.isPending}
          >
            {revokeAll.isPending && <Icons.Loader2 className="mr-1 size-3 animate-spin" />}
            {t('admin:users.user.sessions.revokeAll', {
              defaultValue: 'Revoke all'
            })}
          </Button>
        )}
      </header>

      {sessionList.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('noResults')}.</p>
      ) : (
        <div className="divide-border divide-y rounded-md border">
          {sessionList.map(session => (
            <div key={session.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {session.userAgent ?? t('admin:users.user.sessions.unknown', { defaultValue: 'Unknown device' })}
                </span>
                <span className="text-muted-foreground text-xs">
                  {session.ipAddress ?? '-'} · {new Date(session.createdAt).toLocaleString(i18n.language)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  revokeSession.mutate({
                    sessionToken: session.token
                  })
                }
                disabled={revokeSession.isPending}
              >
                <Icons.X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
