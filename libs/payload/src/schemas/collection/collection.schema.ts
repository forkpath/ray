import { z } from 'zod'

import { AiProcessingStatus, CollectionItemType, VideoDownloadStatus, VideoPlatform } from '@libs/common'

// ==================== Category ====================

export const createCategoryReqSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().optional()
})

export type CreateCategoryReq = z.infer<typeof createCategoryReqSchema>

export const updateCategoryReqSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().optional(),
  sortOrder: z.number().int().optional()
})

export type UpdateCategoryReq = z.infer<typeof updateCategoryReqSchema>

export const categoryResSchema = z.object({
  id: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  color: z.string().nullable(),
  sortOrder: z.number(),
  itemCount: z.number(),
  createdAt: z.string()
})

export type CategoryRes = z.infer<typeof categoryResSchema>

export const listCategoriesResSchema = z.object({
  list: z.array(categoryResSchema)
})

export type ListCategoriesRes = z.infer<typeof listCategoriesResSchema>

// ==================== Collection Items ====================

const baseItemFields = z.object({
  categoryId: z.string(),
  sourceUrl: z.string().url(),
  title: z.string().optional()
})

export const saveImageItemReqSchema = baseItemFields.extend({
  type: z.literal(CollectionItemType.IMAGE),
  imageUrl: z.string().url(),
  imageAlt: z.string().optional(),
  imageWidth: z.number().int().optional(),
  imageHeight: z.number().int().optional()
})

export type SaveImageItemReq = z.infer<typeof saveImageItemReqSchema>

export const saveVideoItemReqSchema = baseItemFields.extend({
  type: z.literal(CollectionItemType.VIDEO),
  platform: z.enum([
    VideoPlatform.YOUTUBE,
    VideoPlatform.X,
    VideoPlatform.XIAOHONGSHU,
    VideoPlatform.BILIBILI,
    VideoPlatform.WEIBO,
    VideoPlatform.WECHAT_MP,
    VideoPlatform.TIKTOK,
    VideoPlatform.DOUYIN,
    VideoPlatform.KUAISHOU
  ]),
  videoId: z.string().optional(),
  thumbnail: z.string().url().optional(),
  duration: z.number().int().optional(),
  author: z.string().optional(),
  downloadStatus: z
    .enum([
      VideoDownloadStatus.PENDING,
      VideoDownloadStatus.DOWNLOADING,
      VideoDownloadStatus.COMPLETED,
      VideoDownloadStatus.FAILED,
      VideoDownloadStatus.UNAVAILABLE
    ])
    .optional()
})

export type SaveVideoItemReq = z.infer<typeof saveVideoItemReqSchema>

export const saveRichTextItemReqSchema = baseItemFields.extend({
  type: z.literal(CollectionItemType.RICH_TEXT),
  rawContent: z.string().min(1)
})

export type SaveRichTextItemReq = z.infer<typeof saveRichTextItemReqSchema>

export const createCollectionItemReqSchema = z.discriminatedUnion('type', [
  saveImageItemReqSchema,
  saveVideoItemReqSchema,
  saveRichTextItemReqSchema
])

export type CreateCollectionItemReq = z.infer<typeof createCollectionItemReqSchema>

export const updateCollectionItemReqSchema = z.object({
  categoryId: z.string().optional(),
  notes: z.string().optional(),
  downloadStatus: z
    .enum([
      VideoDownloadStatus.PENDING,
      VideoDownloadStatus.DOWNLOADING,
      VideoDownloadStatus.COMPLETED,
      VideoDownloadStatus.FAILED,
      VideoDownloadStatus.UNAVAILABLE
    ])
    .optional()
})

export type UpdateCollectionItemReq = z.infer<typeof updateCollectionItemReqSchema>

export const listCollectionItemsReqSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum([CollectionItemType.IMAGE, CollectionItemType.VIDEO, CollectionItemType.RICH_TEXT]).optional(),
  categoryId: z.string().optional()
})

export type ListCollectionItemsReq = z.infer<typeof listCollectionItemsReqSchema>

export const collectionItemResSchema = z.object({
  id: z.string(),
  type: z.enum([CollectionItemType.IMAGE, CollectionItemType.VIDEO, CollectionItemType.RICH_TEXT]),
  categoryId: z.string(),
  sourceUrl: z.string(),
  sourceHost: z.string(),
  title: z.string().nullable(),
  notes: z.string().nullable(),
  imageUrl: z.string().nullable(),
  imageAlt: z.string().nullable(),
  imageWidth: z.number().nullable(),
  imageHeight: z.number().nullable(),
  platform: z
    .enum([
      VideoPlatform.YOUTUBE,
      VideoPlatform.X,
      VideoPlatform.XIAOHONGSHU,
      VideoPlatform.BILIBILI,
      VideoPlatform.WEIBO,
      VideoPlatform.WECHAT_MP,
      VideoPlatform.TIKTOK,
      VideoPlatform.DOUYIN,
      VideoPlatform.KUAISHOU
    ])
    .nullable(),
  videoId: z.string().nullable(),
  thumbnail: z.string().nullable(),
  duration: z.number().nullable(),
  author: z.string().nullable(),
  downloadStatus: z
    .enum([
      VideoDownloadStatus.PENDING,
      VideoDownloadStatus.DOWNLOADING,
      VideoDownloadStatus.COMPLETED,
      VideoDownloadStatus.FAILED,
      VideoDownloadStatus.UNAVAILABLE
    ])
    .nullable(),
  rawContent: z.string().nullable(),
  content: z.string().nullable(),
  aiStatus: z
    .enum([
      AiProcessingStatus.PENDING,
      AiProcessingStatus.PROCESSING,
      AiProcessingStatus.COMPLETED,
      AiProcessingStatus.FAILED
    ])
    .nullable(),
  createdAt: z.string()
})

export type CollectionItemRes = z.infer<typeof collectionItemResSchema>

export const listCollectionItemsResSchema = z.object({
  list: z.array(collectionItemResSchema),
  total: z.number()
})

export type ListCollectionItemsRes = z.infer<typeof listCollectionItemsResSchema>
