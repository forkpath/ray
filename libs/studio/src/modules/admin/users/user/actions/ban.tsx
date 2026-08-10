import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { toast } from 'sonner'

import { useTranslation } from '@libs/i18n'
import { Button, Icons } from '@libs/ui-web'

import { admin } from '../../../lib/api'

interface BanActionProps {
  readonly id: string
}

export function BanAction({ id }: BanActionProps) {
  const { t } = useTranslation(['common', 'admin'])
  const queryClient = useQueryClient()
  const { data: user } = useQuery(admin.queries.users.get({ id }))

  const ban = useMutation({
    ...admin.mutations.users.ban,
    onSuccess: async () => {
      await queryClient.invalidateQueries(admin.queries.users.get({ id }))
      toast.success(t('users.user.ban.success', { defaultValue: 'User banned' }))
    }
  })

  const unban = useMutation({
    ...admin.mutations.users.unban,
    onSuccess: async () => {
      await queryClient.invalidateQueries(admin.queries.users.get({ id }))
      toast.success(t('users.user.unban.success', { defaultValue: 'User unbanned' }))
    }
  })

  const isBanned = user?.banned
  const isPending = ban.isPending || unban.isPending

  return (
    <Button
      variant={isBanned ? 'secondary' : 'destructive'}
      size="sm"
      onClick={() => {
        if (isBanned) {
          unban.mutate({ userId: id })
        } else {
          ban.mutate({ userId: id })
        }
      }}
      disabled={isPending}
    >
      {isPending && <Icons.Loader2 className="mr-1 size-3 animate-spin" />}
      <Icons.Ban className="mr-1 size-4" />
      {isBanned ? t('common:unban') : t('common:ban')}
    </Button>
  )
}
