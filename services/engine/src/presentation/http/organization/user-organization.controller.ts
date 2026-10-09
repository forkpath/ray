import type { GetInvitationsRes, GetMembersRes } from '@libs/payload'

import { Controller, Get, Param, Query } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'

import { Session } from '@libs/auth-server/nest'

import {
  GenerateOrganizationSlugQueryDto,
  ListInvitationsQueryDto,
  ListMembersQueryDto
} from '~/application/dtos/organization/organization.dto'
import { GenerateOrganizationSlugQuery } from '~/application/queries/organization/generate-organization-slug.query'
import { GetIsOnlyOwnerQuery } from '~/application/queries/organization/get-is-only-owner.query'
import { ListUserOrganizationInvitationsQuery } from '~/application/queries/organization/list-user-organization-invitations.query'
import { ListUserOrganizationMembersQuery } from '~/application/queries/organization/list-user-organization-members.query'

interface AuthSession {
  user: { id: string; email: string; role?: string }
}

/**
 * 普通组织成员可访问的只读接口
 *
 * 仅保留 Better Auth `organization` plugin 未覆盖、或过滤能力不足的端点：
 * - slug 去重（Better Auth 不提供）
 * - 带 q/role/status 过滤的 members/invitations 列表（Better Auth listMembers/listInvitations 过滤维度有限）
 * - is-only-owner：离开组织前置校验（Better Auth 不提供）
 *
 * 组织详情、增删改成员/邀请等操作统一由前端 `authClient.organization.*` 直连 Better Auth handler。
 */
@Controller('organizations')
export class UserOrganizationController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('slug')
  async generateSlug(@Query() query: GenerateOrganizationSlugQueryDto): Promise<{ slug: string; available: boolean }> {
    return this.queryBus.execute(new GenerateOrganizationSlugQuery(query.name))
  }

  @Get(':id/members')
  async listMembers(
    @Param('id') id: string,
    @Query() query: ListMembersQueryDto,
    @Session() session: AuthSession
  ): Promise<GetMembersRes> {
    return this.queryBus.execute(new ListUserOrganizationMembersQuery(id, session.user.id, query))
  }

  @Get(':id/members/is-only-owner')
  async isOnlyOwner(@Param('id') id: string, @Session() session: AuthSession): Promise<{ isOnlyOwner: boolean }> {
    return this.queryBus.execute(new GetIsOnlyOwnerQuery(id, session.user.id))
  }

  @Get(':id/invitations')
  async listInvitations(
    @Param('id') id: string,
    @Query() query: ListInvitationsQueryDto,
    @Session() session: AuthSession
  ): Promise<GetInvitationsRes> {
    return this.queryBus.execute(new ListUserOrganizationInvitationsQuery(id, session.user.id, query))
  }
}
