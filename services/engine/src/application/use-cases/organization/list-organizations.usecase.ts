import type { OrganizationEntity } from '~/domain/entities/organization.entity'
import type {
  IOrganizationRepository,
  ListOrganizationsCriteria,
  PagedResult
} from '~/domain/repositories/organization.repository.interface'

export class ListOrganizationsUseCase {
  constructor(private readonly repository: IOrganizationRepository) {}

  execute(
    criteria: ListOrganizationsCriteria
  ): Promise<PagedResult<OrganizationEntity> & { max: { members: number } }> {
    return this.repository.findAll(criteria)
  }
}
