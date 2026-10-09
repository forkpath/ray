import type {
  GetInvitationsReq,
  GetInvitationsRes,
  GetMembersReq,
  GetMembersRes,
  GetOrganizationRes,
  GetOrganizationsReq,
  GetOrganizationsRes
} from '@libs/payload'
import type { InvitationEntity, MemberEntity, OrganizationEntity } from '~/domain/entities/organization.entity'
import type {
  DateRangeCriteria,
  ListInvitationsCriteria,
  ListMembersCriteria,
  ListOrganizationsCriteria,
  NumberRangeCriteria,
  PagedResult,
  SortCriteria
} from '~/domain/repositories/organization.repository.interface'

type OrganizationListItem = GetOrganizationsRes['list'][number]
type MemberListItem = GetMembersRes['list'][number]
type InvitationListItem = GetInvitationsRes['list'][number]

export class OrganizationMapper {
  private static toDateRange(range?: [string | number | Date, string | number | Date]): DateRangeCriteria | undefined {
    if (!range) {
      return undefined
    }
    return { from: new Date(range[0]), to: new Date(range[1]) }
  }

  private static toNumberRange(range?: [number, number]): NumberRangeCriteria | undefined {
    if (!range) {
      return undefined
    }
    return { from: range[0], to: range[1] }
  }

  private static toSort(sort?: GetOrganizationsReq['sort']): SortCriteria[] | undefined {
    return sort?.map(item => ({ field: item.id, desc: item.desc }))
  }

  static toListOrganizationsCriteria(params: GetOrganizationsReq): ListOrganizationsCriteria {
    return {
      page: Number(params.page ?? 1),
      perPage: Number(params.perPage ?? 10),
      sort: this.toSort(params.sort),
      q: params.q,
      createdAt: this.toDateRange(params.createdAt),
      members: this.toNumberRange(params.members)
    }
  }

  static toListMembersCriteria(params: GetMembersReq): ListMembersCriteria {
    return {
      page: Number(params.page ?? 1),
      perPage: Number(params.perPage ?? 10),
      sort: this.toSort(params.sort),
      q: params.q,
      role: params.role,
      createdAt: this.toDateRange(params.createdAt)
    }
  }

  static toListInvitationsCriteria(params: GetInvitationsReq): ListInvitationsCriteria {
    return {
      page: Number(params.page ?? 1),
      perPage: Number(params.perPage ?? 10),
      sort: this.toSort(params.sort),
      email: params.email,
      role: params.role,
      status: params.status,
      expiresAt: this.toDateRange(params.expiresAt)
    }
  }

  static toOrganizationListItem(entity: OrganizationEntity): OrganizationListItem {
    return {
      id: entity.id.toString(),
      name: entity.name,
      slug: entity.slug?.toString() ?? null,
      logo: entity.logo,
      createdAt: entity.createdAt,
      members: entity.membersCount
    }
  }

  static toOrganizationDetail(entity: OrganizationEntity): NonNullable<GetOrganizationRes> {
    return {
      id: entity.id.toString(),
      name: entity.name,
      slug: entity.slug?.toString() ?? null,
      logo: entity.logo,
      createdAt: entity.createdAt
    }
  }

  static toOrganizationsResponse(
    result: PagedResult<OrganizationEntity> & { max: { members: number } }
  ): GetOrganizationsRes {
    return {
      list: result.list.map(entity => this.toOrganizationListItem(entity)),
      total: result.total,
      max: result.max
    }
  }

  static toMemberResponse(entity: MemberEntity): MemberListItem {
    return {
      id: entity.id.toString(),
      organizationId: entity.organizationId.toString(),
      role: entity.role.toString() as MemberListItem['role'],
      createdAt: entity.createdAt,
      userId: entity.userId.toString(),
      user: {
        id: entity.user.id,
        name: entity.user.name,
        email: entity.user.email,
        image: entity.user.image
      }
    }
  }

  static toInvitationResponse(entity: InvitationEntity): InvitationListItem {
    return {
      id: entity.id.toString(),
      organizationId: entity.organizationId.toString(),
      email: entity.email,
      role: entity.role.toString() as InvitationListItem['role'],
      expiresAt: entity.expiresAt,
      createdAt: entity.createdAt,
      inviterId: entity.inviterId.toString(),
      status: entity.status.toString() as InvitationListItem['status']
    }
  }
}
