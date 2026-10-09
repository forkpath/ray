import { useEffect } from 'react'

import { AnalyticsProvider as AnalyticsProviderEnum, createExtensionAnalyticsStrategy } from '@libs/analytics'

import { authClient } from '~/lib/auth'

const strategy = createExtensionAnalyticsStrategy(AnalyticsProviderEnum.POSTHOG)

export const AnalyticsProvider = ({ children }: { children: React.ReactNode }) => {
  const session = authClient.useSession()

  useEffect(() => {
    if (session.isPending) return

    if (session.data?.user) {
      const { id, email, name } = session.data.user
      strategy.identify(id, { email: email ?? '', name: name ?? '' })
    } else {
      strategy.reset()
    }
  }, [session])

  return <>{children}</>
}
