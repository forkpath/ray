import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { toast } from 'sonner'

import { SocialProvider } from '@libs/auth-contract'
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
} from '@libs/ui-shared/web'

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
import { SocialIcons } from '../../../auth/form/social-providers'
import { auth } from '../../../auth/lib/api'

const OAUTH_PROVIDERS = [SocialProvider.GOOGLE, SocialProvider.GITHUB] as const

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const Accounts = () => {
  const { t, i18n } = useTranslation(['auth', 'common'])
  const session = authClient.useSession()
  const sessionData = session as unknown as {
    data?: { user?: { id: string } }
  }

  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    ...auth.queries.accounts.getAll,
    enabled: !!sessionData.data?.user?.id
  })

  const accounts = (data as unknown as { providerId: string; accountId: string; updatedAt: string }[]) ?? []
  const socials = accounts.filter(a => (OAUTH_PROVIDERS as readonly string[]).includes(a.providerId))
  const missing = OAUTH_PROVIDERS.filter(p => !socials.some(s => s.providerId === p))

  const connect = useMutation({
    ...auth.mutations.accounts.connect,
    onSuccess: async () => {
      await queryClient.invalidateQueries(auth.queries.accounts.getAll)
      toast.success(
        t('auth:account.accounts.connect.success', {
          defaultValue: 'Account connected'
        })
      )
    }
  })

  const disconnect = useMutation({
    ...auth.mutations.accounts.disconnect,
    onSuccess: async () => {
      await queryClient.invalidateQueries(auth.queries.accounts.getAll)
      toast.success(
        t('auth:account.accounts.disconnect.success', {
          defaultValue: 'Account disconnected'
        })
      )
    }
  })

  return (
    <SettingsCard>
      <SettingsCardHeader>
        <SettingsCardTitle>
          {t('auth:account.accounts.title', {
            defaultValue: 'Connected Accounts'
          })}
        </SettingsCardTitle>
        <SettingsCardDescription>
          {t('auth:account.accounts.description', {
            defaultValue: 'Manage your connected social accounts.'
          })}
        </SettingsCardDescription>
      </SettingsCardHeader>

      <SettingsCardContent className="space-y-4">
        {isLoading && <Skeleton className="h-24" />}

        {socials.length > 0 && !isLoading && (
          <ul className="overflow-hidden rounded-md border">
            {socials.map(social => {
              const provider = social.providerId as SocialProvider
              const Icon = SocialIcons[provider]

              return (
                <li key={social.accountId} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
                  {Icon ? <Icon className="size-8" /> : null}

                  <div className="mr-auto flex flex-col">
                    <span className="text-sm font-medium capitalize">{provider}</span>
                    <span className="text-muted-foreground text-xs">
                      {t('auth:account.accounts.connectedAt', {
                        defaultValue: 'Connected',
                        date: new Date(social.updatedAt).toLocaleDateString(i18n.language)
                      })}
                    </span>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={accounts.length === 1 || disconnect.isPending}>
                        <Icons.Trash className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t('auth:account.accounts.disconnect.cta', {
                            defaultValue: `Disconnect ${capitalize(provider)}`,
                            provider: capitalize(provider)
                          })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('auth:account.accounts.disconnect.disclaimer', {
                            defaultValue: `Are you sure you want to disconnect ${capitalize(provider)}?`,
                            provider: capitalize(provider)
                          })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => disconnect.mutate({ providerId: provider })}>
                          {t('common:continue', {
                            defaultValue: 'Continue'
                          })}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              )
            })}
          </ul>
        )}

        {missing.length > 0 && !isLoading && (
          <div className="flex flex-col items-start gap-3 rounded-md border border-dashed px-4 py-3">
            <div className="flex items-center justify-center gap-1">
              <Icons.Plus className="size-4" />
              <span className="text-sm font-medium">{t('common:addNew', { defaultValue: 'Add new' })}</span>
            </div>
            <hr className="bg-border w-full" />
            <div className="flex flex-wrap gap-2">
              {missing.map(provider => {
                const Icon = SocialIcons[provider]
                return (
                  <Button
                    variant="outline"
                    className="gap-2 px-3 capitalize"
                    key={provider}
                    disabled={connect.isPending}
                    onClick={() =>
                      connect.mutate({
                        provider,
                        callbackURL: pathsConfig.user.security,
                        errorCallbackURL: pathsConfig.auth.error
                      })
                    }
                  >
                    {Icon ? <Icon className="size-6" /> : null}
                    {provider}
                  </Button>
                )
              })}
            </div>
          </div>
        )}
      </SettingsCardContent>

      <SettingsCardFooter>
        <span>
          {t('auth:account.accounts.info', {
            defaultValue: 'Connected accounts can be used for signing in.'
          })}
        </span>
      </SettingsCardFooter>
    </SettingsCard>
  )
}
