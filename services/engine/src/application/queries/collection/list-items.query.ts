import type { IQueryHandler } from '@nestjs/cqrs'
import type { ListCollectionItemsReq, ListCollectionItemsRes } from '@libs/payload'

import { QueryHandler } from '@nestjs/cqrs'

import { CollectionService } from '#/application/services/collection.service'

export class ListItemsQuery {
  constructor(
    public readonly userId: string,
    public readonly orgId: string | null,
    public readonly params: ListCollectionItemsReq
  ) {}
}

@QueryHandler(ListItemsQuery)
export class ListItemsHandler implements IQueryHandler<ListItemsQuery, ListCollectionItemsRes> {
  constructor(private readonly collectionService: CollectionService) {}

  execute(query: ListItemsQuery) {
    return this.collectionService.listItems(query.userId, query.orgId, query.params)
  }
}
