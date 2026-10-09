import { CustomerId } from '~/domain/value-objects/customer-id.vo'
import { ExternalId } from '~/domain/value-objects/external-id.vo'
import { UserId } from '~/domain/value-objects/user-id.vo'

export interface BillingCustomerUserSnapshot {
  readonly name: string
  readonly image: string | null
}

export interface BillingCustomerPersistenceData {
  readonly id: string
  readonly referenceId: string
  readonly provider: string
  readonly externalId: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly user: BillingCustomerUserSnapshot
  readonly subscriptionsCount: number
  readonly ordersCount: number
}

export class BillingCustomer {
  private constructor(
    private readonly customerId: CustomerId,
    private readonly customerReferenceId: UserId,
    private readonly customerProvider: string,
    private readonly customerExternalId: ExternalId,
    private readonly customerCreatedAt: Date,
    private readonly customerUpdatedAt: Date,
    private readonly customerUser: BillingCustomerUserSnapshot,
    private readonly customerSubscriptionsCount: number,
    private readonly customerOrdersCount: number
  ) {}

  static fromPersistence(data: BillingCustomerPersistenceData): BillingCustomer {
    return new BillingCustomer(
      CustomerId.create(data.id),
      UserId.create(data.referenceId),
      data.provider,
      ExternalId.create(data.externalId, data.provider),
      data.createdAt,
      data.updatedAt,
      data.user,
      data.subscriptionsCount,
      data.ordersCount
    )
  }

  get id(): CustomerId {
    return this.customerId
  }

  get referenceId(): UserId {
    return this.customerReferenceId
  }

  get provider(): string {
    return this.customerProvider
  }

  get externalId(): ExternalId {
    return this.customerExternalId
  }

  get createdAt(): Date {
    return this.customerCreatedAt
  }

  get updatedAt(): Date {
    return this.customerUpdatedAt
  }

  get user(): BillingCustomerUserSnapshot {
    return this.customerUser
  }

  get subscriptionsCount(): number {
    return this.customerSubscriptionsCount
  }

  get ordersCount(): number {
    return this.customerOrdersCount
  }
}

export type BillingCustomerEntity = BillingCustomer
