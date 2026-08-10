import { AuthProvider } from '@libs/auth-contract'

export const LOGIN_OPTIONS = [AuthProvider.PASSWORD, AuthProvider.MAGIC_LINK] as const

export type LoginOption = (typeof LOGIN_OPTIONS)[number]
