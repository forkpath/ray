import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import * as Linking from 'expo-linking'
import { Platform } from 'react-native'
import Purchases from 'react-native-purchases'

import { BillingProvider } from '@libs/billing-contract'

import { resolveBillingPortalUrl } from './portal'

export const useCustomer = () => {
  const customer = useQuery({
    queryKey: [BillingProvider.REVENUECAT, 'customer'],
    queryFn: () => Purchases.getCustomerInfo(),
    gcTime: 0,
    staleTime: 0
  })

  const entitlements = useMemo(() => {
    return Object.values(customer.data?.entitlements.all ?? {}).map(entitlement => ({
      id: entitlement.identifier.toLowerCase(),
      active: entitlement.isActive,
      variantId: entitlement.productIdentifier
    }))
  }, [customer.data])

  const identify = (userId: string) => {
    void Purchases.logIn(userId)
  }

  const reset = () => {
    void (async () => {
      const isAnonymous = await Purchases.isAnonymous()
      if (isAnonymous) return
      await Purchases.logOut()
    })()
  }

  const linkToPortal = async ({ store, variantId }: { store: string; variantId?: string }) => {
    const portalUrl = resolveBillingPortalUrl({ store, variantId, platform: Platform.OS })

    if (!portalUrl) {
      return Purchases.showManageSubscriptions()
    }

    await Linking.openURL(portalUrl)
  }

  return {
    identify,
    reset,
    customer: customer.data,
    entitlements,
    linkToPortal
  } as const
}
