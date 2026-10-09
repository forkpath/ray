import type { ICommandHandler } from '@nestjs/cqrs'
import type { IObjectStorage } from '~/domain/ports/object-storage.port'

import { Inject } from '@nestjs/common'
import { CommandHandler } from '@nestjs/cqrs'

import { OBJECT_STORAGE } from '~/domain/ports/object-storage.port'

export class GetDeleteUrlCommand {
  constructor(public readonly path: string) {}
}

@CommandHandler(GetDeleteUrlCommand)
export class GetDeleteUrlHandler implements ICommandHandler<GetDeleteUrlCommand, { url: string }> {
  constructor(@Inject(OBJECT_STORAGE) private readonly storageService: IObjectStorage) {}

  execute(command: GetDeleteUrlCommand): Promise<{ url: string }> {
    return this.storageService.getDeleteUrl(command.path)
  }
}
