import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'

import { GetDeleteUrlHandler } from '~/application/commands/storage/get-delete-url.command'
import { GetUploadUrlHandler } from '~/application/commands/storage/get-upload-url.command'
import { GetPublicUrlHandler } from '~/application/queries/storage/get-public-url.query'
import { GetSignedUrlHandler } from '~/application/queries/storage/get-signed-url.query'
import { OBJECT_STORAGE } from '~/domain/ports/object-storage.port'
import { S3ObjectStorage } from '~/infrastructure/storage/s3-object-storage'

import { StorageController } from './storage.controller'

@Module({
  imports: [CqrsModule],
  controllers: [StorageController],
  providers: [
    { provide: OBJECT_STORAGE, useClass: S3ObjectStorage },
    GetUploadUrlHandler,
    GetDeleteUrlHandler,
    GetPublicUrlHandler,
    GetSignedUrlHandler
  ]
})
export class StorageModule {}
