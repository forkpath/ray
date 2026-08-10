import type {
  BillingCustomerRecord,
  BillingOrderRecord,
  BillingOrderStatus,
  BillingSubscriptionRecord,
  BillingSubscriptionStatus
} from '@libs/billing-contract'

import { prisma } from '@libs/pg-dao'

function mapCustomer(input: {
  id: string
  referenceId: string
  provider: string
  externalId: string
  createdAt: Date
  updatedAt: Date
}): BillingCustomerRecord {
  return {
    id: input.id,
    referenceId: input.referenceId,
    provider: input.provider,
    externalId: input.externalId,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  }
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

export async function getBillingCustomersByReferenceId(referenceId: string, provider?: string) {
  const customers = await prisma.customer.findMany({
    where: {
      referenceId,
      ...(provider ? { provider } : {})
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return customers.map(mapCustomer)
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

export async function upsertBillingCustomer(input: { referenceId: string; provider: string; externalId: string }) {
  const customer = await prisma.customer.upsert({
    where: {
      externalId_provider: {
        externalId: input.externalId,
        provider: input.provider
      }
    },
    create: {
      referenceId: input.referenceId,
      provider: input.provider,
      externalId: input.externalId
    },
    update: {
      referenceId: input.referenceId
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

export async function getBillingSummaryByReferenceId(referenceId: string) {
  const customers = await prisma.customer.findMany({
    where: {
      referenceId
    },
    include: {
      subscriptions: true,
      orders: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return customers.map(customer => ({
    ...mapCustomer(customer),
    subscriptions: customer.subscriptions.map(mapSubscription),
    orders: customer.orders.map(mapOrder)
  }))
}
