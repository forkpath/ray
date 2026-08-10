import { useMutation } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { toast } from 'sonner'

import { useTranslation } from '@libs/i18n'
import { Button, Icons } from '@libs/ui-web'

import { admin } from '../../../lib/api'

interface ImpersonateActionProps {
  readonly id: string
}

export function ImpersonateAction({ id }: ImpersonateActionProps) {
  const { t } = useTranslation(['common', 'admin'])
  const router = useRouter()

  const impersonate = useMutation({
    ...admin.mutations.users.impersonate,
    onSuccess: () => {
      toast.success(
        t('users.user.impersonate.success', {
          defaultValue: 'Now impersonating user'
        })
      )
      void router.navigate({ to: '/' })
    }
  })

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => impersonate.mutate({ userId: id })}
      disabled={impersonate.isPending}
    >
      {impersonate.isPending && <Icons.Loader2 className="mr-1 size-3 animate-spin" />}
      <Icons.VenetianMask className="mr-1 size-4" />
      {t('common:impersonate')}
    </Button>
  )
}
