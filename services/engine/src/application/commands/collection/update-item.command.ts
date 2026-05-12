import type { ICommandHandler } from '@nestjs/cqrs'
import type { CollectionItemRes, UpdateCollectionItemReq } from '@libs/payload'

import { CommandHandler } from '@nestjs/cqrs'

import { CollectionService } from '#/application/services/collection.service'

export class UpdateItemCommand {
  constructor(
    public readonly userId: string,
    public readonly orgId: string | null,
    public readonly id: string,
    public readonly data: UpdateCollectionItemReq
  ) {}
}

@CommandHandler(UpdateItemCommand)
export class UpdateItemHandler implements ICommandHandler<UpdateItemCommand, CollectionItemRes> {
  constructor(private readonly collectionService: CollectionService) {}

  execute(command: UpdateItemCommand) {
    return this.collectionService.updateItem(command.userId, command.orgId, command.id, command.data)
  }
}
