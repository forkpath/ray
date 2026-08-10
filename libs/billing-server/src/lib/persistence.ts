import type { BillingOwnerFeatureFlags, BillingOwnerShadowMismatchReporter } from './owner-routing'
import type {
  BillingCustomerRecord,
  BillingOrderRecord,
  BillingOrderStatus,
  BillingOwner,
  BillingSubscriptionRecord,
  BillingSubscriptionStatus
} from '@libs/billing-contract'

import { prisma } from '@libs/pg-dao'

import {
  findBillingOwnerShadowMismatch,
  getBillingOwnerFeatureFlags,
  getBillingOwnerId,
  getBillingOwnerWhere,
  getBillingOwnerWriteData,
  getStoredBillingOwner,
  reportBillingOwnerShadowMismatch
} from './owner-routing'

export interface BillingOwnerPersistenceOptions {
  flags?: BillingOwnerFeatureFlags
  reportShadowMismatch?: BillingOwnerShadowMismatchReporter
}

interface BillingCustomerWhere {
  referenceId?: string
  userId?: string
  organizationId?: string
  provider?: string
}

function mapCustomer(
  input: {
    id: string
    referenceId: string
    userId: string | null
    organizationId: string | null
    provider: string
    externalId: string
    createdAt: Date
    updatedAt: Date
  },
  expectedOwner?: BillingOwner
): BillingCustomerRecord {
  const storedOwner = getStoredBillingOwner(input)
  if (
    storedOwner &&
    expectedOwner &&
    (storedOwner.kind !== expectedOwner.kind || getBillingOwnerId(storedOwner) !== getBillingOwnerId(expectedOwner))
  ) {
    throw new Error(`Billing customer ${input.id} does not match the requested owner`)
  }

  return {
    id: input.id,
    owner: storedOwner ?? expectedOwner ?? null,
    referenceId: input.referenceId,
    provider: input.provider,
    externalId: input.externalId,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  }
}

async function readBillingCustomersByOwner<T extends { id: string }>(input: {
  owner: BillingOwner
  provider?: string
  options?: BillingOwnerPersistenceOptions
  query: (where: BillingCustomerWhere) => Promise<T[]>
}): Promise<T[]> {
  const flags = input.options?.flags ?? getBillingOwnerFeatureFlags()
  const providerWhere = input.provider ? { provider: input.provider } : {}
  const readLegacy = !flags.v2Read || flags.shadowRead
  const readV2 = flags.v2Read || flags.shadowRead
  const [legacyCustomers, v2Customers] = await Promise.all([
    readLegacy ? input.query({ referenceId: getBillingOwnerId(input.owner), ...providerWhere }) : Promise.resolve([]),
    readV2 ? input.query({ ...getBillingOwnerWhere(input.owner), ...providerWhere }) : Promise.resolve([])
  ])

  if (flags.shadowRead) {
    const mismatch = findBillingOwnerShadowMismatch({
      owner: input.owner,
      provider: input.provider,
      legacyCustomerIds: legacyCustomers.map(customer => customer.id),
      v2CustomerIds: v2Customers.map(customer => customer.id)
    })

    if (mismatch) {
      const reporter = input.options?.reportShadowMismatch ?? reportBillingOwnerShadowMismatch
      reporter(mismatch)
    }
  }

  return flags.v2Read ? v2Customers : legacyCustomers
}

function mapSubscription(input: {
  id: string
  customerId: string
  externalId: string
  variantId: string
  status: string
  store: string
  periodStartsAt: Date
  periodEndsAt: Date
  trialStartsAt: Date | null
  trialEndsAt: Date | null
  createdAt: Date
  updatedAt: Date
}): BillingSubscriptionRecord {
  return {
    id: input.id,
    customerId: input.customerId,
    externalId: input.externalId,
    variantId: input.variantId,
    status: input.status as BillingSubscriptionStatus,
    store: input.store,
    periodStartsAt: input.periodStartsAt,
    periodEndsAt: input.periodEndsAt,
    trialStartsAt: input.trialStartsAt,
    trialEndsAt: input.trialEndsAt,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  }
}

function mapOrder(input: {
  id: string
  customerId: string
  externalId: string
  variantId: string
  status: string
  store: string
  createdAt: Date
  updatedAt: Date
}): BillingOrderRecord {
  return {
    id: input.id,
    customerId: input.customerId,
    externalId: input.externalId,
    variantId: input.variantId,
    status: input.status as BillingOrderStatus,
    store: input.store,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  }
}

