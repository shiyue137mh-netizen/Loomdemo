import { pipeline, Pass } from '@loom/core'
import { DedupById, StdMeta } from '@loom/stdlib'

// 一个极简自定义 Pass：按 meta.priority 降序
const SortByPriority: Pass<StdMeta> = {
  name: 'SortByPriority',
  run: (fragments) =>
    [...fragments].sort(
      (a, b) => (b.meta.priority ?? 0) - (a.meta.priority ?? 0)
    ),
}

async function main() {
  const result = await pipeline<StdMeta>([
    DedupById({ strategy: 'keep-last' }),
    SortByPriority,
  ]).run([
    { id: 'sys:1',     content: 'You are a helpful assistant.', meta: { priority: 100 } },
    { id: 'user:hint', content: 'Be concise.',                   meta: { priority: 50 } },
    { id: 'user:hint', content: 'Be very concise.',              meta: { priority: 50 } }, // 同 id
    { id: 'ctx:1',     content: Promise.resolve('Context A'),    meta: { priority: 80 } },
  ])

  console.log('final fragments:')
  for (const f of result.fragments) console.log(`  [${f.id}] ${f.content}`)

  console.log('\nsnapshots:')
  for (const s of result.snapshots) {
    console.log(`  ${s.passName}: ${s.fragments.length} fragments in ${s.durationMs.toFixed(2)}ms`)
  }
}

main().catch(console.error)
