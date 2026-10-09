import type { ReactNode } from 'react'

import { useEffect } from 'react'

import '~/renderer/lib/monitoring/sentry'

import { identify, initialize, Provider } from '@libs/monitoring-web/desktop'
import { authClient } from '@libs/studio'

export function MonitoringProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession()

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    if (session.isPending) {
      return
    }

    if (session.data?.user) {
      const { id, email, name } = session.data.user
      identify({ id, email, name })
      return
    }

    identify(null)
  }, [session])

  return <Provider>{children}</Provider>
}
