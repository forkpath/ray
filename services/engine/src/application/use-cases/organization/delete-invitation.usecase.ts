import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'

import { InvitationId } from '~/domain/value-objects/invitation-id.vo'
import { OrganizationId } from '~/domain/value-objects/organization-id.vo'

export interface DeleteInvitationInput {
  organizationId: string
  invitationId: string
}

export class DeleteInvitationUseCase {
  constructor(private readonly organizationRepository: IOrganizationRepository) {}

  async execute(input: DeleteInvitationInput): Promise<void> {
    await this.organizationRepository.deleteInvitation(
      OrganizationId.create(input.organizationId),
      InvitationId.create(input.invitationId)
    )
  }
}
