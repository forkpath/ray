import { createZodDto } from 'nestjs-zod'

import {
  createCategoryReqSchema,
  listCollectionItemsReqSchema,
  updateCategoryReqSchema,
  updateCollectionItemReqSchema
} from '@libs/payload'

export class CreateCategoryDto extends createZodDto(createCategoryReqSchema) {}
export class UpdateCategoryDto extends createZodDto(updateCategoryReqSchema) {}
// createCollectionItemReqSchema is a discriminated union — createZodDto can't extend union types.
// Validation is applied via ZodValidationPipe directly on the @Body() parameter in the controller.
export class UpdateCollectionItemDto extends createZodDto(updateCollectionItemReqSchema) {}
export class ListCollectionItemsQueryDto extends createZodDto(listCollectionItemsReqSchema) {}
