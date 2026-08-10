import * as z from 'zod'

import { MemberRole, UserRole } from './types'

interface UserRoleCarrier {
  role?: string | null
}

const hierarchy: MemberRole[] = [MemberRole.MEMBER, MemberRole.ADMIN, MemberRole.OWNER]

export const generateName = (email?: string) => email?.split('@')[0] ?? 'Anonymous'

export const getAllRolesAtOrBelow = (role: MemberRole): MemberRole[] => {
  const index = hierarchy.indexOf(role)
  if (index === -1) return []

  return hierarchy.slice(0, index + 1)
}

export const getAllRolesAtOrAbove = (role: MemberRole): MemberRole[] => {
  const index = hierarchy.indexOf(role)
  if (index === -1) return []

  return hierarchy.slice(index)
}

export const hasAdminPermission = (user: UserRoleCarrier) => user.role?.split(',').includes(UserRole.ADMIN) ?? false

export const hasOrgAdminPermission = (role?: MemberRole) => role === MemberRole.ADMIN || role === MemberRole.OWNER

export const toMemberRole = (role: unknown): MemberRole => {
  const result = z.enum(MemberRole).safeParse(role)
  return result.success ? result.data : MemberRole.MEMBER
}

export type { UserRoleCarrier }
