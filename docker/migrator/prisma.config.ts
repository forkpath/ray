import { defineConfig } from 'prisma/config'

const databaseUrl = process.env.POSTGRES_DATABASE_URL
if (!databaseUrl) throw new Error('POSTGRES_DATABASE_URL is required')

export default defineConfig({
  schema: './src',
  migrations: { path: './src/migrations' },
  datasource: { url: databaseUrl }
})
