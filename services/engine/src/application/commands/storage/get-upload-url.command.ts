import type { ICommandHandler } from '@nestjs/cqrs'
import type { IObjectStorage } from '~/domain/ports/object-storage.port'

import { Inject } from '@nestjs/common'
import { CommandHandler } from '@nestjs/cqrs'

import { OBJECT_STORAGE } from '~/domain/ports/object-storage.port'

export class GetUploadUrlCommand {
  constructor(public readonly path: string) {}
}

@CommandHandler(GetUploadUrlCommand)
export class GetUploadUrlHandler implements ICommandHandler<GetUploadUrlCommand, { url: string }> {
  constructor(@Inject(OBJECT_STORAGE) private readonly storageService: IObjectStorage) {}

  execute(command: GetUploadUrlCommand): Promise<{ url: string }> {
    return this.storageService.getUploadUrl(command.path)
  }
}
