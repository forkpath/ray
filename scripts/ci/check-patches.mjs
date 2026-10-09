/**
 * 依赖补丁上游状态检查
 *
 * 用途：
 *   读取 pnpm-workspace.yaml 的 patchedDependencies，逐个查询 npm 官方 registry，
 *   报告被本地补丁的依赖是否已发布更新的正式版本；同时读取
 *   .github/security-mitigations.json，给出对应安全豁免的到期日与剩余天数。
 *
 * 使用方式：
 *   pnpm ci:patches                                    # 输出 Markdown 表格
 *   node scripts/ci/check-patches.mjs <report.json>    # 另写 JSON 报告
 *
 * 使用场景：
 *   - CI：security.yml 每周扫描时运行，结果写入 GitHub Step Summary 并上传为构件。
 *   - 本地：新增、升级或移除 patches/ 下的补丁前后，以及安全豁免临近到期时。
 *
 * 退出码：
 *   0  检查完成（即使有上游新版本，也只提示人工复核，不阻断）
 *   1  任一 registry 请求失败（不把查询失败当成“无新版本”）
 *
 * 约束：只使用 Node 内置模块，因为 security.yml 不安装工作区依赖就执行本脚本；
 *       仅读取文件与公开 registry，不修改锁文件、补丁或豁免记录。
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const DAY_MS = 86_400_000
const REGISTRY = 'https://registry.npmjs.org'

/**
 * 从 pnpm-workspace.yaml 文本中提取 patchedDependencies。
 * 不引入 YAML 解析库，只按 pnpm 写出的固定格式逐行匹配：
 * 顶层 `patchedDependencies:` 之后的缩进行，形如 `name@version: patches/xxx.patch`，
 * 支持 scope 包名、引号与行尾注释；遇到下一个顶层键即结束。
 * 测试中用真实 YAML 解析器对照仓库文件，防止两者结果出现偏差。
 *
 * @returns {{ name: string, version: string, patch: string }[]}
 */
export function parsePatchedDependencies(workspaceYaml) {
  const lines = workspaceYaml.split(/\r?\n/)
  const start = lines.findIndex(line => /^patchedDependencies:\s*$/.test(line))
  if (start === -1) return []

  const patches = []
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break
    // 包名取到最后一个 `@` 之前（scope 包名开头的 `@` 单独处理），其后到 `:` 为版本号。
    const match = /^\s+['"]?((?:@[^/\s]+\/)?[^@\s'"]+)@([^:'"\s]+)['"]?:\s*['"]?([^'"\s#]+)['"]?/.exec(line)
    if (match) patches.push({ name: match[1], version: match[2], patch: match[3] })
  }
  return patches
}

// 只识别 x.y.z 正式版本；预发布与构建元数据返回 null，由调用方排除。
function parseRelease(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  return match ? match.slice(1).map(Number) : null
}

/**
 * 按主/次/修订号数值比较两个正式版本，可直接用作 Array#sort 的比较函数。
 * 根目录未安装 semver，且新增依赖会改动受安全豁免哈希约束的锁文件，因此在此最小实现。
 * 遇到非正式版本直接抛错，避免静默得出错误的大小关系。
 */
export function compareVersions(a, b) {
  const left = parseRelease(a)
  const right = parseRelease(b)
  if (!left || !right) throw new Error(`Unsupported version comparison: ${a} vs ${b}`)
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return 0
}

/**
 * 合并补丁、registry 元数据与安全豁免记录，得出每个补丁的状态：
 * - review-upstream-release：存在比补丁版本更高、且未被弃用的正式版本
 * - no-upstream-release：没有更新的正式版本
 * - registry-error：没有拿到有效的 registry 元数据
 *
 * 有新版本只表示“需要人工复核”，不代表补丁修复的问题已在上游解决。
 * 纯函数：当前时间通过 now 传入，便于测试。
 */
