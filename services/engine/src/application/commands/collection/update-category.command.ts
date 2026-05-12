import type { ICommandHandler } from '@nestjs/cqrs'
import type { CategoryRes, UpdateCategoryReq } from '@libs/payload'

import { CommandHandler } from '@nestjs/cqrs'

import { CollectionService } from '#/application/services/collection.service'

export class UpdateCategoryCommand {
  constructor(
    public readonly userId: string,
    public readonly orgId: string | null,
    public readonly id: string,
    public readonly data: UpdateCategoryReq
  ) {}
}

@CommandHandler(UpdateCategoryCommand)
export class UpdateCategoryHandler implements ICommandHandler<UpdateCategoryCommand, CategoryRes> {
  constructor(private readonly collectionService: CollectionService) {}

  execute(command: UpdateCategoryCommand) {
    return this.collectionService.updateCategory(command.userId, command.orgId, command.id, command.data)
  }
}
