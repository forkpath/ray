import type { InvitationEntity, MemberEntity, OrganizationEntity } from '~/domain/entities/organization.entity'
import type { InvitationId } from '~/domain/value-objects/invitation-id.vo'
import type { MemberId } from '~/domain/value-objects/member-id.vo'
import type { MemberRoleValue } from '~/domain/value-objects/member-role.vo'
import type { OrganizationId } from '~/domain/value-objects/organization-id.vo'
import type { OrganizationSlug } from '~/domain/value-objects/organization-slug.vo'
import type { UserId } from '~/domain/value-objects/user-id.vo'

export interface DateRangeCriteria {
  readonly from: Date
  readonly to: Date
}

export interface NumberRangeCriteria {
  readonly from: number
  readonly to: number
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

export interface ListOrganizationsCriteria extends PaginationCriteria {
  readonly q?: string
  readonly createdAt?: DateRangeCriteria
  readonly members?: NumberRangeCriteria
}

export interface ListMembersCriteria extends PaginationCriteria {
  readonly q?: string
  readonly role?: MemberRoleValue[]
  readonly createdAt?: DateRangeCriteria
}

export interface ListInvitationsCriteria extends PaginationCriteria {
  readonly email?: string
  readonly role?: MemberRoleValue[]
  readonly status?: string[]
  readonly expiresAt?: DateRangeCriteria
}

export interface UpdateOrganizationData {
  readonly name?: string
  readonly slug?: OrganizationSlug
}

export interface UpdateMemberData {
  readonly role: MemberRoleValue
}

export interface PagedResult<T> {
  readonly list: T[]
  readonly total: number
}

export interface IOrganizationRepository {
  findAll(params: ListOrganizationsCriteria): Promise<PagedResult<OrganizationEntity> & { max: { members: number } }>

  findById(id: OrganizationId): Promise<OrganizationEntity | null>

  count(): Promise<number>

  update(id: OrganizationId, data: UpdateOrganizationData): Promise<OrganizationEntity>

  delete(id: OrganizationId): Promise<void>

  findBySlug(slug: OrganizationSlug): Promise<OrganizationEntity | null>

  findMembers(orgId: OrganizationId, params: ListMembersCriteria): Promise<PagedResult<MemberEntity>>

  findMemberById(orgId: OrganizationId, memberId: MemberId): Promise<MemberEntity | null>

  countMembers(orgId: OrganizationId): Promise<number>

  findMemberRole(orgId: OrganizationId, userId: UserId): Promise<MemberRoleValue | null>

  countMembersByRole(orgId: OrganizationId, role: MemberRoleValue): Promise<number>

  updateMember(orgId: OrganizationId, memberId: MemberId, data: UpdateMemberData): Promise<MemberEntity>

  deleteMember(orgId: OrganizationId, memberId: MemberId): Promise<void>

  findInvitations(orgId: OrganizationId, params: ListInvitationsCriteria): Promise<PagedResult<InvitationEntity>>

  deleteInvitation(orgId: OrganizationId, invitationId: InvitationId): Promise<void>
}

export const ORGANIZATION_REPOSITORY = Symbol('ORGANIZATION_REPOSITORY')
