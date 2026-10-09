import type { AuthConfig } from '@libs/auth-contract'

import { Platform } from 'react-native'

import { authConfigSchema, SocialProvider } from '@libs/auth-contract'

import { mobileEnv } from '~/lib/env'

const oAuthProviders: SocialProvider[] = [
  Platform.select({
    android: SocialProvider.GOOGLE,
    ios: SocialProvider.APPLE,
    default: SocialProvider.GOOGLE
  }) as SocialProvider,
  SocialProvider.GITHUB
]

export const authConfig = authConfigSchema.parse({
  providers: {
    password: mobileEnv.auth.password,
    magicLink: mobileEnv.auth.magicLink,
    emailOtp: mobileEnv.auth.emailOtp,
    anonymous: mobileEnv.auth.anonymous,
    oAuth: oAuthProviders
  }
}) satisfies AuthConfig
