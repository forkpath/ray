import type { CategoryRes, ListCategoriesRes } from '@libs/payload'

import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'

import { Session } from '@libs/srv-shared'

import { CreateCategoryCommand } from '#/application/commands/collection/create-category.command'
import { DeleteCategoryCommand } from '#/application/commands/collection/delete-category.command'
import { UpdateCategoryCommand } from '#/application/commands/collection/update-category.command'
import { CreateCategoryDto, UpdateCategoryDto } from '#/application/dtos/collection/collection.dto'
import { ListCategoriesQuery } from '#/application/queries/collection/list-categories.query'

interface AuthSession {
  user: { id: string }
  session: { activeOrganizationId: string | null }
}

@Controller('collections/categories')
export class CollectionCategoryController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus
  ) {}

  @Get()
  list(@Session() session: AuthSession): Promise<ListCategoriesRes> {
    return this.queryBus.execute(new ListCategoriesQuery(session.user.id, session.session.activeOrganizationId))
  }

  @Post()
  create(@Session() session: AuthSession, @Body() dto: CreateCategoryDto): Promise<CategoryRes> {
    return this.commandBus.execute(
      new CreateCategoryCommand(session.user.id, session.session.activeOrganizationId, dto)
    )
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Session() session: AuthSession,
    @Body() dto: UpdateCategoryDto
  ): Promise<CategoryRes> {
    return this.commandBus.execute(
      new UpdateCategoryCommand(session.user.id, session.session.activeOrganizationId, id, dto)
    )
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Session() session: AuthSession): Promise<void> {
    return this.commandBus.execute(new DeleteCategoryCommand(session.user.id, session.session.activeOrganizationId, id))
  }
}
