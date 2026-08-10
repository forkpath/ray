import { Injectable } from '@nestjs/common'

import { PulseHealthService, PulseReadiness } from './pulse-runtime.service'

@Injectable()
export class AppService {
  constructor(private readonly health: PulseHealthService) {}

  live(): { service: 'pulse'; status: 'ok' } {
    return this.health.live()
  }

  ready(): Promise<PulseReadiness> {
    return this.health.ready()
  }
}
