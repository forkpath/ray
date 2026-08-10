import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { AuthProvider } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import { Button, Icons } from '@libs/ui-shared/web'

import { pathsConfig } from '../../../config/paths'
import { auth } from '../lib/api'
import { useAuthFormStore } from './store'

interface AnonymousLoginProps {
  readonly redirectTo?: string
}

export const AnonymousLogin = ({ redirectTo = pathsConfig.user.profile }: AnonymousLoginProps) => {
  const navigate = useNavigate()
  const { t } = useTranslation('auth')
  const { provider, setProvider, isSubmitting, setIsSubmitting } = useAuthFormStore()

  const signIn = useMutation({
    ...auth.mutations.signIn.anonymous,
    onMutate: () => {
      setProvider(AuthProvider.ANONYMOUS)
      setIsSubmitting(true)
    },
    onSettled: () => {
      setIsSubmitting(false)
    },
    onSuccess: () => {
      navigate({ to: redirectTo })
    }
  })

  return (
    <Button
      variant="outline"
      className="gap-2"
      size="lg"
      type="button"
      disabled={isSubmitting}
      onClick={() => signIn.mutate(undefined)}
    >
      {isSubmitting && provider === AuthProvider.ANONYMOUS ? (
        <Icons.Loader2 className="animate-spin" />
      ) : (
        <>
          <Icons.UserRound className="size-4" />
          {t('login.anonymous.cta')}
        </>
      )}
    </Button>
  )
}
