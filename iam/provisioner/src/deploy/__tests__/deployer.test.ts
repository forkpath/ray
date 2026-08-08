import { describe, expect, it, vi } from 'vitest'

import { ComposeDeployer, NoopDeployer } from '../deployer'

describe('NoopDeployer', () => {
  it('records deploy and teardown calls', async () => {
    const d = new NoopDeployer()
    await d.deploy('acme', '/p/compose.yml')
    await d.teardown('acme')
    expect(d.deployCalls).toEqual([{ orgId: 'acme', manifestPath: '/p/compose.yml' }])
    expect(d.teardownCalls).toEqual(['acme'])
  })
})

describe('ComposeDeployer', () => {
  it('builds a project-scoped compose up command', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    await new ComposeDeployer(run).deploy('acme', '/p/compose.yml')
    expect(run).toHaveBeenCalledWith('docker', ['compose', '-p', 'tenant-acme', '-f', '/p/compose.yml', 'up', '-d'])
  })

  it('builds a teardown command with volume removal', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    await new ComposeDeployer(run).teardown('acme')
    expect(run).toHaveBeenCalledWith('docker', ['compose', '-p', 'tenant-acme', 'down', '-v'])
  })

  it('rejects unsafe orgId before running anything', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    await expect(new ComposeDeployer(run).deploy('a;b', '/p')).rejects.toThrow(/Unsafe/)
    expect(run).not.toHaveBeenCalled()
  })
})
