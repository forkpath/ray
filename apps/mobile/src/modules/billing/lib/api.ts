import { useQuery } from '@tanstack/react-query'

import { api } from '~/lib/api'
import { authClient } from '~/lib/auth'

import { billingMutations, billingQueries } from '@libs/billing-client'

const queries = {
  summary: {
    get: (userId: string | null) => billingQueries.summary(api, { kind: 'user', userId })
  }
} as const

const mutations = {
  portal: billingMutations.portal.options(api),
  checkout: billingMutations.checkout.options(api)
} as const

export const billing = {
  queries,
  mutations
}

export const useBillingSummary = () => {
  const session = authClient.useSession()
  const userId = session.data?.user.id ?? null

  return useQuery({
    ...queries.summary.get(userId),
    enabled: Boolean(userId)
  })
}
