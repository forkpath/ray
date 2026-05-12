import type { ICommandHandler } from '@nestjs/cqrs'

import { CommandHandler } from '@nestjs/cqrs'

import { CollectionService } from '#/application/services/collection.service'

export class DeleteCategoryCommand {
  constructor(
    public readonly userId: string,
    public readonly orgId: string | null,
    public readonly id: string
  ) {}
}

@CommandHandler(DeleteCategoryCommand)
export class DeleteCategoryHandler implements ICommandHandler<DeleteCategoryCommand, void> {
  constructor(private readonly collectionService: CollectionService) {}

  execute(command: DeleteCategoryCommand) {
    return this.collectionService.deleteCategory(command.userId, command.orgId, command.id)
  }
}
