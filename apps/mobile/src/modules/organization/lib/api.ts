import { infiniteQueryOptions, mutationOptions, queryOptions } from '@tanstack/react-query'

import * as Linking from 'expo-linking'

import { orgKeys, orgMutations, orgQueries, orgRequests } from '@libs/api-client'

import { pathsConfig } from '~/config/paths'
import { api } from '~/lib/api'
import { authClient } from '~/lib/auth'

const KEY = 'organizations'

const queries = {
  get: (params: { slug: string } | { id: string }) =>
    queryOptions({
      queryKey: [KEY, params],
      queryFn: () =>
        authClient.organization.getFullOrganization({
          query: 'id' in params ? { organizationId: params.id } : { organizationSlug: params.slug },
          fetchOptions: { throw: true }
        })
    }),
  members: {
    getIsOnlyOwner: ({ id }: { id: string }) => orgQueries.isOnlyOwner(api, { id }),
    getAll: ({ id, ...query }: { id: string; page?: string; perPage?: string; q?: string; role?: string[] }) =>
      infiniteQueryOptions({
        queryKey: orgKeys.members(id, query),
        queryFn: ({ pageParam }) => orgRequests.members(api, { id, ...query, page: pageParam.toString() }),
        initialPageParam: 1,
        getNextPageParam: ({ total }, pages) =>
          total > pages.length * Number(query.perPage ?? 10) ? pages.length + 1 : undefined
      })
  },
  invitations: {
    get: ({ id }: { id: string }) =>
      queryOptions({
        queryKey: [...orgKeys.detail(id), 'invitations-single'],
        queryFn: () =>
          authClient.organization.getInvitation({
            query: { id },
            fetchOptions: { throw: true }
          })
      }),
    getAll: ({ id, ...query }: { id: string; page?: string; perPage?: string; q?: string; status?: string[] }) =>
      infiniteQueryOptions({
        queryKey: orgKeys.invitations(id, query),
        queryFn: ({ pageParam }) => orgRequests.invitations(api, { id, ...query, page: pageParam.toString() }),
        initialPageParam: 1,
        getNextPageParam: ({ total }, pages) =>
          total > pages.length * Number(query.perPage ?? 10) ? pages.length + 1 : undefined
      })
  }
}

const mutations = {
  getSlug: {
    ...orgMutations.getSlug.options(api),
    mutationKey: [KEY, 'slug']
  },
  setActive: mutationOptions({
    mutationKey: [KEY, 'active'],
    mutationFn: (params: Parameters<typeof authClient.organization.setActive>[0]) =>
      authClient.organization.setActive(params)
  }),
  delete: mutationOptions({
    mutationKey: [KEY, 'delete'],
    mutationFn: (params: Parameters<typeof authClient.organization.delete>[0]) => authClient.organization.delete(params)
  }),
  leave: mutationOptions({
    mutationKey: [KEY, 'members', 'leave'],
    mutationFn: (params: Parameters<typeof authClient.organization.leave>[0]) => authClient.organization.leave(params)
  }),
  create: mutationOptions({
    mutationKey: [KEY, 'create'],
    mutationFn: (params: Parameters<typeof authClient.organization.create>[0]) =>
      authClient.organization.create({ ...params, fetchOptions: { throw: true } })
  }),
  update: mutationOptions({
    mutationKey: [KEY, 'update'],
    mutationFn: (params: Parameters<typeof authClient.organization.update>[0]) => authClient.organization.update(params)
  }),
  invitations: {
    accept: mutationOptions({
      mutationKey: [KEY, 'invitations', 'accept'],
      mutationFn: (params: Parameters<typeof authClient.organization.acceptInvitation>[0]) =>
        authClient.organization.acceptInvitation(params)
    }),
    reject: mutationOptions({
      mutationKey: [KEY, 'invitations', 'reject'],
      mutationFn: (params: Parameters<typeof authClient.organization.rejectInvitation>[0]) =>
        authClient.organization.rejectInvitation(params)
    }),
    cancel: mutationOptions({
      mutationKey: [KEY, 'invitations', 'cancel'],
      mutationFn: (params: Parameters<typeof authClient.organization.cancelInvitation>[0]) =>
        authClient.organization.cancelInvitation(params)
    }),
    resend: mutationOptions({
      mutationKey: [KEY, 'invitations', 'resend'],
      mutationFn: (params: Parameters<typeof authClient.organization.inviteMember>[0]) =>
        authClient.organization.inviteMember(
          { ...params, resend: true },
          { headers: { 'x-url': Linking.createURL(pathsConfig.setup.auth.join) } }
        )
    })
  },
  members: {
    remove: mutationOptions({
      mutationKey: [KEY, 'members', 'remove'],
      mutationFn: (params: Parameters<typeof authClient.organization.removeMember>[0]) =>
        authClient.organization.removeMember(params)
    }),
    invite: mutationOptions({
      mutationKey: [KEY, 'members', 'invite'],
      mutationFn: (params: Parameters<typeof authClient.organization.inviteMember>[0]) =>
        authClient.organization.inviteMember(params, {
          headers: { 'x-url': Linking.createURL(pathsConfig.setup.auth.join) }
        })
    }),
    updateRole: mutationOptions({
      mutationKey: [KEY, 'members', 'update-role'],
      mutationFn: (params: Parameters<typeof authClient.organization.updateMemberRole>[0]) =>
        authClient.organization.updateMemberRole(params)
    })
  }
}

export const organization = {
  queries,
  mutations
} as const
