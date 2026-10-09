import { useEffect } from 'react'

import '~/lib/monitoring'

import { identify, initialize, Provider } from '@libs/monitoring-web/extension'

import { authClient } from '~/lib/auth'

initialize()

export const MonitoringProvider = ({ children }: { children: React.ReactNode }) => {
  const session = authClient.useSession()

  useEffect(() => {
    if (session.isPending) return

    const user = session.data?.user
    identify(user ? { id: user.id, email: user.email ?? undefined, name: user.name ?? undefined } : null)
  }, [session])

  return <Provider>{children}</Provider>
}
