import { checkPermission, checkRolePermission, createClient } from './auth-client-native'
import { resolvePermissionCheckSuccess } from './permission-result'

// The real Expo plugin needs the React Native runtime; this spec covers the
// client wiring, while typecheck covers the plugin composition.
vi.mock('@better-auth/expo/client', () => ({
  expoClient: () => ({
    id: 'expo',
    getActions: () => ({ getCookie: async () => '' })
  })
}))

const baseURL = 'http://localhost:3000'

function createMemoryStorage() {
  const values = new Map<string, string>()

  return {
    getItem: (key: string) => values.get(key) ?? null,
    getItemAsync: async (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    setItemAsync: async (key: string, value: string) => {
      values.set(key, value)
    },
    deleteItemAsync: async (key: string) => {
      values.delete(key)
    }
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function createTestClient(customFetchImpl?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>) {
  return createClient({
    baseURL,
    fetchOptions: customFetchImpl ? { customFetchImpl } : undefined,
    mobile: { scheme: 'ray', storage: createMemoryStorage() },
    lastLoginMethod: { storage: createMemoryStorage() }
  })
}

describe('resolvePermissionCheckSuccess', () => {
  it('supports Better Auth response envelopes', () => {
    expect(resolvePermissionCheckSuccess({ data: { success: true } })).toBe(true)
    expect(resolvePermissionCheckSuccess({ success: false })).toBe(false)
    expect(resolvePermissionCheckSuccess(undefined)).toBe(false)
  })
})

describe('createClient', () => {
  it('registers every native auth plugin', () => {
    const client = createTestClient()

    expect(typeof client.signIn.anonymous).toBe('function')
    expect(typeof client.signIn.magicLink).toBe('function')
    expect(typeof client.emailOtp.sendVerificationOtp).toBe('function')
    expect(typeof client.twoFactor.enable).toBe('function')
    expect(typeof client.admin.listUsers).toBe('function')
    expect(typeof client.organization.checkRolePermission).toBe('function')
    expect(typeof client.getLastUsedLoginMethod).toBe('function')
    expect(typeof client.getCookie).toBe('function')
  })
})

describe('checkPermission', () => {
  it('posts the permissions to the organization endpoint and reads the result', async () => {
    const requests: Request[] = []
    const client = createTestClient(async (input, init) => {
      requests.push(new Request(input, init))
      return jsonResponse({ success: true, error: null })
    })

    await expect(checkPermission(client, { organization: ['update'] })).resolves.toBe(true)

    expect(requests).toHaveLength(1)
    expect(requests[0]?.method).toBe('POST')
    expect(new URL(requests[0]?.url ?? '').pathname).toBe('/api/auth/organization/has-permission')
    await expect(requests[0]?.json()).resolves.toMatchObject({ permissions: { organization: ['update'] } })
  })

  it('returns false when the request fails', async () => {
    const client = createTestClient(async () => {
      throw new TypeError('Network request failed')
    })

    await expect(checkPermission(client, { organization: ['update'] })).resolves.toBe(false)
  })
})

describe('checkRolePermission', () => {
  it('checks permissions against the organization roles locally', () => {
    const client = createTestClient()

    expect(checkRolePermission(client, 'owner', { organization: ['delete'] })).toBe(true)
    expect(checkRolePermission(client, 'member', { organization: ['delete'] })).toBe(false)
  })
})
