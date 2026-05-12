import { createZodDto } from 'nestjs-zod'

import {
  createCategoryReqSchema,
  createCollectionItemReqSchema,
  listCollectionItemsReqSchema,
  updateCategoryReqSchema,
  updateCollectionItemReqSchema
} from '@libs/payload'

export class CreateCategoryDto extends createZodDto(createCategoryReqSchema) {}
export class UpdateCategoryDto extends createZodDto(updateCategoryReqSchema) {}
export class CreateCollectionItemDto extends createZodDto(createCollectionItemReqSchema) {}
export class UpdateCollectionItemDto extends createZodDto(updateCollectionItemReqSchema) {}
export class ListCollectionItemsQueryDto extends createZodDto(listCollectionItemsReqSchema) {}
