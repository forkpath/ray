import type { IQueryHandler } from '@nestjs/cqrs'
import type { IObjectStorage } from '~/domain/ports/object-storage.port'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { OBJECT_STORAGE } from '~/domain/ports/object-storage.port'

export class GetSignedUrlQuery {
  constructor(public readonly path: string) {}
}

@QueryHandler(GetSignedUrlQuery)
export class GetSignedUrlHandler implements IQueryHandler<GetSignedUrlQuery, { url: string }> {
  constructor(@Inject(OBJECT_STORAGE) private readonly storageService: IObjectStorage) {}

  execute(query: GetSignedUrlQuery): Promise<{ url: string }> {
    return this.storageService.getSignedUrl(query.path)
  }
}
