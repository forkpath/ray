import type {
  CategoryRes,
  CollectionItemRes,
  CreateCategoryReq,
  CreateCollectionItemReq,
  ListCategoriesRes,
  ListCollectionItemsReq,
  ListCollectionItemsRes,
  UpdateCategoryReq,
  UpdateCollectionItemReq
} from '@libs/payload'

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { EventBus } from '@nestjs/cqrs'

import { prisma } from '@libs/pg-dao'

import { RichTextCreatedEvent } from '../events/collection/rich-text-created.event'

const DEFAULT_CATEGORY_NAME = '未分类'

type WorkspaceFilter = { userId: string; orgId?: never } | { orgId: string; userId?: never }

function workspaceWhere(userId: string, orgId: string | null): WorkspaceFilter {
  return orgId ? { orgId } : { userId }
}

@Injectable()
export class CollectionService {
  constructor(private readonly eventBus: EventBus) {}

  // ==================== Categories ====================

  async listCategories(userId: string, orgId: string | null): Promise<ListCategoriesRes> {
    const where = workspaceWhere(userId, orgId)

    let categories = await prisma.collectionCategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { items: true } } }
    })

    if (categories.length === 0) {
      try {
        const defaultCategory = await prisma.collectionCategory.create({
          data: { name: DEFAULT_CATEGORY_NAME, isDefault: true, ...where },
          include: { _count: { select: { items: true } } }
        })
        categories = [defaultCategory]
      } catch {
        // Concurrent request already created the default category
        categories = await prisma.collectionCategory.findMany({
          where,
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: { _count: { select: { items: true } } }
        })
      }
    }

    return { list: categories.map(c => this.mapCategory(c)) }
  }

  async createCategory(userId: string, orgId: string | null, data: CreateCategoryReq): Promise<CategoryRes> {
    const category = await prisma.collectionCategory.create({
      data: { ...data, ...workspaceWhere(userId, orgId) },
      include: { _count: { select: { items: true } } }
    })
    return this.mapCategory(category)
  }

  async updateCategory(
    userId: string,
    orgId: string | null,
    id: string,
    data: UpdateCategoryReq
  ): Promise<CategoryRes> {
    const category = await prisma.collectionCategory.findFirst({
      where: { id, ...workspaceWhere(userId, orgId) }
    })
    if (!category) throw new NotFoundException('分类不存在')
    if (category.isDefault) throw new ForbiddenException('默认分类不可修改')

    const updated = await prisma.collectionCategory.update({
      where: { id },
      data,
      include: { _count: { select: { items: true } } }
    })
    return this.mapCategory(updated)
  }

  async deleteCategory(userId: string, orgId: string | null, id: string): Promise<void> {
    const category = await prisma.collectionCategory.findFirst({
      where: { id, ...workspaceWhere(userId, orgId) }
    })
    if (!category) throw new NotFoundException('分类不存在')
    if (category.isDefault) throw new ForbiddenException('默认分类不可删除')

    await prisma.collectionCategory.delete({ where: { id } })
  }

  // ==================== Items ====================

  async createItem(userId: string, orgId: string | null, data: CreateCollectionItemReq): Promise<CollectionItemRes> {
    const wsWhere = workspaceWhere(userId, orgId)
    const category = await prisma.collectionCategory.findFirst({
      where: { id: data.categoryId, ...wsWhere }
    })
    if (!category) throw new NotFoundException('分类不存在')

    const sourceHost = this.extractHost(data.sourceUrl)

    const item = await prisma.collectionItem.create({
      data: {
        type: data.type,
        ...wsWhere,
        categoryId: data.categoryId,
        sourceUrl: data.sourceUrl,
        sourceHost,
        title: data.title ?? null,
        ...(data.type === 'image' && {
          imageUrl: data.imageUrl,
          imageAlt: data.imageAlt ?? null,
          imageWidth: data.imageWidth ?? null,
          imageHeight: data.imageHeight ?? null
        }),
        ...(data.type === 'video' && {
          platform: data.platform,
          videoId: data.videoId ?? null,
          thumbnail: data.thumbnail ?? null,
          duration: data.duration ?? null,
          author: data.author ?? null,
          downloadStatus: data.downloadStatus ?? 'pending'
        }),
        ...(data.type === 'rich_text' && {
          rawContent: data.rawContent,
          aiStatus: 'pending'
        })
      }
    })

    if (data.type === 'rich_text') {
      this.eventBus.publish(new RichTextCreatedEvent(item.id, data.rawContent))
    }

    return this.mapItem(item)
  }

  async listItems(
    userId: string,
    orgId: string | null,
    params: ListCollectionItemsReq
  ): Promise<ListCollectionItemsRes> {
    const { page, perPage, type, categoryId } = params
    const where = {
      ...workspaceWhere(userId, orgId),
      ...(type && { type }),
      ...(categoryId && { categoryId })
    }

    const [items, total] = await Promise.all([
      prisma.collectionItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage
      }),
      prisma.collectionItem.count({ where })
    ])

    return { list: items.map(i => this.mapItem(i)), total }
  }

  async updateItem(
    userId: string,
    orgId: string | null,
    id: string,
    data: UpdateCollectionItemReq
  ): Promise<CollectionItemRes> {
    const wsWhere = workspaceWhere(userId, orgId)
    const item = await prisma.collectionItem.findFirst({ where: { id, ...wsWhere } })
    if (!item) throw new NotFoundException('采集项不存在')

    if (data.categoryId) {
      const category = await prisma.collectionCategory.findFirst({
        where: { id: data.categoryId, ...wsWhere }
      })
      if (!category) throw new NotFoundException('分类不存在')
    }

    const updated = await prisma.collectionItem.update({ where: { id }, data })
    return this.mapItem(updated)
  }

  async deleteItem(userId: string, orgId: string | null, id: string): Promise<void> {
    const wsWhere = workspaceWhere(userId, orgId)
    const item = await prisma.collectionItem.findFirst({ where: { id, ...wsWhere } })
    if (!item) throw new NotFoundException('采集项不存在')
    await prisma.collectionItem.delete({ where: { id } })
  }

  // ==================== Mappers ====================

  private mapCategory(c: {
    id: string
    name: string
    isDefault: boolean
    color: string | null
    sortOrder: number
    createdAt: Date
    _count: { items: number }
  }): CategoryRes {
    return {
      id: c.id,
      name: c.name,
      isDefault: c.isDefault,
      color: c.color,
      sortOrder: c.sortOrder,
      itemCount: c._count.items,
      createdAt: c.createdAt.toISOString()
    }
  }

  private mapItem(item: {
    id: string
    type: string
    categoryId: string
    sourceUrl: string
    sourceHost: string
    title: string | null
    notes: string | null
    imageUrl: string | null
    imageAlt: string | null
    imageWidth: number | null
    imageHeight: number | null
    platform: string | null
    videoId: string | null
    thumbnail: string | null
    duration: number | null
    author: string | null
    downloadStatus: string | null
    rawContent: string | null
    content: string | null
    aiStatus: string | null
    createdAt: Date
  }): CollectionItemRes {
    return {
      id: item.id,
      type: item.type as CollectionItemRes['type'],
      categoryId: item.categoryId,
      sourceUrl: item.sourceUrl,
      sourceHost: item.sourceHost,
      title: item.title,
      notes: item.notes,
      imageUrl: item.imageUrl,
      imageAlt: item.imageAlt,
      imageWidth: item.imageWidth,
      imageHeight: item.imageHeight,
      platform: item.platform as CollectionItemRes['platform'],
      videoId: item.videoId,
      thumbnail: item.thumbnail,
      duration: item.duration,
      author: item.author,
      downloadStatus: item.downloadStatus as CollectionItemRes['downloadStatus'],
      rawContent: item.rawContent,
      content: item.content,
      aiStatus: item.aiStatus as CollectionItemRes['aiStatus'],
      createdAt: item.createdAt.toISOString()
    }
  }

  private extractHost(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }
}
