import type { AuthProvider, SocialProvider as SocialProviderType } from '@libs/auth-contract'
import type { Icon } from '@libs/ui-web'

import { memo } from 'react'
import { useMutation } from '@tanstack/react-query'

import { useTranslation } from '@libs/i18n'
import { Badge, Button, Icons } from '@libs/ui-web'

import { pathsConfig } from '../../../config/paths'
import { authClient } from '../../../lib/auth/client'
import { auth } from '../lib/api'
import { useAuthFormStore } from './store'

interface SocialProvidersProps {
  readonly providers: SocialProviderType[]
  readonly redirectTo?: string
}

export const SocialIcons: Record<SocialProviderType, Icon> = {
  apple: Icons.Apple,
  github: Icons.Github,
  google: Icons.Google
}

const SocialProvider = ({
  provider,
  isSubmitting,
  onClick,
  actualProvider
}: {
  provider: SocialProviderType
  isSubmitting: boolean
  onClick: () => void
  actualProvider: AuthProvider
}) => {
  const { t } = useTranslation('common')
  const Icon = SocialIcons[provider]

  return (
    <Button
      key={provider}
      variant="outline"
      type="button"
      size="lg"
      className="relative grow basis-28 gap-2"
      disabled={isSubmitting}
      onClick={onClick}
    >
      {isSubmitting && actualProvider === provider ? (
        <Icons.Loader2 className="animate-spin" />
      ) : (
        <>
          <Icon className="size-5 dark:brightness-125" />
          <span className="leading-none capitalize">{provider}</span>
        </>
      )}

      {authClient.isLastUsedLoginMethod(provider) && (
        <Badge className="absolute top-0 -right-4 z-10 -translate-y-1/2 shadow-sm">{t('lastUsed')}</Badge>
      )}
    </Button>
  )
}

export const SocialProviders = memo<SocialProvidersProps>(({ providers, redirectTo = pathsConfig.user.profile }) => {
  const { provider: actualProvider, setProvider, isSubmitting, setIsSubmitting } = useAuthFormStore()

  const signIn = useMutation({
    ...auth.mutations.signIn.social,
    onMutate: ({ provider }) => {
      setProvider(provider as SocialProviderType)
      setIsSubmitting(true)
    },
    onSettled: () => {
      setIsSubmitting(false)
    }
  })

  return (
    <div className="flex flex-wrap gap-2">
      {Object.values(providers).map(provider => (
        <SocialProvider
          key={provider}
          provider={provider}
          isSubmitting={isSubmitting}
          onClick={() =>
            signIn.mutate({
              provider,
              callbackURL: redirectTo,
              errorCallbackURL: pathsConfig.auth.error
            })
          }
          actualProvider={actualProvider}
        />
      ))}
    </div>
  )
})

SocialProviders.displayName = 'SocialProviders'
