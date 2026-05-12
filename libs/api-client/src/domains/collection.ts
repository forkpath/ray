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

import { createKeys } from '../lib/queries/create-keys'
import {
  createMutationFactory,
  createMutationWithParamsFactory,
  createQueryOptionsFactory,
  createQueryOptionsWithParams
} from '../lib/queries/factory'

// ==================== Category Keys ====================

export const collectionCategoryKeys = {
  ...createKeys('collection-categories'),
  list: () => ['collection-categories', 'list'] as const
}

// ==================== Item Keys ====================

export const collectionItemKeys = {
  ...createKeys('collection-items'),
  list: (params?: Partial<ListCollectionItemsReq>) => ['collection-items', 'list', params] as const
}

// ==================== Category Queries ====================

export const collectionCategoryQueries = {
  list: createQueryOptionsFactory<ListCategoriesRes>(api => ({
    queryKey: collectionCategoryKeys.list(),
    queryFn: () => api.get('/collections/categories')
  }))
}

// ==================== Category Mutations ====================

export const collectionCategoryMutations = {
  create: createMutationFactory<CategoryRes, Error, CreateCategoryReq>((api, data) =>
    api.post('/collections/categories', data)
  ),

  update: createMutationWithParamsFactory<CategoryRes, Error, UpdateCategoryReq, { id: string }>((api, data, { id }) =>
    api.patch(`/collections/categories/${id}`, data)
  ),

  delete: createMutationFactory<void, Error, { id: string }>((api, { id }) =>
    api.delete(`/collections/categories/${id}`)
  )
}

// ==================== Item Queries ====================

export const collectionItemQueries = {
  list: createQueryOptionsWithParams<ListCollectionItemsRes, Error, ListCollectionItemsRes, ListCollectionItemsReq>(
    (api, params) => ({
      queryKey: collectionItemKeys.list(params),
      queryFn: () => api.get('/collections/items', { params })
    })
  )
}

// ==================== Item Mutations ====================

export const collectionItemMutations = {
  create: createMutationFactory<CollectionItemRes, Error, CreateCollectionItemReq>((api, data) =>
    api.post('/collections/items', data)
  ),

  update: createMutationWithParamsFactory<CollectionItemRes, Error, UpdateCollectionItemReq, { id: string }>(
    (api, data, { id }) => api.patch(`/collections/items/${id}`, data)
  ),

  delete: createMutationFactory<void, Error, { id: string }>((api, { id }) => api.delete(`/collections/items/${id}`))
}
