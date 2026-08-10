import type { WebhookEventTerminalStatus } from './persistence'

import { claimWebhookEvent, completeWebhookEvent, failWebhookEvent } from './persistence'

export interface WebhookEventIdentity {
  eventId: string
  provider: string
  type: string
}

export type WebhookEventRunResult =
  | { status: WebhookEventTerminalStatus; attemptCount: number }
  | { status: 'duplicate'; attemptCount: number; terminalStatus: WebhookEventTerminalStatus }

export class WebhookEventProcessingError extends Error {
  constructor(
    readonly identity: WebhookEventIdentity,
    readonly attemptCount: number
  ) {
    super(`Webhook event ${identity.provider}/${identity.eventId} is already processing`)
    this.name = 'WebhookEventProcessingError'
  }
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

export async function runWebhookEvent(
  identity: WebhookEventIdentity,
  process: () => Promise<WebhookEventTerminalStatus>
): Promise<WebhookEventRunResult> {
  const claim = await claimWebhookEvent(identity)

  if (claim.outcome === 'terminal') {
    return {
      status: 'duplicate',
      terminalStatus: claim.status,
      attemptCount: claim.attemptCount
    }
  }

  if (claim.outcome === 'processing') {
    throw new WebhookEventProcessingError(identity, claim.attemptCount)
  }

  try {
    const status = await process()
    await completeWebhookEvent({ ...identity, status, attemptCount: claim.attemptCount })
    return { status, attemptCount: claim.attemptCount }
  } catch (error) {
    try {
      await failWebhookEvent({ ...identity, error: getErrorMessage(error), attemptCount: claim.attemptCount })
    } catch (persistenceError) {
      throw new Error(
        `Webhook event ${identity.provider}/${identity.eventId} failed (${getErrorMessage(error)}) and its failure state could not be persisted (${getErrorMessage(persistenceError)})`
      )
    }

    throw error
  }
}
