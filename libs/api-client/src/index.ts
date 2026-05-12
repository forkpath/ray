// Client
export { createClient, detectRuntime } from './lib/client'
export type { ApiClient } from './lib/client'

// Context & Hooks
export { ApiClientProvider, useApiClient, useApiClientContext, useApiRuntime } from './lib/context'

// Query Client
export { createQueryClient, getErrorMessage, getQueryClient } from './lib/query-client'

// Query & Mutation utilities
export {
  // Factory functions - Query
  createQueryOptionsFactory,
  createQueryOptionsWithParams,
  // Factory functions - Mutation
  createMutationFactory,
  createMutationWithParamsFactory,
  // Factory functions - Keys
  createKeys
} from './lib/queries'
export type { KeyFactory, MutationOptionsWithoutFn } from './lib/queries'

// Wrapped hooks
export { useMutationWithClient } from './lib/hooks/use-mutation-with-client'
export { useQueryWithClient } from './lib/hooks/use-query-with-client'
export type { QueryFunctionContextWithClient } from './lib/hooks/use-query-with-client'

// Types
export type { ApiClientContextValue, ApiClientOptions, ApiRuntime, AuthOptions } from './lib/types'
export type { ApiClientProviderProps } from './lib/context'
export type { MutationErrorContext, QueryClientOptions, QueryErrorContext } from './lib/query-client'

// Domains
export {
  authKeys,
  authMutations,
  billingKeys,
  billingMutations,
  billingQueries,
  orgMutations,
  orgQueries,
  orgRequests,
  orgKeys,
  storageKeys,
  storageMutations,
  userKeys,
  collectionCategoryKeys,
  collectionCategoryQueries,
  collectionCategoryMutations,
  collectionItemKeys,
  collectionItemQueries,
  collectionItemMutations
} from './domains'

// Utils (Hono compatibility)
export { handle } from './utils'

// Admin Domains
export {
  adminUserKeys,
  adminUserQueries,
  adminUserMutations,
  adminOrgKeys,
  adminOrgQueries,
  adminOrgMutations,
  adminCustomerKeys,
  adminCustomerQueries
} from './domains/admin'
