import type { ICommandHandler } from '@nestjs/cqrs'

import { CommandHandler } from '@nestjs/cqrs'

import { CollectionService } from '#/application/services/collection.service'

export class DeleteItemCommand {
  constructor(
    public readonly userId: string,
    public readonly orgId: string | null,
    public readonly id: string
  ) {}
}

@CommandHandler(DeleteItemCommand)
export class DeleteItemHandler implements ICommandHandler<DeleteItemCommand, void> {
  constructor(private readonly collectionService: CollectionService) {}

  execute(command: DeleteItemCommand) {
    return this.collectionService.deleteItem(command.userId, command.orgId, command.id)
  }
}
