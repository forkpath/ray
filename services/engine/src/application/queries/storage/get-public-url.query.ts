import type { IQueryHandler } from '@nestjs/cqrs'
import type { IObjectStorage } from '~/domain/ports/object-storage.port'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { OBJECT_STORAGE } from '~/domain/ports/object-storage.port'

export class GetPublicUrlQuery {
  constructor(public readonly path: string) {}
}

@QueryHandler(GetPublicUrlQuery)
export class GetPublicUrlHandler implements IQueryHandler<GetPublicUrlQuery, { url: string }> {
  constructor(@Inject(OBJECT_STORAGE) private readonly storageService: IObjectStorage) {}

  execute(query: GetPublicUrlQuery): Promise<{ url: string }> {
    return Promise.resolve(this.storageService.getPublicUrl(query.path))
  }
}
