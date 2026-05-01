import { describe, expect, it } from 'vitest'
import { pipeline, type Pass } from '../src'

describe('pipeline', () => {
  it('runs passes synchronously in declaration order', () => {
    const appendA: Pass = {
      name: 'append-a',
      run: (fragments) => fragments.map((fragment) => ({ ...fragment, content: `${fragment.content}a` })),
    }
    const appendB: Pass = {
      name: 'append-b',
      run: (fragments) => fragments.map((fragment) => ({ ...fragment, content: `${fragment.content}b` })),
    }

    const result = pipeline([appendA, appendB]).run([{ id: 'f1', content: '', meta: {} }])

    expect(result.status).toBe('ok')
    expect(result.fragments[0]!.content).toBe('ab')
    expect(result.trace.executions).toHaveLength(2)
    expect(result.trace.executions[0]!.passName).toBe('append-a')
    expect(result.trace.executions[1]!.passName).toBe('append-b')
  })

  it('rejects promise-returning passes at runtime', () => {
    const asyncPass = {
      name: 'async-pass',
      run: async (fragments: readonly unknown[]) => fragments,
    } as unknown as Pass

    const result = pipeline([asyncPass]).run([{ id: 'f1', content: 'hello', meta: {} }])

    expect(result.status).toBe('error')
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'loom/async-pass-result')).toBe(true)
  })

  it('does not validate requires/provides in Core', () => {
    const pass: Pass = {
      name: 'needs-capability',
      requires: ['missing'],
      run: (fragments) => fragments,
    }

    const result = pipeline([pass]).run([{ id: 'f1', content: 'hello', meta: {} }])

    expect(result.status).toBe('ok')
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'loom/missing-capability')).toBe(false)
  })

  it('uses mutation-only trace by default', () => {
    const pass: Pass = {
      name: 'upper',
      run: (fragments) => fragments.map((fragment) => ({ ...fragment, content: fragment.content.toUpperCase() })),
    }

    const result = pipeline([pass]).run([{ id: 'f1', content: 'hello', meta: {} }])

    expect(result.trace.version).toBe('1')
    expect(result.trace.mode).toBe('on')
    expect(result.trace.executions[0]!.mutations).toHaveLength(1)
    expect(result.trace.executions[0]!.snapshot).toBeUndefined()
  })

  it('records snapshots only when explicitly requested', () => {
    const pass: Pass = {
      name: 'noop',
      run: (fragments) => fragments,
    }

    const result = pipeline([pass]).run(
      [{ id: 'f1', content: 'hello', meta: {} }],
      { snapshot: 'boundaries' }
    )

    expect(result.trace.executions[0]!.snapshot?.before).toHaveLength(1)
    expect(result.trace.executions[0]!.snapshot?.after).toHaveLength(1)
  })

  it('validates fragment ids and string content', () => {
    const pass: Pass = {
      name: 'noop',
      run: (fragments) => fragments,
    }

    expect(() => pipeline([pass]).run([{ id: '', content: 'hello', meta: {} }])).toThrow()
    expect(() =>
      pipeline([pass]).run([{ id: 'f1', content: Promise.resolve('bad'), meta: {} } as any])
    ).toThrow()
  })
})
