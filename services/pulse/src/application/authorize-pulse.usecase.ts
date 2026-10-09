import { Injectable } from '@nestjs/common'

import { PulseAccessRepository, PulseIdentity } from '~/domain/pulse-access.repository'

@Injectable()
export class AuthorizePulseUseCase {
  constructor(private readonly access: PulseAccessRepository) {}

  async execute(
    identity: PulseIdentity,
    organizationId?: string
  ): Promise<'allowed' | 'session-expired' | 'forbidden'> {
    if (identity.expiresAt <= Date.now() || !(await this.access.isSessionActive(identity))) return 'session-expired'
    if (organizationId && !(await this.access.isMember(organizationId, identity.userId))) return 'forbidden'
    return 'allowed'
  }
}
