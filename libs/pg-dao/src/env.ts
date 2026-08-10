import type { Preset } from 'envin/types'

import { defineEnv } from 'envin'
import * as z from 'zod'

import { NodeEnv } from '@libs/common'

export const preset = {
  id: 'pg',
  server: {
    POSTGRES_DATABASE_URL: z.string().optional(),
    POSGTRES_DATABASE_URL: z.string().optional()
  }
} as const satisfies Preset

export const env = defineEnv({
  ...preset,
  shared: {
    NODE_ENV: z.enum(NodeEnv).default(NodeEnv.DEVELOPMENT)
  }
})
