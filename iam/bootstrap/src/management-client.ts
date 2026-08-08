/**
 * Logto Management API 客户端（client_credentials + 纯 REST）。
 *
 * 不依赖 @logto/api SDK，避免自托管参数不确定性；token 缓存到过期前刷新。
 */
export interface ManagementClientConfig {
  endpoint: string
  m2mId: string
  m2mSecret: string
  fetchFn?: typeof fetch
}

export function buildTokenRequest(config: ManagementClientConfig): { url: string; init: RequestInit } {
  if (!config.endpoint) throw new Error('Logto endpoint is required')
  if (!config.m2mId || !config.m2mSecret) throw new Error('M2M credentials are required')
  const basic = Buffer.from(`${config.m2mId}:${config.m2mSecret}`).toString('base64')
  return {
    url: `${config.endpoint}/oidc/token`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        resource: `${config.endpoint}/api`,
        scope: 'all'
      }).toString()
    }
  }
}

export class ManagementClient {
  private readonly fetchFn: typeof fetch
  private token: { value: string; expiresAt: number } | null = null

  constructor(private readonly config: ManagementClientConfig) {
    this.fetchFn = config.fetchFn ?? fetch
  }

  async getToken(): Promise<string> {
    const now = Date.now()
    if (this.token && this.token.expiresAt > now + 30_000) return this.token.value
    const { url, init } = buildTokenRequest(this.config)
    const res = await this.fetchFn(url, init)
    if (!res.ok) throw new Error(`token request failed: ${res.status}`)
    const data = (await res.json()) as { access_token: string; expires_in: number }
    this.token = { value: data.access_token, expiresAt: now + data.expires_in * 1000 }
    return data.access_token
  }

  async api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const token = await this.getToken()
    const res = await this.fetchFn(`${this.config.endpoint}/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`)
    return (await res.json().catch(() => ({}))) as T
  }
}
