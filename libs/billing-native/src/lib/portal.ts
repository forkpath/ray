import { MOBILE_STORE_LINKS, MobileStore } from '@libs/billing-contract'

interface BillingPortalTargetInput {
  store: string
  variantId?: string
  platform: string
}

export const resolveBillingPortalUrl = ({ store, variantId, platform }: BillingPortalTargetInput): string | null => {
  if (!Object.values(MobileStore).includes(store as MobileStore)) {
    throw new Error(`Invalid store: ${store}`)
  }

  if (store === MobileStore.APP_STORE && platform === 'ios') {
    return null
  }

  const target = MOBILE_STORE_LINKS[store as MobileStore]
  const url = new URL(target)

  if (store === MobileStore.PLAY_STORE && variantId) {
    url.searchParams.set('sku', variantId)
  }

  return url.toString()
}
