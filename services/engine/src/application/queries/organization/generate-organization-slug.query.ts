import type { IQueryHandler } from '@nestjs/cqrs'
import type { GenerateOrganizationSlugRes } from '@libs/payload'
import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { ORGANIZATION_REPOSITORY } from '~/domain/repositories/organization.repository.interface'
import { OrganizationSlug } from '~/domain/value-objects/organization-slug.vo'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export class GenerateOrganizationSlugQuery {
  constructor(public readonly name: string) {}
}

@QueryHandler(GenerateOrganizationSlugQuery)
export class GenerateOrganizationSlugHandler
  implements IQueryHandler<GenerateOrganizationSlugQuery, GenerateOrganizationSlugRes>
{
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly orgRepository: IOrganizationRepository
  ) {}

  async execute(query: GenerateOrganizationSlugQuery): Promise<GenerateOrganizationSlugRes> {
    let base = toSlug(query.name)
    if (!base || !slugRegex.test(base)) {
      base = 'organization'
    }

    let slug = base
    let counter = 1
    while (await this.orgRepository.findBySlug(OrganizationSlug.create(slug))) {
      slug = `${base}-${counter++}`
    }

    return { slug, available: true }
  }
}
