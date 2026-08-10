import type { User } from '@libs/auth-web'

import { authClient } from '~/lib/auth'
import { ThemeControls } from '~/modules/common/theme'
import { UserNavigation, UserNavigationSkeleton } from '~/modules/user/user-navigation'

export const Header = () => {
  return (
    <div className="flex items-center justify-between gap-2">
      <ThemeControls />
      <User />
    </div>
  )
}

const User = () => {
  const session = authClient.useSession()

  if (session.isPending) {
    return <UserNavigationSkeleton />
  }
  const user = session.data?.user

  return user ? <AuthenticatedUser user={user} /> : <UserNavigation user={null} organization={null} />
}

const AuthenticatedUser = ({ user }: { user: User }) => {
  const organization = authClient.useActiveOrganization()

  if (organization.isPending) {
    return <UserNavigationSkeleton />
  }

  return <UserNavigation user={user ?? null} organization={organization.data} />
}
