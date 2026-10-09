import type { OrganizationEntity } from '~/domain/entities/organization.entity'
import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'

import {
  OrganizationNotFoundException,
  OrganizationSlugConflictException
} from '~/domain/exceptions/organization.exception'
import { OrganizationId } from '~/domain/value-objects/organization-id.vo'
import { OrganizationSlug } from '~/domain/value-objects/organization-slug.vo'

export interface UpdateOrganizationInput {
  organizationId: string
  name?: string
  slug?: string
}

export interface UpdateOrganizationOutput {
  organization: OrganizationEntity
}

export class UpdateOrganizationUseCase {
  constructor(private readonly organizationRepository: IOrganizationRepository) {}

  async execute(input: UpdateOrganizationInput): Promise<UpdateOrganizationOutput> {
    const organizationId = OrganizationId.create(input.organizationId)
    const existing = await this.organizationRepository.findById(organizationId)
    if (!existing) {
      throw new OrganizationNotFoundException(input.organizationId)
    }

    const slug = input.slug ? OrganizationSlug.create(input.slug) : undefined
    if (slug && (!existing.slug || !slug.equals(existing.slug))) {
      const conflict = await this.organizationRepository.findBySlug(slug)
      if (conflict && !conflict.id.equals(organizationId)) {
        throw new OrganizationSlugConflictException(slug.getValue())
      }
    }

    const updated = await this.organizationRepository.update(organizationId, {
      name: input.name,
      slug
    })

    return { organization: updated }
  }
}
