import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    // 集成测试需真实 Postgres/Logto/Kong；默认仅跑单元测试。
    // 设 IAM_INTEGRATION=1 时纳入 *.integration.test.ts
    exclude: process.env.IAM_INTEGRATION ? ['**/node_modules/**'] : ['**/node_modules/**', '**/*.integration.test.ts']
  }
})
