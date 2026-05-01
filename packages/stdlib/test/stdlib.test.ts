import { describe, expect, it } from 'vitest'
import { replayTrace, run } from '@loom/core'
import {
  createAppendPass,
  createFilterByMetaPass,
  createPrependPass,
  createSortByMetaNumberPass,
  createStdlibRegistry,
  validatePipeline,
} from '../src'

describe('@loom/stdlib', () => {
  it('appends content', () => {
    const pass = createAppendPass({ suffix: '!' })
    const result = pass.run([{ id: 'f1', content: 'hello', meta: {} }], {
      passName: pass.name,
      passIndex: 0,
      diagnose: () => {},
      log: () => {},
    })

    expect(result[0]!.content).toBe('hello!')
  })

  it('prepends content', () => {
    const pass = createPrependPass({ prefix: '> ' })
    const result = pass.run([{ id: 'f1', content: 'hello', meta: {} }], {
      passName: pass.name,
      passIndex: 0,
      diagnose: () => {},
      log: () => {},
    })

    expect(result[0]!.content).toBe('> hello')
  })

  it('filters by meta equality', () => {
    const pass = createFilterByMetaPass({ key: 'kind', equals: 'keep' })
    const result = pass.run([
      { id: 'a', content: 'a', meta: { kind: 'keep' } },
      { id: 'b', content: 'b', meta: { kind: 'drop' } },
    ], {
      passName: pass.name,
      passIndex: 0,
      diagnose: () => {},
      log: () => {},
    })

    expect(result.map((fragment) => fragment.id)).toEqual(['a'])
  })

  it('sorts by numeric meta with stable fallback', () => {
    const pass = createSortByMetaNumberPass({ key: 'rank' })
    const result = pass.run([
      { id: 'missing', content: 'missing', meta: {} },
      { id: 'two', content: 'two', meta: { rank: 2 } },
      { id: 'one', content: 'one', meta: { rank: 1 } },
      { id: 'also-missing', content: 'also-missing', meta: {} },
    ], {
      passName: pass.name,
      passIndex: 0,
      diagnose: () => {},
      log: () => {},
    })

    expect(result.map((fragment) => fragment.id)).toEqual(['one', 'two', 'missing', 'also-missing'])
  })

  it('does not coerce empty strings to sortable numbers', () => {
    const pass = createSortByMetaNumberPass({ key: 'rank' })
    const result = pass.run([
      { id: 'empty', content: 'empty', meta: { rank: '' } },
      { id: 'one', content: 'one', meta: { rank: 1 } },
    ], {
      passName: pass.name,
      passIndex: 0,
      diagnose: () => {},
      log: () => {},
    })

    expect(result.map((fragment) => fragment.id)).toEqual(['one', 'empty'])
  })

  it('runs stdlib pass configs through Core registry', () => {
    const result = run({
      registry: createStdlibRegistry(),
      passes: [
        { name: 'stdlib.append', params: { suffix: '!' } },
        { name: 'stdlib.prepend', params: { prefix: '> ' } },
      ],
      fragments: [{ id: 'f1', content: 'hello', meta: {} }],
    })

    expect(result.status).toBe('ok')
    expect(result.fragments[0]!.content).toBe('> hello!')
  })

  it('returns factory diagnostics for invalid stdlib params', () => {
    const result = run({
      registry: createStdlibRegistry(),
      passes: [{ name: 'stdlib.append', params: { suffix: 1 } }],
      fragments: [{ id: 'f1', content: 'hello', meta: {} }],
    })

    expect(result.status).toBe('error')
    expect(result.diagnostics[0]!.code).toBe('loom/factory-threw')
    expect(result.diagnostics[0]!.meta?.factoryName).toBe('stdlib.append')
  })

  it('produces replayable traces through Core', () => {
    const result = run({
      registry: createStdlibRegistry(),
      passes: [{ name: 'stdlib.append', params: { suffix: '!' } }],
      fragments: [{ id: 'f1', content: 'hello', meta: {} }],
    })

    expect(replayTrace(result.trace)).toEqual(result.trace.finalFragments)
  })

  it('surfaces Core owner diagnostics for stdlib mutations', () => {
    const result = run({
      registry: createStdlibRegistry(),
      passes: [{ name: 'stdlib.append', params: { suffix: '!' } }],
      fragments: [{ id: 'f1', content: 'hello', meta: { __owner: 'other' } }],
    })

    expect(result.status).toBe('ok')
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'loom/cross-owner-write')).toBe(true)
  })

  it('validates stdlib pipeline params without running Core', () => {
    const diagnostics = validatePipeline([
      { name: 'stdlib.append', params: { suffix: 1 } },
    ])

    expect(diagnostics[0]!.code).toBe('loom-stdlib/invalid-params')
  })

  it('reports missing capability in validatePipeline but accepts undeclared stdlib passes', () => {
    const registry = createStdlibRegistry()
    registry.register({
      name: 'needs-capability',
      create: () => ({
        name: 'needs-capability',
        requires: ['ready'],
        run: (fragments) => fragments,
      }),
    })

    expect(validatePipeline([{ name: 'stdlib.append', params: { suffix: '!' } }])).toEqual([])
    expect(validatePipeline([{ name: 'needs-capability' }], registry)[0]!.code).toBe('loom-stdlib/missing-required-capability')
  })
})
