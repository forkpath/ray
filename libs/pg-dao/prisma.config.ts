import 'dotenv/config'

import { defineConfig } from 'prisma/config'

import { resolvePostgresDatabaseUrl } from './src/database-url'

export default defineConfig({
  schema: './src/schema.prisma',
  migrations: {
    path: './src/migrations',
    seed: 'tsx ./src/seed.ts'
  },
  datasource: {
    url: resolvePostgresDatabaseUrl(process.env)
  }
})
