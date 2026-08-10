import type { ActiveOrganization, User } from '@libs/auth-web'

import { memo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { appConfig } from '~/config/app'
import { billingQueries } from '~/modules/billing/lib/api'

import { useApiClient } from '@libs/api-client'
import { hasAdminPermission } from '@libs/auth-contract'
import { getActivePlan } from '@libs/billing-config'
import { useTranslation } from '@libs/i18n'
import { cn } from '@libs/ui-core'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  buttonVariants,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icons,
  Skeleton
} from '@libs/ui-shared/web'

import { Logout } from './logout'

const AnonymousUser = () => {
  const { t } = useTranslation('auth')
  return (
    <a
      href={`${appConfig.url}/auth/login`}
      className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'rounded-full')}
      target="_blank"
    >
      <Icons.LogIn className="size-4" />
      <div className="sr-only">{t('login.cta')}</div>
    </a>
  )
}

const DashboardLink = ({ href }: { href: string }) => {
  const { t } = useTranslation('common')
  return (
    <DropdownMenuItem asChild>
      <a href={href} target="_blank" className="flex w-full cursor-pointer items-center gap-1.5">
        <Icons.Home className="size-4" />
        {t('dashboard')}
      </a>
    </DropdownMenuItem>
  )
}

const SettingsLink = ({ href }: { href: string }) => {
  const { t } = useTranslation('common')
  return (
    <DropdownMenuItem asChild>
      <a href={href} target="_blank" className="flex w-full cursor-pointer items-center gap-1.5">
        <Icons.Settings className="size-4" />
        {t('settings')}
      </a>
    </DropdownMenuItem>
  )
}

interface UserNavigationProps {
  readonly user: User | null
  readonly organization: ActiveOrganization | null
}

export const UserNavigation = memo<UserNavigationProps>(({ user, organization }) => {
  const { t } = useTranslation(['common', 'auth', 'billing'])
  const api = useApiClient()

  const summary = useQuery({
    ...billingQueries.summary(api, { kind: 'user', userId: user?.id ?? null }),
    enabled: !!user
  })
  const activePlan = getActivePlan(summary.data)

  if (!user) {
    return <AnonymousUser />
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative flex items-center gap-4 rounded-md">
          <Avatar className="size-10">
            {organization ? (
              <>
                <AvatarImage src={organization.logo ?? undefined} alt={organization.name} />
                <AvatarFallback>
                  <span className="text-muted-foreground text-sm uppercase">{organization.name.charAt(0)}</span>
                </AvatarFallback>
              </>
            ) : (
              <>
                <AvatarImage src={user.image ?? undefined} alt={user.name} />
                <AvatarFallback>
                  <Icons.UserRound className="w-5" />
                </AvatarFallback>
              </>
            )}
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2 font-normal">
            <Avatar className="size-8">
              {organization ? (
                <>
                  <AvatarImage src={organization.logo ?? undefined} alt={organization.name} />
                  <AvatarFallback>
                    <span className="text-muted-foreground text-sm uppercase">{organization.name.charAt(0)}</span>
                  </AvatarFallback>
                </>
              ) : (
                <>
                  <AvatarImage src={user.image ?? undefined} alt={user.name} />
                  <AvatarFallback>
                    <Icons.UserRound className="w-4" />
                  </AvatarFallback>
                </>
              )}
            </Avatar>

            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{organization ? organization.name : t('account.personal')}</span>
              {summary.isPending ? (
                <Skeleton className="mt-1 h-3 w-20" />
              ) : (
                <span className="text-muted-foreground truncate text-xs capitalize">
                  {t(`plan.${activePlan}.name`)}
                </span>
              )}
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuGroup>
          <DashboardLink
            href={organization ? `${appConfig.url}/dashboard/${organization.slug}` : `${appConfig.url}/dashboard`}
          />
          <SettingsLink
            href={
              organization
                ? `${appConfig.url}/dashboard/${organization.slug}/settings`
                : `${appConfig.url}/dashboard/settings`
            }
          />
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2 font-normal">
            <Avatar className="size-8">
              <AvatarImage src={user.image ?? undefined} alt={user.name} />
              <AvatarFallback>
                <Icons.UserRound className="w-5" />
              </AvatarFallback>
            </Avatar>

            <div className="grid flex-1 text-left text-sm leading-tight">
              {user.name && <span className="truncate font-medium">{user.name}</span>}
              {user.email && <span className="text-muted-foreground truncate text-xs">{user.email}</span>}
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuGroup>
          <DashboardLink href={`${appConfig.url}/dashboard`} />
          <SettingsLink href={`${appConfig.url}/dashboard/settings`} />
        </DropdownMenuGroup>

        <DropdownMenuGroup>
          {hasAdminPermission(user) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a
                  href={`${appConfig.url}/admin`}
                  target="_blank"
                  className="flex w-full cursor-pointer items-center gap-1.5"
                >
                  <Icons.ShieldUser className="size-4" />
                  {t('admin')}
                </a>
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Logout />
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

export const UserNavigationSkeleton = () => {
  return <Skeleton className="size-10 rounded-full" />
}

UserNavigation.displayName = 'UserNavigation'
