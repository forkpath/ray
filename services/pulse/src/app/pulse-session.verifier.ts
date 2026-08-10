import type { IncomingHttpHeaders } from 'node:http'

import { fromNodeHeaders } from 'better-auth/node'

export interface PulseSession {
  readonly activeOrganizationId?: string
  readonly expiresAt: Date
  readonly userId: string
}

export abstract class PulseSessionVerifier {
  abstract isReady(): Promise<boolean>
  abstract verify(headers: IncomingHttpHeaders): Promise<PulseSession | null>
}

export interface BetterAuthSessionApi {
  getSession(input: { headers: Headers }): Promise<unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export class BetterAuthPulseSessionVerifier extends PulseSessionVerifier {
  constructor(private readonly api: BetterAuthSessionApi) {
    super()
  }

  async isReady(): Promise<boolean> {
    return typeof this.api.getSession === 'function'
  }

  async verify(headers: IncomingHttpHeaders): Promise<PulseSession | null> {
    const result = await this.api.getSession({ headers: fromNodeHeaders(headers) })
    if (!isRecord(result) || !isRecord(result['session']) || !isRecord(result['user'])) return null

    const userId = result['user']['id']
    const expiresAt = new Date(result['session']['expiresAt'] as string | Date)
    const activeOrganizationId = result['session']['activeOrganizationId']
    if (typeof userId !== 'string' || userId.length === 0 || !Number.isFinite(expiresAt.getTime())) return null
    if (
      activeOrganizationId !== undefined &&
      activeOrganizationId !== null &&
      typeof activeOrganizationId !== 'string'
    ) {
      return null
    }

    return {
      userId,
      expiresAt,
      ...(typeof activeOrganizationId === 'string' ? { activeOrganizationId } : {})
    }
  }
}
