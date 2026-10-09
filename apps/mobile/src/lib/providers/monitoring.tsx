import { useEffect } from 'react'

import { identify, initialize } from '@libs/monitoring-native'

import { authClient } from '~/lib/auth'

import '~/lib/monitoring/sentry'

initialize()

export const MonitoringProvider = ({ children }: { children: React.ReactNode }) => {
  const session = authClient.useSession()

  useEffect(() => {
    if (session.isPending) {
      return
    }

    identify(session.data?.user ?? null)
  }, [session])

  return children
}
