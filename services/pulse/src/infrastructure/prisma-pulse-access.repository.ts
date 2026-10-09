import { Injectable } from '@nestjs/common'

import { PrismaService } from '@libs/pg-dao'

import { PulseAccessRepository, PulseIdentity } from '~/domain/pulse-access.repository'

@Injectable()
export class PrismaPulseAccessRepository extends PulseAccessRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async isSessionActive(identity: PulseIdentity): Promise<boolean> {
    const session = await this.prisma.session.findUnique({
      where: { id: identity.sessionId },
      select: { userId: true, expiresAt: true, user: { select: { banned: true, banExpires: true } } }
    })
    if (!session || session.userId !== identity.userId || session.expiresAt.getTime() <= Date.now()) return false
    return !session.user.banned || (session.user.banExpires !== null && session.user.banExpires.getTime() <= Date.now())
  }

  async isMember(organizationId: string, userId: string): Promise<boolean> {
    return !!(await this.prisma.member.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { id: true }
    }))
  }
}
