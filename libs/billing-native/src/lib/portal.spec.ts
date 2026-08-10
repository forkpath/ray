import { describe, expect, it } from 'vitest'

import { MobileStore } from '@libs/billing-contract'

import { resolveBillingPortalUrl } from './portal'

describe('resolveBillingPortalUrl', () => {
  it('uses the native subscription manager for the iOS App Store', () => {
    expect(resolveBillingPortalUrl({ store: MobileStore.APP_STORE, platform: 'ios' })).toBeNull()
  })

  it('uses the web subscription page for App Store records on other platforms', () => {
    expect(resolveBillingPortalUrl({ store: MobileStore.APP_STORE, platform: 'android' })).toBe(
      'https://apps.apple.com/account/subscriptions'
    )
  })

  it('adds the product identifier to the Play Store portal', () => {
    expect(
      resolveBillingPortalUrl({
        store: MobileStore.PLAY_STORE,
        variantId: 'premium-monthly',
        platform: 'android'
      })
    ).toBe('https://play.google.com/store/account/subscriptions?sku=premium-monthly')
  })

  it('keeps the Play Store portal valid without a product identifier', () => {
    expect(resolveBillingPortalUrl({ store: MobileStore.PLAY_STORE, platform: 'android' })).toBe(
      'https://play.google.com/store/account/subscriptions'
    )
  })

  it('rejects unknown stores', () => {
    expect(() => resolveBillingPortalUrl({ store: 'unknown', platform: 'ios' })).toThrow('Invalid store: unknown')
  })
})
