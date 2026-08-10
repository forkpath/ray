import type { User } from '@libs/auth-web'

import { useEffect, useMemo } from 'react'
import { createFileRoute, Outlet, redirect, useLocation } from '@tanstack/react-router'

import { hasAdminPermission } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import { getAdminNavConfig, pathsConfig, SecondaryNavProvider } from '@libs/studio'

const LAST_ADMIN_ROUTE_KEY = 'lastAdminRoute'

export const Route = createFileRoute('/_app/admin')({
  beforeLoad: async ({ context }) => {
    const user = context.user as User
    if (!hasAdminPermission(user)) {
      throw redirect({ to: pathsConfig.user.profile })
    }
  },
  component: AdminRoute
})

function AdminRoute() {
  const { t } = useTranslation('common')
  const location = useLocation()

  useEffect(() => {
    if (location.pathname !== '/admin' && location.pathname !== '/admin/') {
      localStorage.setItem(LAST_ADMIN_ROUTE_KEY, location.pathname)
    }
  }, [location.pathname])

  const navConfig = useMemo(() => getAdminNavConfig(t as Parameters<typeof getAdminNavConfig>[0]), [t])

  return (
    <SecondaryNavProvider config={navConfig}>
      <Outlet />
    </SecondaryNavProvider>
  )
}
