import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'

import { CreateCategoryHandler } from '#/application/commands/collection/create-category.command'
import { CreateItemHandler } from '#/application/commands/collection/create-item.command'
import { DeleteCategoryHandler } from '#/application/commands/collection/delete-category.command'
import { DeleteItemHandler } from '#/application/commands/collection/delete-item.command'
import { UpdateCategoryHandler } from '#/application/commands/collection/update-category.command'
import { UpdateItemHandler } from '#/application/commands/collection/update-item.command'
import { RichTextProcessingHandler } from '#/application/events/collection/rich-text-processing.handler'
import { ListCategoriesHandler } from '#/application/queries/collection/list-categories.query'
import { ListItemsHandler } from '#/application/queries/collection/list-items.query'
import { CollectionService } from '#/application/services/collection.service'

import { CollectionCategoryController } from './collection-category.controller'
import { CollectionItemController } from './collection-item.controller'

const CommandHandlers = [
  CreateCategoryHandler,
  UpdateCategoryHandler,
  DeleteCategoryHandler,
  CreateItemHandler,
  UpdateItemHandler,
  DeleteItemHandler
]

const QueryHandlers = [ListCategoriesHandler, ListItemsHandler]

const EventHandlers = [RichTextProcessingHandler]

@Module({
  imports: [CqrsModule],
  controllers: [CollectionCategoryController, CollectionItemController],
  providers: [CollectionService, ...CommandHandlers, ...QueryHandlers, ...EventHandlers]
})
export class CollectionModule {}
