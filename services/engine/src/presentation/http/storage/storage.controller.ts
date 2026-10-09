import { BadRequestException, Controller, Get, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'

import { GetDeleteUrlCommand } from '~/application/commands/storage/get-delete-url.command'
import { GetUploadUrlCommand } from '~/application/commands/storage/get-upload-url.command'
import { StoragePathQueryDto } from '~/application/dtos/storage/storage.dto'
import { GetPublicUrlQuery } from '~/application/queries/storage/get-public-url.query'
import { GetSignedUrlQuery } from '~/application/queries/storage/get-signed-url.query'

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp'])

function validateImagePath(path: string): void {
  if (!path || typeof path !== 'string') {
    throw new BadRequestException('Missing required parameter: path')
  }

  const ext = path.split('.').pop()?.toLowerCase()
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    throw new BadRequestException(`Unsupported file type. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`)
  }
}

@Controller('storage')
export class StorageController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @Get('upload-url')
  async getUploadUrl(@Query() query: StoragePathQueryDto) {
    const { path } = query
    validateImagePath(path)
    return this.commandBus.execute(new GetUploadUrlCommand(path))
  }

  @Get('public-url')
  getPublicUrl(@Query() query: StoragePathQueryDto) {
    const { path } = query
    return this.queryBus.execute(new GetPublicUrlQuery(path))
  }

  @Get('delete-url')
  async getDeleteUrl(@Query() query: StoragePathQueryDto) {
    const { path } = query
    validateImagePath(path)
    return this.commandBus.execute(new GetDeleteUrlCommand(path))
  }

  @Get('signed-url')
  async getSignedUrl_(@Query() query: StoragePathQueryDto) {
    const { path } = query
    validateImagePath(path)
    return this.queryBus.execute(new GetSignedUrlQuery(path))
  }
}
