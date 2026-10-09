import { CannotRemoveOwnerException } from '~/domain/exceptions/organization.exception'
import { InvitationId } from '~/domain/value-objects/invitation-id.vo'
import { InvitationStatus } from '~/domain/value-objects/invitation-status.vo'
import { MemberId } from '~/domain/value-objects/member-id.vo'
import { MemberRole } from '~/domain/value-objects/member-role.vo'
import { OrganizationId } from '~/domain/value-objects/organization-id.vo'
import { OrganizationSlug } from '~/domain/value-objects/organization-slug.vo'
import { UserId } from '~/domain/value-objects/user-id.vo'

export interface OrganizationPersistenceData {
  readonly id: string
  readonly name: string
  readonly slug: string | null
  readonly logo: string | null
  readonly createdAt: Date
  readonly membersCount: number
}

export interface MemberUserSnapshot {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly image: string | null
}

export interface MemberPersistenceData {
  readonly id: string
  readonly userId: string
  readonly organizationId: string
  readonly role: string
  readonly createdAt: Date
  readonly user: MemberUserSnapshot
}

export interface InvitationPersistenceData {
  readonly id: string
  readonly email: string
  readonly role: string
  readonly status: string
  readonly expiresAt: Date
  readonly createdAt: Date
  readonly organizationId: string
  readonly inviterId: string
}

export class Organization {
  private constructor(
    private readonly organizationId: OrganizationId,
    private organizationName: string,
    private organizationSlug: OrganizationSlug | null,
    private organizationLogo: string | null,
    private readonly organizationCreatedAt: Date,
    private organizationMembersCount: number
  ) {}

  static fromPersistence(data: OrganizationPersistenceData): Organization {
    return new Organization(
      OrganizationId.create(data.id),
      data.name,
      data.slug ? OrganizationSlug.create(data.slug) : null,
      data.logo,
      data.createdAt,
      data.membersCount
    )
  }

  get id(): OrganizationId {
    return this.organizationId
  }

  get name(): string {
    return this.organizationName
  }

  get slug(): OrganizationSlug | null {
    return this.organizationSlug
  }

  get logo(): string | null {
    return this.organizationLogo
  }

  get createdAt(): Date {
    return this.organizationCreatedAt
  }

  get membersCount(): number {
    return this.organizationMembersCount
  }

  changeName(name: string): void {
    this.organizationName = name
  }

  changeSlug(slug: OrganizationSlug | null): void {
    this.organizationSlug = slug
  }
}

export class Member {
  private constructor(
    private readonly memberId: MemberId,
    private readonly memberUserId: UserId,
    private readonly memberOrganizationId: OrganizationId,
    private memberRole: MemberRole,
    private readonly memberCreatedAt: Date,
    private readonly memberUser: MemberUserSnapshot
  ) {}

  static fromPersistence(data: MemberPersistenceData): Member {
    return new Member(
      MemberId.create(data.id),
      UserId.create(data.userId),
      OrganizationId.create(data.organizationId),
      MemberRole.create(data.role),
      data.createdAt,
      data.user
    )
  }

  get id(): MemberId {
    return this.memberId
  }

  get userId(): UserId {
    return this.memberUserId
  }

  get organizationId(): OrganizationId {
    return this.memberOrganizationId
  }

  get role(): MemberRole {
    return this.memberRole
  }

  get createdAt(): Date {
    return this.memberCreatedAt
  }

  get user(): MemberUserSnapshot {
    return this.memberUser
  }

  changeRole(role: MemberRole): void {
    this.memberRole = role
  }

  assertCanBeRemoved(): void {
    if (this.memberRole.isOwner()) {
      throw new CannotRemoveOwnerException()
    }
  }
}

export class Invitation {
  private constructor(
    private readonly invitationId: InvitationId,
    private readonly invitationEmail: string,
    private readonly invitationRole: MemberRole,
    private readonly invitationStatus: InvitationStatus,
    private readonly invitationExpiresAt: Date,
    private readonly invitationCreatedAt: Date,
    private readonly invitationOrganizationId: OrganizationId,
    private readonly invitationInviterId: UserId
  ) {}

  static fromPersistence(data: InvitationPersistenceData): Invitation {
    return new Invitation(
      InvitationId.create(data.id),
      data.email,
      MemberRole.create(data.role),
      InvitationStatus.create(data.status),
      data.expiresAt,
      data.createdAt,
      OrganizationId.create(data.organizationId),
      UserId.create(data.inviterId)
    )
  }

  get id(): InvitationId {
    return this.invitationId
  }

  get email(): string {
    return this.invitationEmail
  }

  get role(): MemberRole {
    return this.invitationRole
  }

  get status(): InvitationStatus {
    return this.invitationStatus
  }

  get expiresAt(): Date {
    return this.invitationExpiresAt
  }

  get createdAt(): Date {
    return this.invitationCreatedAt
  }

  get organizationId(): OrganizationId {
    return this.invitationOrganizationId
  }

  get inviterId(): UserId {
    return this.invitationInviterId
  }
}

export type OrganizationEntity = Organization
export type MemberEntity = Member
export type InvitationEntity = Invitation
