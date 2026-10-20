import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'

import { BackendContainers } from '../testing/backend-containers.mjs'

function containers(progress = []) {
  return new BackendContainers({
    namespace: 'ray-test-unit',
    database: 'ray_test',
    password: 'secret',
    root: '/repo',
    assertRunning: () => undefined,
    inspect: async () => ({ NetworkSettings: { Ports: {} } }),
    progress: message => progress.push(message)
  })
}

// A builder whose container prints output and then fails its wait strategy, the way
// testcontainers reports a container that exits during startup.
function failingBuilder(lines) {
  let consumer
  return {
    withLogConsumer(callback) {
      consumer = callback
      return this
    },
    async start() {
      const stream = new PassThrough()
      consumer?.(stream)
      for (const line of lines) stream.write(`${line}\n`)
      await new Promise(resolve => setImmediate(resolve))
      throw new Error('Health check failed: unhealthy')
    }
  }
}

test('a container that fails to start reports the tail of its own output', async () => {
  const progress = []
  const lines = Array.from({ length: 100 }, (_, index) => `line ${index}`)
  await assert.rejects(containers(progress).launch('mongo', failingBuilder(lines)), error => {
    assert.match(error.message, /^mongo failed to start: Health check failed: unhealthy\n/)
    assert.match(error.message, /line 99$/)
    // Only the last 80 lines are kept, so the message stays readable.
    assert.match(error.message, /line 20\n/)
    assert.doesNotMatch(error.message, /line 19\n/)
    return true
  })
  assert.deepEqual(progress, ['Starting mongo'])
})

test('a container that fails before printing anything says so', async () => {
  await assert.rejects(
    containers().launch('redis', failingBuilder([])),
    /--- last 80 lines of redis output ---\n\(no output\)$/
  )
})
