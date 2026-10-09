import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'

import { OrganizationNotFoundException } from '~/domain/exceptions/organization.exception'
import { OrganizationId } from '~/domain/value-objects/organization-id.vo'

export interface DeleteOrganizationInput {
  organizationId: string
}

export class DeleteOrganizationUseCase {
  constructor(private readonly organizationRepository: IOrganizationRepository) {}

  async execute(input: DeleteOrganizationInput): Promise<void> {
    const organizationId = OrganizationId.create(input.organizationId)
    const existing = await this.organizationRepository.findById(organizationId)
    if (!existing) {
      throw new OrganizationNotFoundException(input.organizationId)
    }

    await this.organizationRepository.delete(organizationId)
  }
}
