import { createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Route as AppRoute } from '~/routes/_app'
import { Route as AdminRoute } from '~/routes/_app/admin'
import { Route as AuthRoute } from '~/routes/auth'

const auth = vi.hoisted(() => ({ getSession: vi.fn(), list: vi.fn(), getActiveMember: vi.fn() }))

// The network boundary is fake. The actual file-route guards, permission helper,
// redirects and TanStack navigation lifecycle run unchanged.
vi.mock('@libs/studio', () => ({
  authClient: { getSession: auth.getSession, organization: auth },
  pathsConfig: { auth: { login: '/auth/login' }, user: { profile: '/user/profile' } }
}))
vi.mock('@libs/i18n', () => ({ useTranslation: vi.fn() }))
vi.mock('@libs/ui-web', () => ({ Icons: {} }))
vi.mock('@libs/api-client', () => ({ ApiClientProvider: vi.fn() }))

function testRouter(path: string) {
  const root = createRootRoute()
  const appGuard = AppRoute.options.beforeLoad
  const adminGuard = AdminRoute.options.beforeLoad
  const authGuard = AuthRoute.options.beforeLoad
  if (!appGuard || !adminGuard || !authGuard) throw new Error('Production routes must install their guards')

  const app = createRoute({
    getParentRoute: () => root,
    id: '_app',
    // File-route types refer to the generated full tree. This small test tree
    // supplies the same guard inputs without loading unrelated page components.
    beforeLoad: context => appGuard(context as unknown as NonNullable<Parameters<typeof appGuard>[0]>)
  })
  const admin = createRoute({
    getParentRoute: () => app,
    path: 'admin',
    beforeLoad: context => adminGuard(context as unknown as NonNullable<Parameters<typeof adminGuard>[0]>)
  })
  const profile = createRoute({ getParentRoute: () => app, path: 'user/profile' })
  const authentication = createRoute({
    getParentRoute: () => root,
    path: 'auth',
    beforeLoad: context => authGuard(context as unknown as NonNullable<Parameters<typeof authGuard>[0]>)
  })
  const login = createRoute({ getParentRoute: () => authentication, path: 'login' })
  return createRouter({
    routeTree: root.addChildren([app.addChildren([admin, profile]), authentication.addChildren([login])]),
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPendingMinMs: 0
  })
}

describe('production route access rules', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    auth.getSession.mockResolvedValue({ session: { id: 'session' }, user: { id: 'user', role: 'user' } })
    auth.list.mockResolvedValue([{ id: 'organization', name: 'Team', slug: 'team' }])
    auth.getActiveMember.mockResolvedValue({ id: 'member', role: 'owner' })
  })

  it('redirects an anonymous protected-route visit to login before requesting organizations', async () => {
    auth.getSession.mockResolvedValue(null)
    const router = testRouter('/admin')
    await router.load()
    expect(router.state.location.pathname).toBe('/auth/login')
    expect(auth.list).not.toHaveBeenCalled()
  })

  it('does not confuse organization ownership with platform admin permission', async () => {
    const router = testRouter('/admin')
    await router.load()
    expect(router.state.location.pathname).toBe('/user/profile')
    expect(router.state.matches.every(match => match.status === 'success')).toBe(true)
  })

  it('allows a platform admin and provides organization context before entering the route', async () => {
    auth.getSession.mockResolvedValue({ session: { id: 'session' }, user: { id: 'admin', role: 'user,admin' } })
    const router = testRouter('/admin')
    await router.load()
    expect(router.state.location.pathname).toBe('/admin')
    expect(router.state.matches[router.state.matches.length - 1]?.context).toMatchObject({
      user: { id: 'admin' },
      organizations: [{ id: 'organization' }],
      activeMember: { role: 'owner' }
    })
    expect(router.state.matches.every(match => match.status === 'success')).toBe(true)
  })

  it('leaves personal pages available when there is no active organization member', async () => {
    auth.list.mockResolvedValue(null)
    auth.getActiveMember.mockRejectedValue(new Error('No active organization'))
    const router = testRouter('/user/profile')
    await router.load()
    expect(router.state.matches[router.state.matches.length - 1]?.context).toMatchObject({
      organizations: [],
      activeMember: null
    })
    expect(router.state.matches.every(match => match.status === 'success')).toBe(true)
  })

  it('redirects an already signed-in user away from the login route', async () => {
    const router = testRouter('/auth/login')
    await router.load()
    expect(router.state.location.pathname).toBe('/user/profile')
  })

  it('keeps protected navigation in an error state when the session request fails', async () => {
    const failure = new Error('Session service unavailable')
    auth.getSession.mockRejectedValue(failure)
    const router = testRouter('/admin')
    await router.load()
    expect(router.state.matches.some(match => match.status === 'error' && match.error === failure)).toBe(true)
    expect(auth.list).not.toHaveBeenCalled()
  })
})