export async function getBillingCustomersByOwner(
  owner: BillingOwner,
  provider?: string,
  options?: BillingOwnerPersistenceOptions
) {
  const customers = await readBillingCustomersByOwner({
    owner,
    provider,
    options,
    query: where =>
      prisma.customer.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        }
      })
  })

  return customers.map(customer => mapCustomer(customer, owner))
}

/** @deprecated Use getBillingCustomersByOwner with a user owner. */
export function getBillingCustomersByReferenceId(referenceId: string, provider?: string) {
  return getBillingCustomersByOwner({ kind: 'user', userId: referenceId }, provider)
}

export async function getBillingCustomerByExternalId(externalId: string, provider: string) {
  const customer = await prisma.customer.findUnique({
    where: {
      externalId_provider: {
        externalId,
        provider
      }
    }
  })

  return customer ? mapCustomer(customer) : null
}

export async function upsertBillingCustomer(
  input: { owner: BillingOwner; provider: string; externalId: string },
  options?: BillingOwnerPersistenceOptions
) {
  const flags = options?.flags ?? getBillingOwnerFeatureFlags()
  const referenceId = getBillingOwnerId(input.owner)
  const ownerData = getBillingOwnerWriteData(input.owner, flags)
  const customer = await prisma.customer.upsert({
    where: {
      referenceId_provider: {
        referenceId,
        provider: input.provider
      }
    },
    create: {
      referenceId,
      ...ownerData,
      provider: input.provider,
      externalId: input.externalId
    },
    update: {
      referenceId,
      externalId: input.externalId,
      ...ownerData
    }
  })

  return mapCustomer(customer)
}

export async function upsertBillingSubscription(input: {
  customerId: string
  externalId: string
  variantId: string
  status: BillingSubscriptionStatus
  store: string
  periodStartsAt: Date
  periodEndsAt: Date
  trialStartsAt?: Date | null
  trialEndsAt?: Date | null
}) {
  const subscription = await prisma.subscription.upsert({
    where: {
      externalId_store: {
        externalId: input.externalId,
        store: input.store
      }
    },
    create: {
      customerId: input.customerId,
      externalId: input.externalId,
      variantId: input.variantId,
      status: input.status,
      store: input.store,
      periodStartsAt: input.periodStartsAt,
      periodEndsAt: input.periodEndsAt,
      trialStartsAt: input.trialStartsAt ?? null,
      trialEndsAt: input.trialEndsAt ?? null
    },
    update: {
      variantId: input.variantId,
      status: input.status,
      periodStartsAt: input.periodStartsAt,
      periodEndsAt: input.periodEndsAt,
      trialStartsAt: input.trialStartsAt ?? null,
      trialEndsAt: input.trialEndsAt ?? null
    }
  })

  return mapSubscription(subscription)
}

export async function upsertBillingOrder(input: {
  customerId: string
  externalId: string
  variantId: string
  status: BillingOrderStatus
  store: string
}) {
  const order = await prisma.order.upsert({
    where: {
      externalId_store: {
        externalId: input.externalId,
        store: input.store
      }
    },
    create: {
      customerId: input.customerId,
      externalId: input.externalId,
      variantId: input.variantId,
      status: input.status,
      store: input.store
    },
    update: {
      variantId: input.variantId,
      status: input.status
    }
  })

  return mapOrder(order)
}

export async function findWebhookEvent(eventId: string, provider: string) {
  return prisma.webhookEvent.findUnique({
    where: { eventId_provider: { eventId, provider } }
  })
}

export async function createWebhookEvent(input: {
  eventId: string
  provider: string
  type: string
  status: 'processed' | 'failed' | 'skipped'
  error?: string
}) {
  return prisma.webhookEvent.create({
    data: {
      eventId: input.eventId,
      provider: input.provider,
      type: input.type,
      status: input.status,
      error: input.error ?? null
    }
  })
}

export async function getBillingSummaryByOwner(owner: BillingOwner, options?: BillingOwnerPersistenceOptions) {
  const customers = await readBillingCustomersByOwner({
    owner,
    options,
    query: where =>
      prisma.customer.findMany({
        where,
        include: {
          subscriptions: true,
          orders: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
  })

  return customers.map(customer => ({
    ...mapCustomer(customer, owner),
    subscriptions: customer.subscriptions.map(mapSubscription),
    orders: customer.orders.map(mapOrder)
  }))
}

/** @deprecated Use getBillingSummaryByOwner with a user owner. */
export function getBillingSummaryByReferenceId(referenceId: string) {
  return getBillingSummaryByOwner({ kind: 'user', userId: referenceId })
}
