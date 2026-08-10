import { ForbiddenException, Injectable } from '@nestjs/common'

import { MemberRole } from '@libs/common'
import { prisma } from '@libs/pg-dao'

@Injectable()
export class UserOrganizationAccessService {
  async ensureMember(organizationId: string, userId: string): Promise<'owner' | 'admin' | 'member'> {
    const member = await prisma.member.findFirst({
      where: { organizationId, userId },
      select: { role: true }
    })

    if (!member) {
      throw new ForbiddenException('Not a member of this organization')
    }

    return member.role as 'owner' | 'admin' | 'member'
  }

  async ensureInvitationAccess(organizationId: string, userId: string): Promise<void> {
    const role = await this.ensureMember(organizationId, userId)

    if (role !== MemberRole.OWNER && role !== MemberRole.ADMIN) {
      throw new ForbiddenException('Only admins can list invitations')
    }
  }

  async ensureBillingManagementAccess(organizationId: string, userId: string): Promise<void> {
    const role = await this.ensureMember(organizationId, userId)

    if (role !== MemberRole.OWNER && role !== MemberRole.ADMIN) {
      throw new ForbiddenException('Only organization owners and admins can manage billing')
    }
  }

  async isOnlyOwner(organizationId: string, userId: string): Promise<{ isOnlyOwner: boolean }> {
    const role = await this.ensureMember(organizationId, userId)
    if (role !== MemberRole.OWNER) {
      return { isOnlyOwner: false }
    }

    const ownerCount = await prisma.member.count({
      where: { organizationId, role: MemberRole.OWNER }
    })

    return { isOnlyOwner: ownerCount <= 1 }
  }
}
