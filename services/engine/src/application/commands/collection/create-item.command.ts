import type { ICommandHandler } from '@nestjs/cqrs'
import type { CollectionItemRes, CreateCollectionItemReq } from '@libs/payload'

import { CommandHandler } from '@nestjs/cqrs'

import { CollectionService } from '#/application/services/collection.service'

export class CreateItemCommand {
  constructor(
    public readonly userId: string,
    public readonly orgId: string | null,
    public readonly data: CreateCollectionItemReq
  ) {}
}

@CommandHandler(CreateItemCommand)
export class CreateItemHandler implements ICommandHandler<CreateItemCommand, CollectionItemRes> {
  constructor(private readonly collectionService: CollectionService) {}

  execute(command: CreateItemCommand) {
    return this.collectionService.createItem(command.userId, command.orgId, command.data)
  }
}
