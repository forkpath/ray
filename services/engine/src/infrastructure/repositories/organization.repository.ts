import type { InvitationEntity, MemberEntity, OrganizationEntity } from '~/domain/entities/organization.entity'
import type {
  IOrganizationRepository,
  ListInvitationsCriteria,
  ListMembersCriteria,
  ListOrganizationsCriteria,
  PagedResult,
  UpdateMemberData,
  UpdateOrganizationData
} from '~/domain/repositories/organization.repository.interface'
import type { MemberRoleValue } from '~/domain/value-objects/member-role.vo'
import type { UserId } from '~/domain/value-objects/user-id.vo'

import { Injectable } from '@nestjs/common'

import { Prisma, prisma } from '@libs/pg-dao'

import { Invitation, Member, Organization } from '~/domain/entities/organization.entity'
import { InvitationId } from '~/domain/value-objects/invitation-id.vo'
import { MemberId } from '~/domain/value-objects/member-id.vo'
import { MemberRole } from '~/domain/value-objects/member-role.vo'
import { OrganizationId } from '~/domain/value-objects/organization-id.vo'
import { OrganizationSlug } from '~/domain/value-objects/organization-slug.vo'

import { listOffset, listOrder } from './list-query'

@Injectable()
export class OrganizationRepository implements IOrganizationRepository {
  async findAll(
    params: ListOrganizationsCriteria
  ): Promise<PagedResult<OrganizationEntity> & { max: { members: number } }> {
    const { page, perPage, sort, q, createdAt, members } = params

    const offset = listOffset(page, perPage)
    const orderBy = listOrder(
      sort,
      new Map([
        ['id', Prisma.sql`o.id`],
        ['name', Prisma.sql`o.name`],
        ['slug', Prisma.sql`o.slug`],
        ['logo', Prisma.sql`o.logo`],
        ['createdAt', Prisma.sql`o.created_at`],
        ['members', Prisma.sql`COUNT(m.id)`]
      ]),
      Prisma.sql`o.created_at ASC`,
      Prisma.sql`o.id ASC`
    )
    const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`]
    if (q) conditions.push(Prisma.sql`(o.name ILIKE ${`%${q}%`} OR o.slug ILIKE ${`%${q}%`})`)
    if (createdAt) conditions.push(Prisma.sql`o.created_at BETWEEN ${createdAt.from} AND ${createdAt.to}`)
    const grouped = Prisma.sql`
      FROM public.organization o
      LEFT JOIN public.member m ON m.organization_id = o.id
      WHERE ${Prisma.join(conditions, ' AND ')}
      GROUP BY o.id
      HAVING ${members ? Prisma.sql`COUNT(m.id) BETWEEN ${members.from} AND ${members.to}` : Prisma.sql`TRUE`}
    `
    const rows = await prisma.$queryRaw<
      Array<{
        id: string
        name: string
        slug: string | null
        logo: string | null
        created_at: Date
        member_count: number
        total_count: number
      }>
    >(Prisma.sql`
      SELECT o.id, o.name, o.slug, o.logo, o.created_at,
        COUNT(m.id)::int AS member_count, COUNT(*) OVER()::int AS total_count
      ${grouped}
      ORDER BY ${orderBy}
      LIMIT ${perPage} OFFSET ${offset}
    `)
    const total =
      rows[0]?.total_count ??
      (offset > 0
        ? ((
            await prisma.$queryRaw<Array<{ total: number }>>(
              Prisma.sql`SELECT COUNT(*)::int AS total FROM (SELECT o.id ${grouped}) filtered`
            )
          )[0]?.total ?? 0)
        : 0)
    const maxResult = await prisma.$queryRaw<Array<{ max_members: number }>>(Prisma.sql`
      SELECT COALESCE(MAX(cnt), 0)::int AS max_members FROM (
        SELECT COUNT(m.id) AS cnt FROM public.organization o
        LEFT JOIN public.member m ON m.organization_id = o.id GROUP BY o.id
      ) counts
    `)
    const membersMax = maxResult[0]?.max_members ?? 0

    return {
      list: rows.map(r =>
        this.mapOrganizationToEntity({
          id: r.id,
          name: r.name,
          slug: r.slug,
          logo: r.logo,
          createdAt: r.created_at,
          membersCount: r.member_count
        })
      ),
      total,
      max: { members: membersMax }
    }
  }

  async findById(id: OrganizationId): Promise<OrganizationEntity | null> {
    const org = await prisma.organization.findUnique({
      where: { id: id.getValue() },
      include: {
        _count: { select: { members: true } }
      }
    })
    if (!org) return null
    return this.mapOrganizationToEntity({
      id: org.id,
      name: org.name,
      slug: org.slug ?? null,
      logo: org.logo ?? null,
      createdAt: org.createdAt,
      membersCount: org._count.members
    })
  }

  async count(): Promise<number> {
    return prisma.organization.count()
  }

  async update(id: OrganizationId, data: UpdateOrganizationData): Promise<OrganizationEntity> {
    const org = await prisma.organization.update({
      where: { id: id.getValue() },
      data: {
        name: data.name,
        slug: data.slug?.getValue()
      },
      include: { _count: { select: { members: true } } }
    })
    return this.mapOrganizationToEntity({
      id: org.id,
      name: org.name,
      slug: org.slug ?? null,
      logo: org.logo ?? null,
      createdAt: org.createdAt,
      membersCount: org._count.members
    })
  }

  async delete(id: OrganizationId): Promise<void> {
    await prisma.organization.delete({ where: { id: id.getValue() } })
  }

  async findBySlug(slug: OrganizationSlug): Promise<OrganizationEntity | null> {
    const org = await prisma.organization.findFirst({
      where: { slug: slug.getValue() },
      include: { _count: { select: { members: true } } }
    })
    if (!org) return null
    return this.mapOrganizationToEntity({
      id: org.id,
      name: org.name,
      slug: org.slug ?? null,
      logo: org.logo ?? null,
      createdAt: org.createdAt,
      membersCount: org._count.members
    })
  }

  async findMembers(orgId: OrganizationId, params: ListMembersCriteria): Promise<PagedResult<MemberEntity>> {
    const { page, perPage, sort, q, role, createdAt } = params

    const where: Record<string, unknown> = {
      organizationId: orgId.getValue()
    }
    if (q) {
      where.user = {
        OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }]
      }
    }
    if (role) where.role = { in: role }
    if (createdAt) {
      where.createdAt = {
        gte: createdAt.from,
        lte: createdAt.to
      }
    }

    const orderBy = sort?.length
      ? sort.map(s => ({ [s.field]: s.desc ? 'desc' : 'asc' }))
      : [{ createdAt: 'desc' as const }]

    const [data, total] = await Promise.all([
      prisma.member.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy,
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true }
          }
        }
      }),
      prisma.member.count({ where })
    ])

    return {
      list: data.map(m => this.mapMemberToEntity(m)),
      total
    }
  }

  async findMemberById(orgId: OrganizationId, memberId: MemberId): Promise<MemberEntity | null> {
    const m = await prisma.member.findFirst({
      where: { id: memberId.getValue(), organizationId: orgId.getValue() },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true }
        }
      }
    })
    if (!m) return null
    return this.mapMemberToEntity(m)
  }

  async countMembers(orgId: OrganizationId): Promise<number> {
    return prisma.member.count({
      where: { organizationId: orgId.getValue() }
    })
  }

  async findMemberRole(orgId: OrganizationId, userId: UserId): Promise<MemberRoleValue | null> {
    const member = await prisma.member.findFirst({
      where: { organizationId: orgId.getValue(), userId: userId.getValue() },
      select: { role: true }
    })
    return member ? MemberRole.create(member.role).getValue() : null
  }

  async countMembersByRole(orgId: OrganizationId, role: MemberRoleValue): Promise<number> {
    return prisma.member.count({
      where: { organizationId: orgId.getValue(), role }
    })
  }

  async updateMember(orgId: OrganizationId, memberId: MemberId, data: UpdateMemberData): Promise<MemberEntity> {
    const m = await prisma.member.update({
      where: { id: memberId.getValue(), organizationId: orgId.getValue() },
      data,
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true }
        }
      }
    })
    return this.mapMemberToEntity(m)
  }

  async deleteMember(orgId: OrganizationId, memberId: MemberId): Promise<void> {
    await prisma.member.delete({
      where: { id: memberId.getValue(), organizationId: orgId.getValue() }
    })
  }

  async findInvitations(
    orgId: OrganizationId,
    params: ListInvitationsCriteria
  ): Promise<PagedResult<InvitationEntity>> {
    const { page, perPage, sort, email, role, status, expiresAt } = params

    const where: Record<string, unknown> = {
      organizationId: orgId.getValue()
    }
    if (email) {
      where.email = { contains: email, mode: 'insensitive' }
    }
    if (role) where.role = { in: role }
    if (status) where.status = { in: status }
    if (expiresAt) {
      where.expiresAt = {
        gte: expiresAt.from,
        lte: expiresAt.to
      }
    }

    const orderBy = sort?.length
      ? sort.map(s => ({ [s.field]: s.desc ? 'desc' : 'asc' }))
      : [{ createdAt: 'desc' as const }]

    const [data, total] = await Promise.all([
      prisma.invitation.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy
      }),
      prisma.invitation.count({ where })
    ])

    return {
      list: data.map(i => this.mapInvitationToEntity(i)),
      total
    }
  }

  async deleteInvitation(orgId: OrganizationId, invitationId: InvitationId): Promise<void> {
    await prisma.invitation.delete({
      where: { id: invitationId.getValue(), organizationId: orgId.getValue() }
    })
  }

  private mapOrganizationToEntity(data: {
    id: string
    name: string
    slug: string | null
    logo: string | null
    createdAt: Date
    membersCount: number
  }): OrganizationEntity {
    return Organization.fromPersistence(data)
  }

  private mapMemberToEntity(data: {
    id: string
    userId: string
    organizationId: string
    role: string
    createdAt: Date
    user: {
      id: string
      name: string
      email: string
      image: string | null
    }
  }): MemberEntity {
    return Member.fromPersistence({
      id: data.id,
      userId: data.userId,
      organizationId: data.organizationId,
      role: data.role,
      createdAt: data.createdAt,
      user: {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        image: data.user.image ?? null
      }
    })
  }

  private mapInvitationToEntity(data: {
    id: string
    email: string
    role: string | null
    status: string
    expiresAt: Date
    createdAt: Date
    organizationId: string
    inviterId: string
  }): InvitationEntity {
    return Invitation.fromPersistence({
      id: data.id,
      email: data.email,
      role: data.role ?? 'member',
      status: data.status,
      expiresAt: data.expiresAt,
      createdAt: data.createdAt,
      organizationId: data.organizationId,
      inviterId: data.inviterId
    })
  }
}
