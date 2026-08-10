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

export type WebhookEventTerminalStatus = 'processed' | 'skipped'

export type WebhookEventClaim =
  | { outcome: 'claimed'; attemptCount: number }
  | { outcome: 'processing'; attemptCount: number }
  | { outcome: 'terminal'; attemptCount: number; status: WebhookEventTerminalStatus }

const WEBHOOK_PROCESSING_LEASE_MS = 5 * 60 * 1000

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

export async function claimWebhookEvent(input: {
  eventId: string
  provider: string
  type: string
}): Promise<WebhookEventClaim> {
  const attemptedAt = new Date()
  const staleBefore = new Date(attemptedAt.getTime() - WEBHOOK_PROCESSING_LEASE_MS)
  const key = {
    eventId_provider: {
      eventId: input.eventId,
      provider: input.provider
    }
  }

  await prisma.webhookEvent.upsert({
    where: key,
    create: {
      eventId: input.eventId,
      provider: input.provider,
      type: input.type,
      status: 'received',
      processedAt: null
    },
    update: {}
  })

  const claimed = await prisma.webhookEvent.updateMany({
    where: {
      eventId: input.eventId,
      provider: input.provider,
      OR: [
        { status: { in: ['received', 'failed'] } },
        { status: 'processing', lastAttemptAt: null },
        { status: 'processing', lastAttemptAt: { lt: staleBefore } }
      ]
    },
    data: {
      status: 'processing',
      error: null,
      processedAt: null,
      lastAttemptAt: attemptedAt,
      attemptCount: { increment: 1 }
    }
  })
  const event = await prisma.webhookEvent.findUniqueOrThrow({ where: key })

  if (claimed.count === 1) {
    return { outcome: 'claimed', attemptCount: event.attemptCount }
  }

  if (event.status === 'processed' || event.status === 'skipped') {
    return { outcome: 'terminal', status: event.status, attemptCount: event.attemptCount }
  }

  return { outcome: 'processing', attemptCount: event.attemptCount }
}

export async function completeWebhookEvent(input: {
  eventId: string
  provider: string
  attemptCount: number
  status: WebhookEventTerminalStatus
}) {
  const result = await prisma.webhookEvent.updateMany({
    where: {
      eventId: input.eventId,
      provider: input.provider,
      status: 'processing',
      attemptCount: input.attemptCount
    },
    data: {
      status: input.status,
      error: null,
      processedAt: new Date()
    }
  })

  if (result.count !== 1) {
    throw new Error(`Webhook event ${input.provider}/${input.eventId} no longer owns the processing claim`)
  }
}

export async function failWebhookEvent(input: {
  eventId: string
  provider: string
  attemptCount: number
  error: string
}) {
  const result = await prisma.webhookEvent.updateMany({
    where: {
      eventId: input.eventId,
      provider: input.provider,
      status: 'processing',
      attemptCount: input.attemptCount
    },
    data: {
      status: 'failed',
      error: input.error,
      processedAt: null
    }
  })

  if (result.count !== 1) {
    throw new Error(`Webhook event ${input.provider}/${input.eventId} no longer owns the processing claim`)
  }
}

/** @deprecated Use claimWebhookEvent followed by completeWebhookEvent or failWebhookEvent. */
export async function createWebhookEvent(input: {
  eventId: string
  provider: string
  type: string
  status: 'processed' | 'failed' | 'skipped'
  error?: string
}) {
  const claim = await claimWebhookEvent(input)

  if (claim.outcome === 'claimed') {
    if (input.status === 'failed') {
      await failWebhookEvent({
        eventId: input.eventId,
        provider: input.provider,
        attemptCount: claim.attemptCount,
        error: input.error ?? 'Webhook processing failed'
      })
    } else {
      await completeWebhookEvent({
        eventId: input.eventId,
        provider: input.provider,
        attemptCount: claim.attemptCount,
        status: input.status
      })
    }
  }

  return findWebhookEvent(input.eventId, input.provider)
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
