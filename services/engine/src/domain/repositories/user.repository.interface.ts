import type { User, UserRole, UserSessionEntity } from '~/domain/entities/user.entity'
import type { Email } from '~/domain/value-objects/email.vo'
import type { UserId } from '~/domain/value-objects/user-id.vo'

export interface AccountEntity {
  readonly id: string
  readonly userId: string
  readonly providerId: string
  readonly accountId: string
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface UserSubscriptionEntity {
  readonly id: string
  readonly customerId: string
  readonly externalId: string
  readonly variantId: string
  readonly status: string
  readonly store: string
  readonly periodStartsAt: Date
  readonly periodEndsAt: Date
  readonly trialStartsAt: Date | null
  readonly trialEndsAt: Date | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface UserOrderEntity {
  readonly id: string
  readonly customerId: string
  readonly externalId: string
  readonly variantId: string
  readonly status: string
  readonly store: string
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface UserMembershipEntity {
  readonly id: string
  readonly organizationId: string
  readonly role: string
  readonly createdAt: Date
  readonly userId: string
  readonly organization: {
    readonly id: string
    readonly name: string
    readonly slug: string | null
    readonly logo: string | null
  }
  readonly user: {
    readonly id: string
    readonly name: string
    readonly email: string
  }
}

export interface UserInvitationEntity {
  readonly id: string
  readonly email: string
  readonly role: string
  readonly status: string
  readonly expiresAt: Date
  readonly createdAt: Date
  readonly inviterId: string
  readonly organizationId: string
  readonly organization: {
    readonly id: string
    readonly name: string
    readonly logo: string | null
  }
}

export interface DateRangeCriteria {
  readonly from: Date
  readonly to: Date
}

export interface SortCriteria {
  readonly field: string
  readonly desc: boolean
}

export interface PaginationCriteria {
  readonly page: number
  readonly perPage: number
  readonly sort?: SortCriteria[]
}

export interface ListUsersCriteria extends PaginationCriteria {
  readonly q?: string
  readonly role?: UserRole[]
  readonly twoFactorEnabled?: boolean[]
  readonly banned?: boolean[]
  readonly createdAt?: DateRangeCriteria
}

export interface ListUserAccountsCriteria extends PaginationCriteria {
  readonly providerId?: string[]
  readonly createdAt?: DateRangeCriteria
  readonly updatedAt?: DateRangeCriteria
}

export interface ListUserSubscriptionsCriteria extends PaginationCriteria {
  readonly status?: string[]
  readonly createdAt?: DateRangeCriteria
}

export interface ListUserOrdersCriteria extends PaginationCriteria {
  readonly status?: string[]
  readonly store?: string[]
  readonly createdAt?: DateRangeCriteria
}

export interface ListUserMembershipsCriteria extends PaginationCriteria {
  readonly role?: string[]
  readonly createdAt?: DateRangeCriteria
}

export interface ListUserInvitationsCriteria extends PaginationCriteria {
  readonly role?: string[]
  readonly status?: string[]
  readonly expiresAt?: DateRangeCriteria
}

export interface PagedResult<T> {
  readonly list: T[]
  readonly total: number
}

/**
 * 用户仓储接口
 *
 * 领域层定义的抽象接口，由基础设施层实现
 */
export interface IUserRepository {
  findById(id: UserId): Promise<User | null>

  findByEmail(email: Email): Promise<User | null>

  findMany(params: ListUsersCriteria): Promise<PagedResult<User>>

  update(id: UserId, data: Partial<Pick<User, 'name' | 'image' | 'role'>>): Promise<User>

  ban(id: UserId, reason?: string, expiresAt?: Date): Promise<User>

  unban(id: UserId): Promise<User>

  delete(id: UserId): Promise<void>

  getSessions(userId: UserId): Promise<UserSessionEntity[]>

  revokeSession(sessionToken: string): Promise<void>

  revokeAllSessions(userId: UserId): Promise<void>

  setPassword(userId: UserId, newPassword: string): Promise<void>

  findAccounts(userId: UserId, params: ListUserAccountsCriteria): Promise<PagedResult<AccountEntity>>

  countAccounts(userId: UserId): Promise<number>

  deleteAccount(userId: UserId, accountId: string): Promise<boolean>

  findSubscriptions(userId: UserId, params: ListUserSubscriptionsCriteria): Promise<PagedResult<UserSubscriptionEntity>>

  findOrders(userId: UserId, params: ListUserOrdersCriteria): Promise<PagedResult<UserOrderEntity>>

  findMemberships(userId: UserId, params: ListUserMembershipsCriteria): Promise<PagedResult<UserMembershipEntity>>

  findInvitations(userId: UserId, params: ListUserInvitationsCriteria): Promise<PagedResult<UserInvitationEntity>>
}

/**
 * 用户仓储注入 Token
 */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY')
