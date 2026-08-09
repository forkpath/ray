import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { useTranslation } from '@libs/i18n'
import { cn } from '@libs/ui-shared/common'
import { Button, Icons } from '@libs/ui-shared/web'

import { authClient } from '../../../lib/auth/client'
import { admin } from '../lib/api'

export function ImpersonatingBanner() {
  const { t } = useTranslation('admin')
  const router = useRouter()
  const queryClient = useQueryClient()
  const session = authClient.useSession()

  const stopImpersonating = useMutation({
    ...admin.mutations.users.stopImpersonating,
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      void router.navigate({ to: '/admin/users' as never })
    }
  })

  const isImpersonating = session.data?.session?.impersonatedBy

  if (!isImpersonating) return null

  return (
    <div
      className={cn(
        'bg-warning text-warning-foreground flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium'
      )}
    >
      <Icons.AlertTriangle className="size-4" />
      <span>
        {t('users.impersonating.banner', {
          defaultValue: 'You are currently impersonating a user'
        })}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="ml-2 h-7 text-xs"
        onClick={() => void stopImpersonating.mutate()}
        disabled={stopImpersonating.isPending}
      >
        {stopImpersonating.isPending ? <Icons.Loader2 className="mr-1 size-3 animate-spin" /> : null}
        {t('users.impersonating.stop', { defaultValue: 'Stop impersonating' })}
      </Button>
    </div>
  )
}
