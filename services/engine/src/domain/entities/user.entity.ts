import { CannotOperateSelfException, UserAlreadyBannedException } from '~/domain/exceptions/user.exception'
import { Email } from '~/domain/value-objects/email.vo'
import { UserId } from '~/domain/value-objects/user-id.vo'

/**
 * 用户角色
 */
export const UserRole = {
  USER: 'user',
  ADMIN: 'admin'
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export interface UserPersistenceData {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly emailVerified: boolean
  readonly image: string | null
  readonly twoFactorEnabled: boolean | null
  readonly isAnonymous: boolean | null
  readonly role: UserRole | null
  readonly banned: boolean | null
  readonly banReason: string | null
  readonly banExpires: Date | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface ChangeUserProfileInput {
  readonly name?: string
  readonly image?: string | null
}

/**
 * 用户实体
 *
 * 字段与 better-auth User 模型保持一致，行为只表达 engine 管理端的不变量。
 */
export class User {
  private constructor(
    private readonly userId: UserId,
    private userEmail: Email,
    private userName: string,
    private isEmailVerified: boolean,
    private userImage: string | null,
    private hasTwoFactorEnabled: boolean,
    private hasAnonymousIdentity: boolean,
    private userRole: UserRole,
    private hasBanned: boolean,
    private userBanReason: string | null,
    private userBanExpires: Date | null,
    private readonly userCreatedAt: Date,
    private userUpdatedAt: Date
  ) {}

  static fromPersistence(data: UserPersistenceData): User {
    return new User(
      UserId.create(data.id),
      Email.create(data.email),
      data.name,
      data.emailVerified,
      data.image,
      data.twoFactorEnabled ?? false,
      data.isAnonymous ?? false,
      data.role ?? UserRole.USER,
      data.banned ?? false,
      data.banReason,
      data.banExpires,
      data.createdAt,
      data.updatedAt
    )
  }

  get id(): UserId {
    return this.userId
  }

  get name(): string {
    return this.userName
  }

  get email(): Email {
    return this.userEmail
  }

  get emailVerified(): boolean {
    return this.isEmailVerified
  }

  get image(): string | null {
    return this.userImage
  }

  get twoFactorEnabled(): boolean {
    return this.hasTwoFactorEnabled
  }

  get isAnonymous(): boolean {
    return this.hasAnonymousIdentity
  }

  get role(): UserRole {
    return this.userRole
  }

  get banned(): boolean {
    return this.hasBanned
  }

  get banReason(): string | null {
    return this.userBanReason
  }

  get banExpires(): Date | null {
    return this.userBanExpires
  }

  get createdAt(): Date {
    return this.userCreatedAt
  }

  get updatedAt(): Date {
    return this.userUpdatedAt
  }

  assertCanBeBannedBy(operatorId: UserId): void {
    if (this.userId.equals(operatorId)) {
      throw new CannotOperateSelfException('ban')
    }
    if (this.hasBanned) {
      throw new UserAlreadyBannedException(this.userId.toString())
    }
  }

  assertCanBeDeletedBy(operatorId: UserId): void {
    if (this.userId.equals(operatorId)) {
      throw new CannotOperateSelfException('delete')
    }
  }

  changeProfile(input: ChangeUserProfileInput): void {
    if (input.name !== undefined) {
      this.userName = input.name
    }
    if (input.image !== undefined) {
      this.userImage = input.image
    }
    this.userUpdatedAt = new Date()
  }
}

export type UserEntity = User

/**
 * 用户会话实体
 */
export interface UserSessionEntity {
  readonly id: string
  readonly userId: string
  readonly token: string
  readonly expiresAt: Date
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly ipAddress: string | null
  readonly userAgent: string | null
}
