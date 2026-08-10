import { generateName, MemberRole, UserRole } from '@libs/auth-contract'
import { prisma } from '@libs/pg-dao'

import { env } from '../env'
import { auth } from '../server'

const getEmail = (suffix: string | string[]) => {
  const [name, domain] = env.SEED_EMAIL.split('@')
  return `${name}+${Array.isArray(suffix) ? suffix.join('-') : suffix}@${domain}`
}

const getImage = (name: string) => `https://avatar.vercel.sh/${name}`

interface SeedContext {
  context: Awaited<typeof auth.$context>
  passwordHash: string
}

interface SeededMember {
  userId: string
}

const seedUser = async (
  { context, passwordHash }: SeedContext,
  { email, role = UserRole.USER }: { email: string; role?: string }
) => {
  const name = generateName(email)
  const userId = context.generateId({ model: 'user' }).toString()

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role,
      image: getImage(name),
      emailVerified: true,
      isAnonymous: false
    },
    create: {
      id: userId,
      name,
      email,
      role,
      image: getImage(name),
      emailVerified: true,
      isAnonymous: false
    }
  })

  const existingAccount = await prisma.account.findFirst({
    where: {
      userId: user.id,
      providerId: 'credential'
    }
  })

  if (!existingAccount) {
    await prisma.account.create({
      data: {
        id: context.generateId({ model: 'account' }).toString(),
        accountId: context.generateId({ model: 'account' }).toString(),
        providerId: 'credential',
        password: passwordHash,
        userId: user.id
      }
    })
  }

  return user
}

const seedOrganizationMember = async (
  seedCtx: SeedContext,
  { organizationId, role }: { organizationId: string; role: string }
) => {
  const email = getEmail(['org', role])
  const user = await seedUser(seedCtx, { email })

  if (!user) return null

  const existingMember = await prisma.member.findFirst({
    where: {
      userId: user.id,
      organizationId
    }
  })

  if (existingMember) {
    return prisma.member.update({
      where: { id: existingMember.id },
      data: {
        role,
        organizationId,
        userId: user.id
      }
    })
  }

  return prisma.member.create({
    data: {
      id: seedCtx.context.generateId({ model: 'member' }).toString(),
      organizationId,
      role,
      userId: user.id,
      createdAt: new Date()
    }
  })
}

const seedOrganizationInvitation = async (
  seedCtx: SeedContext,
  {
    organizationId,
    inviterId,
    role
  }: {
    organizationId: string
    inviterId: string
    role: string
  }
) => {
  const email = getEmail(['org', 'invite', role])

  const existingInvitation = await prisma.invitation.findFirst({
    where: {
      organizationId,
      email
    }
  })

  const invitationData = {
    organizationId,
    role,
    email,
    expiresAt: new Date(Date.now() + (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * 1000 * 60 * 60 * 24)),
    inviterId
  }

  if (existingInvitation) {
    return prisma.invitation.update({
      where: { id: existingInvitation.id },
      data: invitationData
    })
  }

  return prisma.invitation.create({
    data: {
      id: seedCtx.context.generateId({ model: 'invitation' }).toString(),
      ...invitationData
    }
  })
}

const seedOrganization = async (seedCtx: SeedContext) => {
  const organizationId = seedCtx.context.generateId({ model: 'organization' }).toString()
  const organizationSlug = 'seed-organization'

  const organization = await prisma.organization.upsert({
    where: { slug: organizationSlug },
    update: {
      name: organizationSlug,
      logo: getImage(organizationSlug)
    },
    create: {
      id: organizationId,
      name: organizationSlug,
      slug: organizationSlug,
      logo: getImage(organizationSlug),
      createdAt: new Date()
    }
  })

  const memberRoles = Object.values(MemberRole)

  const members = await Promise.all(
    memberRoles.map(role => seedOrganizationMember(seedCtx, { organizationId: organization.id, role }))
  )

  const invitationRoles = memberRoles.filter(role => role !== MemberRole.OWNER)
  await Promise.all(
    members.flatMap((member: SeededMember | null) =>
      invitationRoles.map(role =>
        seedOrganizationInvitation(seedCtx, {
          organizationId: organization.id,
          role,
          inviterId: member?.userId ?? ''
        })
      )
    )
  )

  return organization
}

const seedUsers = async (seedCtx: SeedContext) =>
  Promise.all(Object.values(UserRole).map(role => seedUser(seedCtx, { email: getEmail(role), role })))

async function main() {
  console.log('Seeding auth data...')

  const context = await auth.$context
  const passwordHash = await context.password.hash(env.SEED_PASSWORD)
  const seedCtx: SeedContext = { context, passwordHash }

  await seedUsers(seedCtx)
  console.log('Users seeded')

  await seedOrganization(seedCtx)
  console.log('Organization seeded')

  console.log('Auth data seeded successfully!')
}

main()
  .catch(error => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
