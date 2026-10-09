import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'

import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'

import { DeleteInvitationHandler } from '~/application/commands/organization/delete-invitation.command'
import { DeleteMemberHandler } from '~/application/commands/organization/delete-member.command'
import { DeleteOrganizationHandler } from '~/application/commands/organization/delete-organization.command'
import { UpdateMemberHandler } from '~/application/commands/organization/update-member.command'
import { UpdateOrganizationHandler } from '~/application/commands/organization/update-organization.command'
import { GenerateOrganizationSlugHandler } from '~/application/queries/organization/generate-organization-slug.query'
import { GetIsOnlyOwnerHandler } from '~/application/queries/organization/get-is-only-owner.query'
import { GetOrganizationHandler } from '~/application/queries/organization/get-organization.query'
import { ListInvitationsHandler } from '~/application/queries/organization/list-invitations.query'
import { ListMembersHandler } from '~/application/queries/organization/list-members.query'
import { ListOrganizationsHandler } from '~/application/queries/organization/list-organizations.query'
import { ListUserOrganizationInvitationsHandler } from '~/application/queries/organization/list-user-organization-invitations.query'
import { ListUserOrganizationMembersHandler } from '~/application/queries/organization/list-user-organization-members.query'
import { UserOrganizationAccessService } from '~/application/services/user-organization-access.service'
import { ListOrganizationsUseCase } from '~/application/use-cases/organization/list-organizations.usecase'
import { ORGANIZATION_REPOSITORY } from '~/domain/repositories/organization.repository.interface'
import { OrganizationRepository } from '~/infrastructure/repositories/organization.repository'

import { OrganizationController } from './organization.controller'
import { UserOrganizationController } from './user-organization.controller'

const QueryHandlers = [
  ListOrganizationsHandler,
  GetOrganizationHandler,
  ListMembersHandler,
  ListInvitationsHandler,
  GenerateOrganizationSlugHandler,
  GetIsOnlyOwnerHandler,
  ListUserOrganizationMembersHandler,
  ListUserOrganizationInvitationsHandler
]

const CommandHandlers = [
  UpdateOrganizationHandler,
  DeleteOrganizationHandler,
  UpdateMemberHandler,
  DeleteMemberHandler,
  DeleteInvitationHandler
]

@Module({
  imports: [CqrsModule],
  controllers: [OrganizationController, UserOrganizationController],
  providers: [
    {
      provide: ListOrganizationsUseCase,
      useFactory: (repository: IOrganizationRepository) => new ListOrganizationsUseCase(repository),
      inject: [ORGANIZATION_REPOSITORY]
    },
    {
      provide: ORGANIZATION_REPOSITORY,
      useClass: OrganizationRepository
    },
    UserOrganizationAccessService,
    ...QueryHandlers,
    ...CommandHandlers
  ],
  exports: [ORGANIZATION_REPOSITORY]
})
export class OrganizationModule {}
