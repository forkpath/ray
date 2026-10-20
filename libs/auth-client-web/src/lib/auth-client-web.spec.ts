import { checkPermission, checkRolePermission, createClient, resolvePermissionCheckSuccess } from './auth-client-web'

const baseURL = 'http://localhost:3000'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('resolvePermissionCheckSuccess', () => {
  it('supports Better Auth response envelopes', () => {
    expect(resolvePermissionCheckSuccess({ data: { success: true } })).toBe(true)
    expect(resolvePermissionCheckSuccess({ success: false })).toBe(false)
    expect(resolvePermissionCheckSuccess(undefined)).toBe(false)
  })
})

describe('createClient', () => {
  it('registers every web auth plugin', () => {
    const client = createClient({ baseURL })

    expect(typeof client.signIn.passkey).toBe('function')
    expect(typeof client.signIn.anonymous).toBe('function')
    expect(typeof client.signIn.magicLink).toBe('function')
    expect(typeof client.twoFactor.enable).toBe('function')
    expect(typeof client.admin.listUsers).toBe('function')
    expect(typeof client.organization.checkRolePermission).toBe('function')
    expect(typeof client.getLastUsedLoginMethod).toBe('function')
  })
})

describe('checkPermission', () => {
  it('posts the permissions to the organization endpoint and reads the result', async () => {
    const requests: Request[] = []
    const client = createClient({
      baseURL,
      fetchOptions: {
        customFetchImpl: async (input, init) => {
          requests.push(new Request(input, init))
          return jsonResponse({ success: true, error: null })
        }
      }
    })

    await expect(checkPermission(client, { organization: ['update'] })).resolves.toBe(true)

    expect(requests).toHaveLength(1)
    expect(requests[0]?.method).toBe('POST')
    expect(new URL(requests[0]?.url ?? '').pathname).toBe('/api/auth/organization/has-permission')
    await expect(requests[0]?.json()).resolves.toMatchObject({ permissions: { organization: ['update'] } })
  })

  it('returns false when the server denies the permission', async () => {
    const client = createClient({
      baseURL,
      fetchOptions: { customFetchImpl: async () => jsonResponse({ success: false, error: null }) }
    })

    await expect(checkPermission(client, { organization: ['delete'] })).resolves.toBe(false)
  })

  it('returns false when the request fails', async () => {
    const client = createClient({
      baseURL,
      fetchOptions: {
        throw: true,
        customFetchImpl: async () => jsonResponse({ message: 'Unauthorized' }, 401)
      }
    })

    await expect(checkPermission(client, { organization: ['update'] })).resolves.toBe(false)
  })
})

describe('checkRolePermission', () => {
  it('checks permissions against the organization roles locally', () => {
    const client = createClient({ baseURL })

    expect(checkRolePermission(client, 'owner', { organization: ['delete'] })).toBe(true)
    expect(checkRolePermission(client, 'member', { organization: ['delete'] })).toBe(false)
  })
})