export function evaluatePatches(patches, registryDocs, mitigations, now = new Date()) {
  return patches.map(entry => {
    const doc = registryDocs.get(entry.name)
    // 豁免记录必须与补丁的包名和版本完全一致才关联；非安全类补丁没有豁免记录。
    const mitigation = mitigations.find(item => item.package === entry.name && item.version === entry.version)
    // 向下取整：剩余不足一天按 0 天显示，已过期为负数。
    const daysUntilExpiry = mitigation ? Math.floor((Date.parse(mitigation.expiresAt) - now.getTime()) / DAY_MS) : null
    const base = { ...entry, expiresAt: mitigation?.expiresAt ?? null, daysUntilExpiry }

    if (!doc || typeof doc.versions !== 'object' || doc.versions === null) {
      return { ...base, status: 'registry-error', newer: [], latest: null }
    }

    // 排除预发布和已弃用版本，结果按版本升序排列。
    const newer = Object.keys(doc.versions)
      .filter(version => parseRelease(version) && !doc.versions[version]?.deprecated)
      .filter(version => compareVersions(version, entry.version) > 0)
      .sort(compareVersions)
    return {
      ...base,
      status: newer.length > 0 ? 'review-upstream-release' : 'no-upstream-release',
      newer,
      latest: doc['dist-tags']?.latest ?? null
    }
  })
}

// 生成 Markdown 表格，同时用于终端输出和 GitHub Step Summary；新版本只列最近 3 个。
export function formatReport(results) {
  const rows = results.map(result => {
    const newer = result.newer.length > 0 ? result.newer.slice(-3).join(', ') : '-'
    const expiry =
      result.daysUntilExpiry === null ? '-' : `${result.expiresAt.slice(0, 10)} (${result.daysUntilExpiry} 天)`
    return `| ${result.name}@${result.version} | ${result.status} | ${newer} | ${expiry} |`
  })
  return [
    '| 补丁 | 状态 | 更新的正式版本（最近 3 个） | 安全豁免到期 |',
    '| ---- | ---- | -------------------------- | ------------ |',
    ...rows
  ].join('\n')
}

// 请求精简版包元数据（install-v1 格式，含 versions、dist-tags 和 deprecated），体积远小于完整文档。
// scope 包名中的 `/` 需编码为 %2F。
async function fetchPackument(name) {
  const response = await fetch(`${REGISTRY}/${name.replace('/', '%2F')}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' }
  })
  if (!response.ok) throw new Error(`${name}: registry responded ${response.status}`)
  return response.json()
}

async function main(outputPath) {
  const root = resolve(import.meta.dirname, '../..')
  const patches = parsePatchedDependencies(readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf8'))
  const { mitigations } = JSON.parse(readFileSync(resolve(root, '.github/security-mitigations.json'), 'utf8'))

  // 同一个包可能有多个版本的补丁，每个包只请求一次；单个包失败不影响其余包的检查。
  const registryDocs = new Map()
  const errors = []
  for (const name of new Set(patches.map(patch => patch.name))) {
    try {
      registryDocs.set(name, await fetchPackument(name))
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  const results = evaluatePatches(patches, registryDocs, mitigations)
  const report = formatReport(results)
  console.log(report)
  if (outputPath) writeFileSync(outputPath, `${JSON.stringify({ checkedAt: new Date(), results }, null, 2)}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## 依赖补丁上游状态\n\n${report}\n`)
  }

  if (results.some(result => result.status === 'review-upstream-release')) {
    console.log('\n有补丁的上游已发布更新版本：确认是否包含修复，再按 patches/README.md 的移除步骤处理。')
  }
  // registry 查询失败按失败退出，不输出看似“全部无新版本”的干净结果。
  if (errors.length > 0) {
    console.error(errors.join('\n'))
    process.exitCode = 1
  }
}

// 仅在直接执行时运行；被测试导入时只暴露上面的纯函数。
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main(process.argv[2])
}
