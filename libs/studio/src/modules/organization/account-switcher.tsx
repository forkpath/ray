'use client'

import type { User } from '@libs/auth-web'

import { memo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useApiClient } from '@libs/api-client'
import { billingQueries } from '@libs/billing-client'
import { getActivePlan } from '@libs/billing-config'
import { useTranslation } from '@libs/i18n'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Icons,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Skeleton,
  useSidebar
} from '@libs/ui-shared/web'

import { pathsConfig } from '../../config/paths'
import { authClient } from '../../lib/auth/client'
import { CreateOrganizationModal } from './create-organization'

interface AccountSwitcherProps {
  readonly user: User
}

export const AccountSwitcher = memo<AccountSwitcherProps>(({ user }) => {
  const { t } = useTranslation(['common', 'billing', 'organization', 'workspace'])
  const { isMobile, state } = useSidebar()
  const isCollapsed = state === 'collapsed' && !isMobile

  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const api = useApiClient()
  const summary = useQuery(billingQueries.summary(api, { kind: 'user', userId: user.id }))
  const activePlan = getActivePlan(summary.data)

  const { data: organizations } = authClient.useListOrganizations()
  const { data: activeOrganization } = authClient.useActiveOrganization()

  const planLabel = t(`billing:plan.${activePlan}.name`, { defaultValue: activePlan })

  const switchTo = async (organizationId: string | null) => {
    setOpen(false)
    await authClient.organization.setActive({ organizationId })
    window.location.href = organizationId ? pathsConfig.crm.index : pathsConfig.user.profile
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover open={open} onOpenChange={setOpen} modal>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground gap-3 group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-1!"
              tooltip={activeOrganization?.name ?? t('workspace:personal')}
            >
              <Avatar className="size-8 shrink-0">
                {activeOrganization ? (
                  <>
                    <AvatarImage src={activeOrganization.logo ?? undefined} alt={activeOrganization.name} />
                    <AvatarFallback>
                      <span className="text-muted-foreground text-sm uppercase">
                        {activeOrganization.name.charAt(0)}
                      </span>
                    </AvatarFallback>
                  </>
                ) : (
                  <>
                    <AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
                    <AvatarFallback>
                      <Icons.UserRound className="size-5" />
                    </AvatarFallback>
                  </>
                )}
              </Avatar>

              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">
                  {activeOrganization ? activeOrganization.name : t('workspace:personal')}
                </span>
                {summary.isPending ? (
                  <Skeleton className="mt-1 h-3 w-20" />
                ) : (
                  <span className="text-muted-foreground truncate text-xs capitalize">{planLabel}</span>
                )}
              </div>

              <Icons.ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </PopoverTrigger>

          <PopoverContent
            className="w-64 rounded-lg p-0"
            align="start"
            side={isMobile || !isCollapsed ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <Command defaultValue={activeOrganization?.slug ?? 'personal-account'}>
              <CommandInput placeholder={t('common:search')} autoFocus />
              <CommandList>
                <CommandGroup>
                  <CommandItem
                    value="personal-account"
                    className="p-2"
                    onSelect={() => {
                      void switchTo(null)
                    }}
                  >
                    <Avatar className="size-6">
                      <AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
                      <AvatarFallback>
                        <Icons.UserRound className="size-3.5" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{t('workspace:personal')}</span>
                    {!activeOrganization && <Icons.Check className="ml-auto size-4" />}
                  </CommandItem>
                </CommandGroup>

                {organizations && organizations.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading={`${t('common:organizations')} (${organizations.length})`}>
                      {organizations.map(organization => (
                        <CommandItem
                          key={organization.id}
                          value={organization.slug}
                          className="p-2"
                          onSelect={() => {
                            void switchTo(organization.id)
                          }}
                        >
                          <Avatar className="size-6">
                            <AvatarImage src={organization.logo ?? undefined} alt={organization.name} />
                            <AvatarFallback>
                              <span className="text-muted-foreground text-sm uppercase">
                                {organization.name.charAt(0)}
                              </span>
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{organization.name}</span>
                          {activeOrganization?.id === organization.id && <Icons.Check className="ml-auto size-4" />}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}

                <CommandSeparator />
                <CommandGroup forceMount>
                  <CommandItem
                    className="p-2"
                    onSelect={() => {
                      setOpen(false)
                      setCreateOpen(true)
                    }}
                  >
                    <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                      <Icons.Plus className="size-4" />
                    </div>
                    <span className="truncate">{t('organization:create.cta')}</span>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <CreateOrganizationModal open={createOpen} onOpenChange={setCreateOpen} />
      </SidebarMenuItem>
    </SidebarMenu>
  )
})

AccountSwitcher.displayName = 'AccountSwitcher'
