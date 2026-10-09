import type { MemberEntity } from '~/domain/entities/organization.entity'
import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'

import { MemberNotFoundException, OrganizationNotFoundException } from '~/domain/exceptions/organization.exception'
import { MemberId } from '~/domain/value-objects/member-id.vo'
import { MemberRole } from '~/domain/value-objects/member-role.vo'
import { OrganizationId } from '~/domain/value-objects/organization-id.vo'

export interface UpdateMemberRoleInput {
  organizationId: string
  memberId: string
  newRole: string
}

export interface UpdateMemberRoleOutput {
  member: MemberEntity
}

export class UpdateMemberRoleUseCase {
  constructor(private readonly organizationRepository: IOrganizationRepository) {}

  async execute(input: UpdateMemberRoleInput): Promise<UpdateMemberRoleOutput> {
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

    const role = MemberRole.create(input.newRole)
    const updated = await this.organizationRepository.updateMember(organizationId, memberId, {
      role: role.getValue()
    })

    return { member: updated }
  }
}
