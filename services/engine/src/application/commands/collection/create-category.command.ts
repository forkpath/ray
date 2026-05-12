import type { ICommandHandler } from '@nestjs/cqrs'
import type { CategoryRes, CreateCategoryReq } from '@libs/payload'

import { CommandHandler } from '@nestjs/cqrs'

import { CollectionService } from '#/application/services/collection.service'

export class CreateCategoryCommand {
  constructor(
    public readonly userId: string,
    public readonly orgId: string | null,
    public readonly data: CreateCategoryReq
  ) {}
}

@CommandHandler(CreateCategoryCommand)
export class CreateCategoryHandler implements ICommandHandler<CreateCategoryCommand, CategoryRes> {
  constructor(private readonly collectionService: CollectionService) {}

  execute(command: CreateCategoryCommand) {
    return this.collectionService.createCategory(command.userId, command.orgId, command.data)
  }
}
