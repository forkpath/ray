import type { CollectionItemRes, ListCollectionItemsRes } from '@libs/payload'

import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'

import { Session } from '@libs/srv-shared'

import { CreateItemCommand } from '#/application/commands/collection/create-item.command'
import { DeleteItemCommand } from '#/application/commands/collection/delete-item.command'
import { UpdateItemCommand } from '#/application/commands/collection/update-item.command'
import {
  CreateCollectionItemDto,
  ListCollectionItemsQueryDto,
  UpdateCollectionItemDto
} from '#/application/dtos/collection/collection.dto'
import { ListItemsQuery } from '#/application/queries/collection/list-items.query'

interface AuthSession {
  user: { id: string }
  session: { activeOrganizationId: string | null }
}

@Controller('collections/items')
export class CollectionItemController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus
  ) {}

  @Get()
  list(@Session() session: AuthSession, @Query() query: ListCollectionItemsQueryDto): Promise<ListCollectionItemsRes> {
    return this.queryBus.execute(new ListItemsQuery(session.user.id, session.session.activeOrganizationId, query))
  }

  @Post()
  create(@Session() session: AuthSession, @Body() dto: CreateCollectionItemDto): Promise<CollectionItemRes> {
    return this.commandBus.execute(new CreateItemCommand(session.user.id, session.session.activeOrganizationId, dto))
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Session() session: AuthSession,
    @Body() dto: UpdateCollectionItemDto
  ): Promise<CollectionItemRes> {
    return this.commandBus.execute(
      new UpdateItemCommand(session.user.id, session.session.activeOrganizationId, id, dto)
    )
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Session() session: AuthSession): Promise<void> {
    return this.commandBus.execute(new DeleteItemCommand(session.user.id, session.session.activeOrganizationId, id))
  }
}
