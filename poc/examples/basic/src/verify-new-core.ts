import { pipeline, Pass, DataFragment, ResolvedFragment } from '@loom/core'
import type { Diagnostic, Mutation, TraceSink } from '@loom/core'

// ═══════════════════════════════════════════════════════════
// Core v0.1 新功能验证脚本
// ═══════════════════════════════════════════════════════════

console.log('╔════════════════════════════════════════════════════╗')
console.log('║   Loom Core v0.1 新功能输出验证                     ║')
console.log('╚════════════════════════════════════════════════════╝\n')

// ── 1. Diagnostic 系统 + id 冲突校验 ─────────────────

console.log('━━━ 1. Diagnostic 系统 & id 冲突校验 ━━━')

const noopPass: Pass = {
  name: 'NoopPass',
  version: '1.0.0',
  run: (fragments) => [...fragments],
}

// 输入包含重复 id 和空 id
const result1 = await pipeline([noopPass]).run([
  { id: 'a', content: 'first', meta: {} },
  { id: 'a', content: 'second', meta: {} },  // 重复 id
  { id: '',  content: 'no-id',  meta: {} },  // 空 id
])

console.log('输入: 3 个 fragment (含 1 个重复 id + 1 个空 id)')
console.log(`产生 Diagnostic: ${result1.diagnostics.length} 条\n`)
for (const d of result1.diagnostics) {
  console.log(`  [${d.severity.toUpperCase()}] ${d.code}`)
  console.log(`         ${d.message}`)
  if (d.fragmentId) console.log(`         → fragmentId: ${d.fragmentId}`)
  console.log()
}

// ── 2. ctx.diagnose() 在 Pass 内产出诊断 ──────────────

console.log('━━━ 2. Pass 内 ctx.diagnose() ━━━')

const diagPass: Pass = {
  name: 'BudgetCheck',
  version: '1.0.0',
  run: (fragments, ctx) => {
    for (const f of fragments) {
      if (f.content.length > 10) {
        ctx.diagnose({
          severity: 'warning',
          code: 'myapp/fragment-too-large',
          message: `Fragment "${f.id}" exceeds 10 chars (${f.content.length})`,
          fragmentId: f.id,
          meta: { length: f.content.length },
        })
      }
    }
    return [...fragments]
  },
}

const result2 = await pipeline([diagPass]).run([
  { id: 'short', content: 'hi', meta: {} },
  { id: 'long',  content: 'this is a very long fragment that exceeds the budget', meta: {} },
])

console.log('输入: 1 个短 fragment + 1 个超长 fragment')
console.log(`产生 Diagnostic: ${result2.diagnostics.length} 条\n`)
for (const d of result2.diagnostics) {
  console.log(`  [${d.severity.toUpperCase()}] ${d.code}`)
  console.log(`         pass: ${d.pass}`)
  console.log(`         ${d.message}`)
  if (d.meta) console.log(`         meta: ${JSON.stringify(d.meta)}`)
  console.log()
}

// ── 3. Mutation 自动推断 ──────────────────────────────

console.log('━━━ 3. Mutation 自动推断 (add/remove/update/move) ━━━')

// 四个 Pass，分别演示四种 Mutation
const addPass: Pass = {
  name: 'AddFragment',
  version: '1.0.0',
  run: (fragments) => [...fragments, { id: 'c', content: 'gamma', meta: {} }],
}

const removePass: Pass = {
  name: 'RemoveFragmentB',
  version: '1.0.0',
  run: (fragments) => fragments.filter((f) => f.id !== 'b'),
}

const updatePass: Pass = {
  name: 'UppercaseContent',
  version: '1.0.0',
  run: (fragments) => fragments.map((f) => ({ ...f, content: f.content.toUpperCase() })),
}

const movePass: Pass = {
  name: 'ReverseOrder',
  version: '1.0.0',
  run: (fragments) => [...fragments].reverse(),
}

const result3 = await pipeline([addPass, removePass, updatePass, movePass]).run([
  { id: 'a', content: 'alpha', meta: {} },
  { id: 'b', content: 'beta',  meta: {} },
])

console.log('流水线: Add → Remove → Update → Move')
console.log('初始: [a:alpha, b:beta]\n')
for (const snap of result3.snapshots) {
  const ms = snap.mutations
  if (ms.length > 0) {
    for (const m of ms) {
      const detail = (() => {
        switch (m.op) {
          case 'add':    return `fragmentId="${m.fragmentId}" at index=${m.index}`
          case 'remove': return `fragmentId="${m.fragmentId}" (was at index=${m.index})`
          case 'update': return `fragmentId="${m.fragmentId}" "${m.beforeContent}" → "${m.afterContent}"`
          case 'move':   return `fragmentId="${m.fragmentId}" ${m.fromIndex} → ${m.toIndex}`
        }
      })()
      console.log(`  [${snap.passName}] mutation: ${m.op.padEnd(6)} | ${detail}`)
    }
  } else {
    console.log(`  [${snap.passName}] mutation: none      | (no structural change)`)
  }
}

