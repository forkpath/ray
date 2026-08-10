import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { useTranslation } from '@libs/i18n'
import { authClient, GoLink, pathsConfig } from '@libs/studio'
import { Icons } from '@libs/ui-web'

export const Route = createFileRoute('/auth')({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // authClient.getSession() 运行时返回: null | { session, user }
    // TypeScript 类型与运行时不一致，需要类型断言
    const session = (await authClient.getSession()) as unknown as {
      session: unknown
      user: { id: string } | null
    } | null
    if (session?.user) {
      // 已登录用户重定向到 dashboard
      throw redirect({ to: pathsConfig.user.profile })
    }

    // 未登录用户访问 /auth 时重定向到 /auth/login
    if (location.pathname === '/auth') {
      throw redirect({
        to: pathsConfig.auth.login,
        search: { redirectTo: undefined, invitationId: undefined, email: undefined }
      })
    }
  },
  component: AuthLayout
})

function AuthLayout() {
  const { t } = useTranslation('common')

  return (
    <main className="grid h-full w-full flex-1 lg:grid-cols-2">
      <section className="flex h-full flex-col items-center justify-center p-6 lg:p-10">
        <header className="text-navy -mt-1 mb-auto flex self-start justify-self-start">
          <GoLink href={pathsConfig.index} className="flex shrink-0 items-center gap-3" aria-label={t('home')}>
            <Icons.Logo className="text-primary h-8" />
            <Icons.LogoText className="text-foreground h-4" />
          </GoLink>
        </header>
        <div className="mt-16 mb-auto flex w-full max-w-md flex-col gap-6 pb-16">
          <Outlet />
        </div>
      </section>

      <aside className="bg-muted hidden flex-1 lg:block"></aside>
    </main>
  )
}
