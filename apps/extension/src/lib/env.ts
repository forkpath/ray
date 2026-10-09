import { defineEnv } from 'envin'
import * as z from 'zod'

const THEME_MODES = ['system', 'light', 'dark'] as const
const THEME_COLORS = ['orange', 'rose', 'red', 'yellow', 'gray', 'stone', 'green', 'blue', 'violet'] as const

export default defineEnv({
  clientPrefix: 'VITE_',
  client: {
    VITE_URL: z.url(),
    VITE_API_BASE_URL: z.url(),
    VITE_DEFAULT_LOCALE: z.string().optional().default('en'),
    VITE_THEME_MODE: z.enum(THEME_MODES).optional().default('system'),
    VITE_THEME_COLOR: z.enum(THEME_COLORS).optional().default('orange')
  },
  env: {
    ...import.meta.env,
    VITE_URL: import.meta.env.VITE_URL,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    VITE_DEFAULT_LOCALE: import.meta.env.VITE_DEFAULT_LOCALE,
    VITE_THEME_MODE: import.meta.env.VITE_THEME_MODE,
    VITE_THEME_COLOR: import.meta.env.VITE_THEME_COLOR
  }
})
