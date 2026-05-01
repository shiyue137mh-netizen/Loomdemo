import { describe, expect, it } from 'vitest'
import { PassRegistry, run, type PassFactory } from '../src'

describe('PassRegistry', () => {
  it('creates passes from JSON pass configs', () => {
    const registry = new PassRegistry()
    const factory: PassFactory<{ suffix: string }> = {
      name: 'append',
      create: (params) => ({
        name: 'append',
        run: (fragments) => fragments.map((fragment) => ({
          ...fragment,
          content: `${fragment.content}${params.suffix}`,
        })),
      }),
    }
    registry.register(factory)

    const result = run({
      registry,
      passes: [{ name: 'append', params: { suffix: '!' } }],
      fragments: [{ id: 'f1', content: 'hello', meta: {} }],
    })

    expect(result.status).toBe('ok')
    expect(result.fragments[0]!.content).toBe('hello!')
    expect(result.trace.passConfigs).toEqual([{ name: 'append', params: { suffix: '!' } }])
  })

  it('returns error result when factory is missing', () => {
    const result = run({
      registry: new PassRegistry(),
      passes: [{ name: 'missing' }],
      fragments: [{ id: 'f1', content: 'hello', meta: {} }],
    })

    expect(result.status).toBe('error')
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'loom/factory-threw')).toBe(true)
  })
})
