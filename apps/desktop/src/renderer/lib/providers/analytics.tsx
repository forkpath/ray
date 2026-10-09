import type { ReactNode } from 'react'

import { useEffect } from 'react'

import { identify, Provider, reset } from '@libs/analytics-web/desktop'
import { authClient } from '@libs/studio'

import '~/renderer/lib/analytics'

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession()

  useEffect(() => {
    if (session.isPending) return

    if (session.data?.user) {
      const { id, email, name } = session.data.user
      identify(id, { email, name })
      return
    }

    reset()
  }, [session])

  return <Provider>{children}</Provider>
}
