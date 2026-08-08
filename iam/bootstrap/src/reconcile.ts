/**
 * 幂等 reconcile：对比期望态与实际态，仅创建缺失项。
 *
 * 设计为纯逻辑 + 注入式 collection 操作（list/create），
 * 因此可脱离真实 Logto 完整单测；二次运行必须无副作用。
 */

export interface ReconcileResult {
  created: string[]
  skipped: string[]
}

export interface Collection<TDesired, TExisting> {
  list: () => Promise<TExisting[]>
  create: (item: TDesired) => Promise<{ id: string }>
}

/**
 * 通用幂等协调：按 keyOf 提取的稳定键比对，缺失则创建。
 * @param keyOfDesired 从期望项取幂等键
 * @param keyOfExisting 从实际项取幂等键
 */
export async function reconcile<TDesired, TExisting>(
  collection: Collection<TDesired, TExisting>,
  desired: TDesired[],
  keyOfDesired: (d: TDesired) => string,
  keyOfExisting: (e: TExisting) => string
): Promise<ReconcileResult> {
  const existing = await collection.list()
  const existingKeys = new Set(existing.map(keyOfExisting))

  const created: string[] = []
  const skipped: string[] = []

  for (const item of desired) {
    const key = keyOfDesired(item)
    if (existingKeys.has(key)) {
      skipped.push(key)
      continue
    }
    await collection.create(item)
    created.push(key)
    // 防止同一批次内重复键重复创建
    existingKeys.add(key)
  }

  return { created, skipped }
}
