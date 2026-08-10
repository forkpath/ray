export { env, preset } from './env'
export { getUrl } from './lib/utils'
export { auth } from './server'
export { createAuthBehaviorOptions } from './server-options'

export type {
  ActiveOrganization,
  AuthErrorCode,
  AuthErrorCodeContractIsExact,
  Invitation,
  Member,
  Organization,
  Session,
  User
} from './server'
export type { AuthBehaviorOptionsDependencies, AuthEmailSender } from './server-options'
