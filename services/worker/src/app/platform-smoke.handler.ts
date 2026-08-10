import type { EventEnvelopeV1 } from '@libs/event-contract'
import type { WorkerEventHandler } from '@libs/worker-kernel'

import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class PlatformSmokeHandler implements WorkerEventHandler {
  readonly eventType = 'platform.smoke'
  readonly supportedVersions = [1] as const
  private readonly logger = new Logger(PlatformSmokeHandler.name)

  async handle(envelope: EventEnvelopeV1<unknown>): Promise<void> {
    this.logger.log(`Processed platform smoke event ${envelope.id}`)
  }
}
