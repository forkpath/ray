import { useEffect } from 'react'

import { authClient } from '~/lib/auth'
import { useI18nConfig } from '~/lib/providers/i18n'

import { Provider, useCustomer } from '@libs/billing-native'

const Identity = () => {
  const { identify, reset } = useCustomer()
  const session = authClient.useSession()

  useEffect(() => {
    if (session.isPending) {
      return
    }

    if (session.data?.user) {
      identify(session.data.user.id)
    } else {
      reset()
    }
  }, [session, identify, reset])

  return null
}

export const BillingProvider = ({ children }: { children: React.ReactNode }) => {
  const { locale } = useI18nConfig(state => state.config)

  return (
    <Provider locale={locale}>
      {children}
      <Identity />
    </Provider>
  )
}
