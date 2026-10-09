import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'

import {
  CannotRemoveLastAdminException,
  MemberNotFoundException,
  OrganizationNotFoundException
} from '~/domain/exceptions/organization.exception'
import { MemberId } from '~/domain/value-objects/member-id.vo'
import { MemberRoleEnum } from '~/domain/value-objects/member-role.vo'
import { OrganizationId } from '~/domain/value-objects/organization-id.vo'

export interface RemoveMemberInput {
  organizationId: string
  memberId: string
}

export class RemoveMemberUseCase {
  constructor(private readonly organizationRepository: IOrganizationRepository) {}

  async execute(input: RemoveMemberInput): Promise<void> {
    const organizationId = OrganizationId.create(input.organizationId)
    const memberId = MemberId.create(input.memberId)

    const org = await this.organizationRepository.findById(organizationId)
    if (!org) {
      throw new OrganizationNotFoundException(input.organizationId)
    }

    const member = await this.organizationRepository.findMemberById(organizationId, memberId)
    if (!member) {
      throw new MemberNotFoundException(input.memberId)
    }

    member.assertCanBeRemoved()

    if (member.role.toString() === MemberRoleEnum.ADMIN) {
      const totalMembers = await this.organizationRepository.countMembers(organizationId)
      if (totalMembers <= 1) {
        throw new CannotRemoveLastAdminException()
      }
    }

    await this.organizationRepository.deleteMember(organizationId, memberId)
  }
}
