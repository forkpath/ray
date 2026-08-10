import { PaywallResult } from '@libs/billing-contract'

export const normalizePaywallResult = (result: string): PaywallResult => {
  switch (result) {
    case 'PURCHASED':
      return PaywallResult.PURCHASED
    case 'RESTORED':
      return PaywallResult.RESTORED
    case 'CANCELLED':
      return PaywallResult.DISMISSED
    case 'NOT_PRESENTED':
      return PaywallResult.SKIPPED
    case 'ERROR':
    default:
      return PaywallResult.ERROR
  }
}
