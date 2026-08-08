import type { Deployer } from '../types'

import { assertSafeOrgId } from '../../../shared/src/identifier'

/**
 * 不实际部署，仅记录调用。用于编排层单测与 shared tier。
 */
export class NoopDeployer implements Deployer {
  public readonly deployCalls: Array<{ orgId: string; manifestPath: string }> = []
  public readonly teardownCalls: string[] = []

  async deploy(orgId: string, manifestPath: string): Promise<void> {
    this.deployCalls.push({ orgId, manifestPath })
  }

  async teardown(orgId: string): Promise<void> {
    this.teardownCalls.push(orgId)
  }
}

/**
 * 通过 docker compose 部署 dedicated 子系统。run 注入以便单测命令构造。
 */
export class ComposeDeployer implements Deployer {
  constructor(private readonly run: (cmd: string, args: string[]) => Promise<void>) {}

  async deploy(orgId: string, manifestPath: string): Promise<void> {
    assertSafeOrgId(orgId)
    await this.run('docker', ['compose', '-p', `tenant-${orgId}`, '-f', manifestPath, 'up', '-d'])
  }

  async teardown(orgId: string): Promise<void> {
    assertSafeOrgId(orgId)
    await this.run('docker', ['compose', '-p', `tenant-${orgId}`, 'down', '-v'])
  }
}
