import { useMutation } from '@tanstack/react-query'

import { useTranslation } from '@libs/i18n'
import { cn } from '@libs/ui-core'
import { Icons } from '@libs/ui-web'

import { authClient } from '~/lib/auth'

export const Logout = ({ className, ...props }: React.ComponentProps<'button'>) => {
  const { t } = useTranslation('auth')

  const signOut = useMutation({
    mutationKey: ['auth', 'signOut'],
    mutationFn: () => authClient.signOut()
  })

  return (
    <button
      className={cn('flex w-full cursor-pointer items-center gap-1.5 text-left', className)}
      onClick={() => signOut.mutate()}
      {...props}
    >
      <Icons.LogOut className="size-4" />
      {t('logout.cta')}
    </button>
  )
}
