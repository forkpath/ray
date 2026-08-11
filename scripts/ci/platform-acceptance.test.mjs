import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const workspaceRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

const readWorkspaceFile = path => readFile(join(workspaceRoot, path), 'utf8')

const assertEvidence = async (path, evidence) => {
  const source = await readWorkspaceFile(path)

  for (const expected of evidence) {
    assert.match(source, expected, `${path} must retain ${expected}`)
  }
}

describe('platform acceptance governance', () => {
  it('retains authentication and organization lifecycle coverage', async () => {
    await assertEvidence('libs/auth-server/src/server.integration.test.ts', [
      /registers, verifies, signs in, creates a session and signs out/,
      /refreshes an aged session and rejects an expired session/,
      /creates an organization, invites a member and accepts the invitation/
    ])

    await assertEvidence('services/engine/src/application/commands/billing/__tests__/organization-billing.spec.ts', [
      /derives organization checkout ownership from the path and actor/,
      /does not create checkout when organization management access is denied/
    ])
  })

  it('retains billing webhook, Pulse and Worker reliability coverage', async () => {
    await assertEvidence('libs/billing-server/src/lib/webhook-state-machine.spec.ts', [
      /allows only one concurrent request to process an event/,
      /retries a failed event on the same unique record/
    ])
    await assertEvidence('libs/billing-server/src/lib/provider-webhooks.spec.ts', [
      /returns a terminal Stripe duplicate without processing twice/
    ])
    await assertEvidence('services/pulse/src/app/pulse-runtime.service.spec.ts', [
      /rejects unauthenticated and rate-limited connections/,
      /revalidates the session and checks membership before joining an organization room/,
      /disconnects revoked sessions and slow consumers/,
      /publishes only organization-scoped platform smoke envelopes/,
      /fails readiness when Redis, Postgres, auth, or the contract is unavailable/
    ])
    await assertEvidence('libs/worker-kernel/src/lib/worker-kernel.spec.ts', [
      /returns a terminal duplicate without executing the handler/,
      /schedules an exponential retry with jitter after a transient failure/,
      /dead-letters the fifth failed attempt/,
      /requires a registered handler and every dependency before standby is ready/
    ])
    await assertEvidence('services/worker/src/app/worker-runtime.service.spec.ts', [
      /acks processed, duplicate, busy and durably scheduled retry outcomes/,
      /requeues when processing fails before recording a durable outcome/,
      /returns detailed readiness and rejects an unhealthy dependency/
    ])
  })

  it('keeps deterministic browser E2E as a standard cached Nx test target', async () => {
    const project = JSON.parse(await readWorkspaceFile('apps/web-e2e/project.json'))
    const target = project.targets?.test

    assert.ok(target, 'web-e2e must expose the standard test target')
    assert.equal(target.cache, true)
    assert.match(target.options?.command ?? '', /playwright test --project=chromium/)
    assert.deepEqual(target.dependsOn, [{ projects: ['web'], target: 'build' }])

    await assertEvidence('apps/web-e2e/src/platform-critical-flows.spec.ts', [
      /redirects an unauthenticated user to login/,
      /registers and signs in with deterministic auth provider responses/,
      /creates and switches organization context through the account UI/,
      /uses owner-scoped billing endpoints and enforces organization permission denial/
    ])

    await assertEvidence('.github/workflows/ci.yml', [
      /pnpm exec playwright install --with-deps chromium/,
      /nx affected -t lint,typecheck,test,build/,
      /nx run-many -t lint,typecheck,test,build --all/
    ])
  })

  it('retains post-release smoke, observation and application-only rollback coverage', async () => {
    await assertEvidence('scripts/ci/release-controller.test.mjs', [
      /requires health, auth, billing, and organization smoke categories/,
      /runs deterministic smoke requests without printing credentials/,
      /fails the observation window closed when a deployment threshold is exceeded/,
      /installs twice and restores only prior application digests/
    ])
  })
})
