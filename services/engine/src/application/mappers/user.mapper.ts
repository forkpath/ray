import type {
  GetUserAccountsReq,
  GetUserInvitationsReq,
  GetUserMembershipsReq,
  GetUserOrdersReq,
  GetUsersReq,
  GetUsersRes,
  GetUserSubscriptionsReq
} from '@libs/payload'
import type { UserResponse, UserSessionResponse } from '~/application/dtos/user/user.dto'
import type { UserEntity, UserSessionEntity } from '~/domain/entities/user.entity'
import type {
  DateRangeCriteria,
  ListUserAccountsCriteria,
  ListUserInvitationsCriteria,
  ListUserMembershipsCriteria,
  ListUserOrdersCriteria,
  ListUsersCriteria,
  ListUserSubscriptionsCriteria,
  PagedResult,
  SortCriteria
} from '~/domain/repositories/user.repository.interface'

/**
 * 用户实体映射器
 *
 * 负责 Domain Entity 与 Application DTO 之间的转换
 */
export class UserMapper {
  private static toDateRange(range?: [string | number | Date, string | number | Date]): DateRangeCriteria | undefined {
    if (!range) {
      return undefined
    }
    return { from: new Date(range[0]), to: new Date(range[1]) }
  }

  private static toSort(sort?: GetUsersReq['sort']): SortCriteria[] | undefined {
    return sort?.map(item => ({ field: item.id, desc: item.desc }))
  }

  static toListUsersCriteria(params: GetUsersReq): ListUsersCriteria {
    return {
      page: Number(params.page ?? 1),
      perPage: Number(params.perPage ?? 10),
      sort: this.toSort(params.sort),
      q: params.q,
      role: params.role,
      twoFactorEnabled: params.twoFactorEnabled,
      banned: params.banned,
      createdAt: this.toDateRange(params.createdAt)
    }
  }

  static toListAccountsCriteria(params: GetUserAccountsReq): ListUserAccountsCriteria {
    return {
      page: Number(params.page ?? 1),
      perPage: Number(params.perPage ?? 10),
      sort: this.toSort(params.sort),
      providerId: params.providerId,
      createdAt: this.toDateRange(params.createdAt),
      updatedAt: this.toDateRange(params.updatedAt)
    }
  }

  static toListSubscriptionsCriteria(params: GetUserSubscriptionsReq): ListUserSubscriptionsCriteria {
    return {
      page: Number(params.page ?? 1),
      perPage: Number(params.perPage ?? 10),
      sort: this.toSort(params.sort),
      status: params.status,
      createdAt: this.toDateRange(params.createdAt)
    }
  }

  static toListOrdersCriteria(params: GetUserOrdersReq): ListUserOrdersCriteria {
    return {
      page: Number(params.page ?? 1),
      perPage: Number(params.perPage ?? 10),
      sort: this.toSort(params.sort),
      status: params.status,
      store: params.store,
      createdAt: this.toDateRange(params.createdAt)
    }
  }

  static toListMembershipsCriteria(params: GetUserMembershipsReq): ListUserMembershipsCriteria {
    return {
      page: Number(params.page ?? 1),
      perPage: Number(params.perPage ?? 10),
      sort: this.toSort(params.sort),
      role: params.role,
      createdAt: this.toDateRange(params.createdAt)
    }
  }

  static toListInvitationsCriteria(params: GetUserInvitationsReq): ListUserInvitationsCriteria {
    return {
      page: Number(params.page ?? 1),
      perPage: Number(params.perPage ?? 10),
      sort: this.toSort(params.sort),
      role: params.role,
      status: params.status,
      expiresAt: this.toDateRange(params.expiresAt)
    }
  }

  /**
   * 将领域实体转换为响应 DTO
   */
  static toResponse(entity: UserEntity): UserResponse {
    return {
      id: entity.id.toString(),
      name: entity.name,
      email: entity.email.toString(),
      emailVerified: entity.emailVerified,
      image: entity.image,
      twoFactorEnabled: entity.twoFactorEnabled,
      isAnonymous: entity.isAnonymous,
      role: entity.role,
      banned: entity.banned,
      banReason: entity.banReason,
      banExpires: entity.banExpires,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    }
  }

  /**
   * 批量转换
   */
  static toResponseList(entities: UserEntity[]): UserResponse[] {
    return entities.map(e => this.toResponse(e))
  }

  static toUsersResponse(result: PagedResult<UserEntity>): GetUsersRes {
    return {
      list: this.toResponseList(result.list),
      total: result.total
    }
  }

  /**
   * 将会话实体转换为响应 DTO
   */
  static sessionToResponse(entity: UserSessionEntity): UserSessionResponse {
    return {
      id: entity.id,
      userId: entity.userId,
      token: entity.token,
      expiresAt: entity.expiresAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      ipAddress: entity.ipAddress,
      userAgent: entity.userAgent
    }
  }

  /**
   * 批量转换会话
   */
  static sessionsToResponse(entities: UserSessionEntity[]): UserSessionResponse[] {
    return entities.map(e => this.sessionToResponse(e))
  }
}
