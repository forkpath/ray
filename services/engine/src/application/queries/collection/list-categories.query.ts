import type { IQueryHandler } from '@nestjs/cqrs'
import type { ListCategoriesRes } from '@libs/payload'

import { QueryHandler } from '@nestjs/cqrs'

import { CollectionService } from '#/application/services/collection.service'

export class ListCategoriesQuery {
  constructor(
    public readonly userId: string,
    public readonly orgId: string | null
  ) {}
}

@QueryHandler(ListCategoriesQuery)
export class ListCategoriesHandler implements IQueryHandler<ListCategoriesQuery, ListCategoriesRes> {
  constructor(private readonly collectionService: CollectionService) {}

  execute(query: ListCategoriesQuery) {
    return this.collectionService.listCategories(query.userId, query.orgId)
  }
}
