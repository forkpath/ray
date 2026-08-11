import type { Page, Route } from '@playwright/test'

interface MockUser {
  id: string
  email: string
  name: string
  image: null
  emailVerified: boolean
  role: 'user'
  banned: boolean
  createdAt: string
  updatedAt: string
}

interface MockOrganization {
  id: string
  name: string
  slug: string
  logo: null
  createdAt: string
}

export interface RecordedRequest {
  method: string
  path: string
  body: unknown
}

export interface PlatformProviderMock {
  requests: RecordedRequest[]
  authenticate(): void
  unauthenticate(): void
  setOrganizationRole(role: 'member' | 'admin' | 'owner'): void
}

const NOW = '2026-08-11T00:00:00.000Z'

const user: MockUser = {
  id: 'user-e2e-1',
  email: 'owner@example.test',
  name: 'Owner Example',
  image: null,
  emailVerified: true,
  role: 'user',
  banned: false,
  createdAt: NOW,
  updatedAt: NOW
}

const json = async (route: Route, body: unknown, status = 200) => {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
  })
}

const parseBody = (route: Route): unknown => {
  const body = route.request().postData()
  if (!body) return null

  try {
    return JSON.parse(body) as unknown
  } catch {
    return body
  }
}

export async function installPlatformProviderMock(page: Page): Promise<PlatformProviderMock> {
  let authenticated = false
  let activeOrganizationId: string | null = null
  let organizationRole: 'member' | 'admin' | 'owner' = 'owner'
  const requests: RecordedRequest[] = []
  const organizations: MockOrganization[] = []

  await page.route('**/api/auth/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const body = parseBody(route)
    requests.push({ method: request.method(), path, body })

    if (path.endsWith('/get-session')) {
      await json(
        route,
        authenticated
          ? {
              session: {
                id: 'session-e2e-1',
                token: 'session-token-e2e-1',
                userId: user.id,
                activeOrganizationId,
                expiresAt: '2026-08-12T00:00:00.000Z',
                createdAt: NOW,
                updatedAt: NOW,
                ipAddress: '127.0.0.1',
                userAgent: 'playwright'
              },
              user
            }
          : null
      )
      return
    }

    if (path.endsWith('/sign-up/email')) {
      await json(route, { token: null, user })
      return
    }

    if (path.endsWith('/sign-in/email')) {
      authenticated = true
      await json(route, { redirect: false, token: 'session-token-e2e-1', user })
      return
    }

    if (path.endsWith('/sign-out')) {
      authenticated = false
      activeOrganizationId = null
      await json(route, { success: true })
      return
    }

    if (path.endsWith('/organization/list')) {
      await json(route, organizations)
      return
    }

    if (path.endsWith('/organization/get-active-member')) {
      await json(
        route,
        activeOrganizationId
          ? {
              id: 'member-e2e-1',
              organizationId: activeOrganizationId,
              userId: user.id,
              role: organizationRole,
              createdAt: NOW
            }
          : null
      )
      return
    }

    if (path.endsWith('/organization/get-full-organization')) {
      const activeOrganization = organizations.find(organization => organization.id === activeOrganizationId) ?? null
      await json(
        route,
        activeOrganization
          ? {
              ...activeOrganization,
              members: [],
              invitations: [],
              teams: []
            }
          : null
      )
      return
    }

    if (path.endsWith('/organization/create')) {
      const values = body as { name?: string; slug?: string }
      const organization: MockOrganization = {
        id: `org-e2e-${organizations.length + 1}`,
        name: values.name ?? 'Example Organization',
        slug: values.slug ?? 'example-organization',
        logo: null,
        createdAt: NOW
      }
      organizations.push(organization)
      activeOrganizationId = organization.id
      await json(route, organization)
      return
    }

    if (path.endsWith('/organization/set-active')) {
      const values = body as { organizationId?: string | null }
      activeOrganizationId = values.organizationId ?? null
      await json(route, activeOrganizationId ? { ...organizations[0], id: activeOrganizationId } : null)
      return
    }

    if (path.endsWith('/organization/invite-member')) {
      if (organizationRole === 'member') {
        await json(route, { code: 'FORBIDDEN', message: 'Missing organization billing permission' }, 403)
        return
      }
      await json(route, { id: 'invitation-e2e-1', status: 'pending' })
      return
    }

    if (path.endsWith('/organization/list-user-invitations')) {
      await json(route, [])
      return
    }

    await json(route, {})
  })

  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const body = parseBody(route)
    requests.push({ method: request.method(), path, body })

    if (request.method() === 'GET' && path === '/api/v1/billing/me') {
      await json(route, [])
      return
    }

    if (request.method() === 'POST' && path === '/api/v1/billing/checkout') {
      await json(route, { provider: 'stripe', url: null })
      return
    }

    if (request.method() === 'POST' && path === '/api/v1/billing/portal') {
      await json(route, { provider: 'stripe', url: '/user/billing' })
      return
    }

    if (path.match(/^\/api\/v1\/organizations\/[^/]+\/billing(?:\/checkout|\/portal)?$/)) {
      if (organizationRole === 'member' && request.method() !== 'GET') {
        await json(route, { code: 'FORBIDDEN', message: 'Owner or admin required' }, 403)
        return
      }

      if (request.method() === 'GET') {
        await json(route, [])
        return
      }

      await json(route, { provider: 'stripe', url: null })
      return
    }

    await json(route, { code: 0, msg: 'ok', data: [] })
  })

  return {
    requests,
    authenticate() {
      authenticated = true
    },
    unauthenticate() {
      authenticated = false
      activeOrganizationId = null
    },
    setOrganizationRole(role) {
      organizationRole = role
    }
  }
}
