import type { IBillingRepository } from '~/domain/repositories/billing.repository.interface'

export class HandleStripeWebhookUseCase {
  constructor(private readonly repository: IBillingRepository) {}

  execute(input: { payload: Buffer | string; signature: string }) {
    return this.repository.handleStripeWebhook(input)
  }
}

export class HandleRevenueCatWebhookUseCase {
  constructor(private readonly repository: IBillingRepository) {}

  execute(input: { payload: Buffer | string | Record<string, unknown>; authorization?: string }) {
    return this.repository.handleRevenueCatWebhook(input)
  }
}
