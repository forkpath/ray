import type { BillingOwner } from '@libs/billing-contract'

import { serverEnv } from './env'

export interface BillingOwnerFeatureFlags {
  dualWrite: boolean
  shadowRead: boolean
  v2Read: boolean
  organizationBilling: boolean
}

export interface BillingOwnerColumns {
  userId: string | null
  organizationId: string | null
}

export interface BillingOwnerShadowMismatch {
  owner: BillingOwner
  provider?: string
  legacyCustomerIds: string[]
  v2CustomerIds: string[]
}

export type BillingOwnerShadowMismatchReporter = (mismatch: BillingOwnerShadowMismatch) => void

export function getBillingOwnerFeatureFlags(): BillingOwnerFeatureFlags {
  return billingOwnerFeatureFlags
}

export function validateBillingOwnerFeatureFlags(flags: BillingOwnerFeatureFlags): BillingOwnerFeatureFlags {
  if (flags.shadowRead && !flags.dualWrite) {
    throw new Error('BILLING_OWNER_V2_SHADOW_READ requires BILLING_OWNER_V2_DUAL_WRITE')
  }

  if (flags.v2Read && (!flags.dualWrite || !flags.shadowRead)) {
    throw new Error('BILLING_OWNER_V2_READ requires dual-write and shadow-read')
  }

  if (flags.organizationBilling && !flags.v2Read) {
    throw new Error('ORGANIZATION_BILLING_ENABLED requires BILLING_OWNER_V2_READ')
  }

  return flags
}

export const billingOwnerFeatureFlags = Object.freeze(
  validateBillingOwnerFeatureFlags({
    dualWrite: serverEnv.BILLING_OWNER_V2_DUAL_WRITE,
    shadowRead: serverEnv.BILLING_OWNER_V2_SHADOW_READ,
    v2Read: serverEnv.BILLING_OWNER_V2_READ,
    organizationBilling: serverEnv.ORGANIZATION_BILLING_ENABLED
  })
)

export function getBillingOwnerId(owner: BillingOwner): string {
  return owner.kind === 'user' ? owner.userId : owner.organizationId
}

export function getBillingOwnerWhere(owner: BillingOwner): { userId: string } | { organizationId: string } {
  return owner.kind === 'user' ? { userId: owner.userId } : { organizationId: owner.organizationId }
}

export function getBillingOwnerWriteData(
  owner: BillingOwner,
  flags: BillingOwnerFeatureFlags
): Partial<BillingOwnerColumns> {
  if (!flags.dualWrite) {
    return {}
  }

  return owner.kind === 'user'
    ? { userId: owner.userId, organizationId: null }
    : { userId: null, organizationId: owner.organizationId }
}

export function getStoredBillingOwner(columns: BillingOwnerColumns): BillingOwner | null {
  if (columns.userId && columns.organizationId) {
    throw new Error('Billing customer has ambiguous ownership')
  }

  if (columns.userId) {
    return { kind: 'user', userId: columns.userId }
  }

  if (columns.organizationId) {
    return { kind: 'organization', organizationId: columns.organizationId }
  }

  return null
}

export function findBillingOwnerShadowMismatch(input: BillingOwnerShadowMismatch): BillingOwnerShadowMismatch | null {
  const legacyCustomerIds = [...input.legacyCustomerIds].sort()
  const v2CustomerIds = [...input.v2CustomerIds].sort()

  if (JSON.stringify(legacyCustomerIds) === JSON.stringify(v2CustomerIds)) {
    return null
  }

  return {
    ...input,
    legacyCustomerIds,
    v2CustomerIds
  }
}

export const reportBillingOwnerShadowMismatch: BillingOwnerShadowMismatchReporter = mismatch => {
  console.warn(`[billing-owner] shadow-mismatch ${JSON.stringify(mismatch)}`)
}
