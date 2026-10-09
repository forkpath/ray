import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'
import type { MemberRoleValue } from '~/domain/value-objects/member-role.vo'

import { ForbiddenException, Inject, Injectable } from '@nestjs/common'

import { ORGANIZATION_REPOSITORY } from '~/domain/repositories/organization.repository.interface'
import { MemberRoleEnum } from '~/domain/value-objects/member-role.vo'
import { OrganizationId } from '~/domain/value-objects/organization-id.vo'
import { UserId } from '~/domain/value-objects/user-id.vo'

@Injectable()
export class UserOrganizationAccessService {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly orgRepository: IOrganizationRepository
  ) {}

  async ensureMember(organizationId: string, userId: string): Promise<MemberRoleValue> {
    const role = await this.orgRepository.findMemberRole(OrganizationId.create(organizationId), UserId.create(userId))

    if (!role) {
      throw new ForbiddenException('Not a member of this organization')
    }

    return role
  }

  async ensureInvitationAccess(organizationId: string, userId: string): Promise<void> {
    const role = await this.ensureMember(organizationId, userId)

    if (role !== MemberRoleEnum.OWNER && role !== MemberRoleEnum.ADMIN) {
      throw new ForbiddenException('Only admins can list invitations')
    }
  }

  async isOnlyOwner(organizationId: string, userId: string): Promise<{ isOnlyOwner: boolean }> {
    const role = await this.ensureMember(organizationId, userId)
    if (role !== MemberRoleEnum.OWNER) {
      return { isOnlyOwner: false }
    }

    const ownerCount = await this.orgRepository.countMembersByRole(
      OrganizationId.create(organizationId),
      MemberRoleEnum.OWNER
    )

    return { isOnlyOwner: ownerCount <= 1 }
  }
}
