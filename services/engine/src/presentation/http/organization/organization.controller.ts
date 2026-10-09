import type { GetInvitationsRes, GetMembersRes, GetOrganizationRes, GetOrganizationsRes } from '@libs/payload'

import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'

import { Roles } from '@libs/auth-server/nest'

import { DeleteInvitationCommand } from '~/application/commands/organization/delete-invitation.command'
import { DeleteMemberCommand } from '~/application/commands/organization/delete-member.command'
import { DeleteOrganizationCommand } from '~/application/commands/organization/delete-organization.command'
import { UpdateMemberCommand } from '~/application/commands/organization/update-member.command'
import { UpdateOrganizationCommand } from '~/application/commands/organization/update-organization.command'
import {
  ListInvitationsQueryDto,
  ListMembersQueryDto,
  ListOrganizationsQueryDto,
  UpdateMemberDto,
  UpdateOrganizationDto
} from '~/application/dtos/organization/organization.dto'
import { GetOrganizationQuery } from '~/application/queries/organization/get-organization.query'
import { ListInvitationsQuery } from '~/application/queries/organization/list-invitations.query'
import { ListMembersQuery } from '~/application/queries/organization/list-members.query'
import { ListOrganizationsQuery } from '~/application/queries/organization/list-organizations.query'

@Controller('admin/organizations')
@Roles(['admin'])
export class OrganizationController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus
  ) {}

  @Get()
  async list(@Query() query: ListOrganizationsQueryDto): Promise<GetOrganizationsRes> {
    return this.queryBus.execute(new ListOrganizationsQuery(query))
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<GetOrganizationRes> {
    return this.queryBus.execute(new GetOrganizationQuery(id))
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.commandBus.execute(new UpdateOrganizationCommand(id, dto.name, dto.slug))
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.commandBus.execute(new DeleteOrganizationCommand(id))
  }

  @Get(':id/members')
  async listMembers(@Param('id') id: string, @Query() query: ListMembersQueryDto): Promise<GetMembersRes> {
    return this.queryBus.execute(new ListMembersQuery(id, query))
  }

  @Patch(':id/members/:memberId')
  async updateMember(@Param('id') id: string, @Param('memberId') memberId: string, @Body() dto: UpdateMemberDto) {
    return this.commandBus.execute(new UpdateMemberCommand(id, memberId, dto.role))
  }

  @Delete(':id/members/:memberId')
  async deleteMember(@Param('id') id: string, @Param('memberId') memberId: string): Promise<void> {
    return this.commandBus.execute(new DeleteMemberCommand(id, memberId))
  }

  @Get(':id/invitations')
  async listInvitations(@Param('id') id: string, @Query() query: ListInvitationsQueryDto): Promise<GetInvitationsRes> {
    return this.queryBus.execute(new ListInvitationsQuery(id, query))
  }

  @Delete(':id/invitations/:invitationId')
  async deleteInvitation(@Param('id') id: string, @Param('invitationId') invitationId: string): Promise<void> {
    return this.commandBus.execute(new DeleteInvitationCommand(id, invitationId))
  }
}