// ── 4. TraceSink 实时事件流 ───────────────────────────

console.log('\n━━━ 4. TraceSink 实时事件流 ━━━')

const streamSink: TraceSink = {
  onPassStart(passName, passIndex) {
    console.log(`  ▶ SINK: Pass "${passName}" (#${passIndex}) started`)
  },
  onPassEnd(exec) {
    const dur = exec.durationMs.toFixed(2)
    const diagCount = exec.diagnostics.length
    const mutNames = exec.mutations.map((m) => m.op).join(', ') || 'none'
    console.log(`  ◀ SINK: Pass "${exec.passName}" finished in ${dur}ms — ${diagCount} diagnostics, mutations: [${mutNames}]`)
  },
  onDiagnostic(d) {
    console.log(`  ⚠ SINK: [${d.severity}] ${d.code}: ${d.message}`)
  },
}

const slowPass: Pass = {
  name: 'SlowPass',
  version: '1.0.0',
  provides: ['slow-done'],
  run: async (_fragments, ctx) => {
    ctx.diagnose({ severity: 'info', code: 'demo/start', message: 'Starting slow operation' })
    ctx.log('doing work...')
    // 模拟异步操作
    await new Promise((r) => setTimeout(r, 10))
    ctx.diagnose({ severity: 'info', code: 'demo/done', message: 'Slow operation complete' })
    return []
  },
}

const fastPass: Pass = {
  name: 'FastPass',
  version: '1.0.0',
  requires: ['slow-done'],
  run: (fragments, ctx) => {
    ctx.diagnose({ severity: 'hint', code: 'demo/fast', message: 'Fast pass executed' })
    return [...fragments]
  },
}

const result4 = await pipeline([slowPass, fastPass]).run(
  [{ id: 'task', content: 'payload', meta: {} }],
  { sink: streamSink },
)

// ── 5. SnapshotMode 对比 ─────────────────────────────

console.log('\n━━━ 5. SnapshotMode 对比 ━━━')

const countPass: Pass = {
  name: 'Counter',
  version: '1.0.0',
  run: (fragments) => [...fragments, { id: 'extra', content: 'added', meta: {} }],
}

const offResult = await pipeline([countPass]).run(
  [{ id: 'x', content: 'y', meta: {} }],
  { snapshot: 'off' },
)
console.log(`  snapshot: "off"        → ${offResult.snapshots.length} snapshots`)

const boundariesResult = await pipeline([countPass]).run(
  [{ id: 'x', content: 'y', meta: {} }],
  { snapshot: 'boundaries' },
)
console.log(`  snapshot: "boundaries" → ${boundariesResult.snapshots.length} snapshots`)

// ── 6. Object.freeze 不可变性 ────────────────────────

console.log('\n━━━ 6. Object.freeze 不可变性 ━━━')

const freezeResult = await pipeline([countPass]).run([{ id: 'z', content: 'immutable', meta: {} }])

let allFrozen = true
for (const snap of freezeResult.snapshots) {
  if (!Object.isFrozen(snap.fragments)) { allFrozen = false; break }
  for (const f of snap.fragments) {
    if (!Object.isFrozen(f)) { allFrozen = false; break }
  }
}
console.log(`  所有 snapshot 的 fragments 均已冻结: ${allFrozen ? '✅ 是' : '❌ 否'}`)

// ── 7. Pass version 诊断 ─────────────────────────────

console.log('\n━━━ 7. 缺少 version 的 Pass 诊断 ━━━')

const unversioned: Pass = {
  name: 'LegacyPass',
  // deliberately no version
  run: (fragments) => [...fragments],
}

const result7 = await pipeline([unversioned]).run([{ id: 'x', content: 'y', meta: {} }])
const uvDiags = result7.diagnostics.filter((d: Diagnostic) => d.code === 'loom/unversioned-pass')
console.log(`  loom/unversioned-pass 诊断: ${uvDiags.length} 条`)
if (uvDiags[0]) console.log(`    → ${uvDiags[0].message}`)

// ── 8. PipelineResult 完整字段 ───────────────────────

console.log('\n━━━ 8. PipelineResult 完整字段 ━━━')
console.log(`  status:      ${result4.status}`)
console.log(`  timings:     ${result4.timings.length} 条`)
for (const t of result4.timings) {
  console.log(`    ${t.passName}: ${t.durationMs.toFixed(2)}ms`)
}
console.log(`  diagnostics:     ${result4.diagnostics.length} 条 (已在上方体现)`)
console.log(`  construction:    ${result4.constructionDiagnostics.length} 条 (构建期诊断)`)
console.log(`  fragments:       ${result4.fragments.length} 个`)
console.log(`  snapshots:       ${result4.snapshots.length} 个`)
console.log(`  error:           ${result4.error ?? 'undefined (正常)'}`)

console.log('\n╔════════════════════════════════════════════════════╗')
console.log('║   全部 8 项验证完成                                  ║')
console.log('╚════════════════════════════════════════════════════╝')
