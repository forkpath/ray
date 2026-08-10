import type { WorkerRuntimeMode } from '@libs/worker-kernel'

export interface WorkerRuntimeConfig {
  readonly batchSize: number
  readonly concurrency: number
  readonly consumer: string
  readonly deadLetterExchange: string
  readonly deadLetterQueue: string
  readonly deadLetterRoutingKey: string
  readonly exchange: string
  readonly mode: WorkerRuntimeMode
  readonly port: number
  readonly queue: string
  readonly retryPollMs: number
  readonly routingKey: string
}

function parsePositiveInteger(value: string | undefined, fallback: number, field: string, maximum: number): number {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${field} must be an integer between 1 and ${maximum}`)
  }
  return parsed
}

function parseMode(value: string | undefined): WorkerRuntimeMode {
  const mode = value ?? 'active'
  if (mode !== 'active' && mode !== 'standby') {
    throw new Error('WORKER_RUNTIME_MODE must be active or standby')
  }
  return mode
}

export function loadWorkerRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): WorkerRuntimeConfig {
  const exchange = environment['RABBITMQ_EXCHANGE_NAME'] || 'core'
  const queue = environment['WORKER_QUEUE_NAME'] || 'platform-worker-v1'
  return {
    batchSize: parsePositiveInteger(environment['WORKER_RETRY_BATCH_SIZE'], 25, 'WORKER_RETRY_BATCH_SIZE', 100),
    concurrency: parsePositiveInteger(environment['WORKER_CONCURRENCY'], 4, 'WORKER_CONCURRENCY', 16),
    consumer: environment['WORKER_CONSUMER_NAME'] || 'platform-worker-v1',
    deadLetterExchange: environment['WORKER_DEAD_LETTER_EXCHANGE'] || `${exchange}.worker.dlx`,
    deadLetterQueue: environment['WORKER_DEAD_LETTER_QUEUE'] || `${queue}.dlq`,
    deadLetterRoutingKey: environment['WORKER_DEAD_LETTER_ROUTING_KEY'] || `${queue}.dead`,
    exchange,
    mode: parseMode(environment['WORKER_RUNTIME_MODE']),
    port: parsePositiveInteger(environment['WORKER_PORT'], 3002, 'WORKER_PORT', 65_535),
    queue,
    retryPollMs: parsePositiveInteger(environment['WORKER_RETRY_POLL_MS'], 1_000, 'WORKER_RETRY_POLL_MS', 60_000),
    routingKey: environment['WORKER_ROUTING_KEY'] || 'platform.worker.v1'
  }
}

export const workerRuntimeConfig = loadWorkerRuntimeConfig()
