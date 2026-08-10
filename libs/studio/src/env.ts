import { defineEnv } from 'envin'
import * as z from 'zod'

import { NodeEnv } from '@libs/common'
import { preset as i18n } from '@libs/i18n'
import { ThemeColor, ThemeMode } from '@libs/ui-core'

const castStringToBool = z.preprocess(val => {
  if (typeof val === 'string') {
    if (['1', 'true'].includes(val.toLowerCase())) return true
    if (['0', 'false'].includes(val.toLowerCase())) return false
  }
  return val
}, z.coerce.boolean())

export default defineEnv({
  extends: [i18n],
  shared: {
    NODE_ENV: z.enum(NodeEnv).default(NodeEnv.DEVELOPMENT)
  },
  /**
   * Specify your server-side environment variables schema here.
   * This way you can ensure the app isn't built with invalid env vars.
   */
  server: {
    CONTACT_EMAIL: z.email()
  },

  /**
   * Specify your client-side environment variables schema here.
   * For them to be exposed to the client, prefix them with `VITE_`.
   */
  clientPrefix: 'VITE_',
  client: {
    VITE_AUTH_PASSWORD: castStringToBool.optional().default(true),
    VITE_AUTH_MAGIC_LINK: castStringToBool.optional().default(false),
    VITE_AUTH_PASSKEY: castStringToBool.optional().default(true),
    VITE_AUTH_ANONYMOUS: castStringToBool.optional().default(true),

    VITE_URL: z.url(),
    VITE_DEFAULT_LOCALE: z.string().optional().default('en'),
    VITE_THEME_MODE: z.enum(ThemeMode).optional().default(ThemeMode.SYSTEM),
    VITE_THEME_COLOR: z.enum(ThemeColor).optional().default(ThemeColor.ORANGE)
  },
  /**
   * Destructure all variables from `process.env` to make sure they aren't tree-shaken away.
   */
  env: {
    ...process.env,
    VITE_URL: process.env.VITE_URL,
    VITE_DEFAULT_LOCALE: process.env.VITE_DEFAULT_LOCALE,
    VITE_THEME_MODE: process.env.VITE_THEME_MODE,
    VITE_THEME_COLOR: process.env.VITE_THEME_COLOR,

    VITE_AUTH_PASSWORD: process.env.VITE_AUTH_PASSWORD,
    VITE_AUTH_MAGIC_LINK: process.env.VITE_AUTH_MAGIC_LINK,
    VITE_AUTH_PASSKEY: process.env.VITE_AUTH_PASSKEY,
    VITE_AUTH_ANONYMOUS: process.env.VITE_AUTH_ANONYMOUS
  }
})
