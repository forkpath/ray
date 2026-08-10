import type { User } from '@libs/auth-web'

import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { authClient } from '../../../lib/auth/client'

const KEY = 'admin'

const queries = {
  users: {
    get: ({ id }: { id: string }) =>
      queryOptions({
        queryKey: [KEY, 'users', id],
        queryFn: () =>
          authClient.admin.getUser({
            query: { id },
            fetchOptions: { throw: true }
          }) as Promise<User>
      }),
    getSessions: ({ id }: { id: string }) =>
      queryOptions({
        queryKey: [KEY, 'users', id, 'sessions'],
        queryFn: () =>
          authClient.admin.listUserSessions({
            userId: id,
            fetchOptions: { throw: true }
          })
      })
  }
}

const mutations = {
  users: {
    ban: mutationOptions({
      mutationKey: [KEY, 'users', 'ban'],
      mutationFn: (params: Parameters<typeof authClient.admin.banUser>[0]) => authClient.admin.banUser(params)
    }),
    unban: mutationOptions({
      mutationKey: [KEY, 'users', 'unban'],
      mutationFn: (params: Parameters<typeof authClient.admin.unbanUser>[0]) => authClient.admin.unbanUser(params)
    }),
    delete: mutationOptions({
      mutationKey: [KEY, 'users', 'delete'],
      mutationFn: (params: Parameters<typeof authClient.admin.removeUser>[0]) => authClient.admin.removeUser(params)
    }),
    impersonate: mutationOptions({
      mutationKey: [KEY, 'users', 'impersonate'],
      mutationFn: (params: Parameters<typeof authClient.admin.impersonateUser>[0]) =>
        authClient.admin.impersonateUser(params)
    }),
    stopImpersonating: mutationOptions({
      mutationKey: [KEY, 'users', 'impersonate', 'stop'],
      mutationFn: () => authClient.admin.stopImpersonating()
    }),
    update: mutationOptions({
      mutationKey: [KEY, 'users', 'update'],
      mutationFn: (params: Parameters<typeof authClient.admin.updateUser>[0]) => authClient.admin.updateUser(params)
    }),
    setPassword: mutationOptions({
      mutationKey: [KEY, 'users', 'setPassword'],
      mutationFn: (params: Parameters<typeof authClient.admin.setUserPassword>[0]) =>
        authClient.admin.setUserPassword(params)
    }),
    sessions: {
      revoke: mutationOptions({
        mutationKey: [KEY, 'users', 'sessions', 'revoke'],
        mutationFn: (params: Parameters<typeof authClient.admin.revokeUserSession>[0]) =>
          authClient.admin.revokeUserSession(params)
      }),
      revokeAll: mutationOptions({
        mutationKey: [KEY, 'users', 'sessions', 'revokeAll'],
        mutationFn: (params: Parameters<typeof authClient.admin.revokeUserSessions>[0]) =>
          authClient.admin.revokeUserSessions(params)
      })
    }
  }
}

export const admin = {
  queries,
  mutations
} as const
