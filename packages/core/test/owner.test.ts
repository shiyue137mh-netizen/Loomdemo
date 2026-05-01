import { describe, expect, it } from 'vitest'
import { pipeline, type Pass } from '../src'

describe('owner tracking', () => {
  it('annotates newly created fragments with current pass owner', () => {
    const creator: Pass = {
      name: 'creator',
      run: () => [{ id: 'new', content: 'created', meta: {} }],
    }

    const result = pipeline([creator]).run([])

    expect((result.fragments[0]!.meta as Record<string, unknown>).__owner).toBe('creator')
  })

  it('reports cross-owner writes without blocking the run', () => {
    const editor: Pass = {
      name: 'editor',
      run: (fragments) => fragments.map((fragment) => ({ ...fragment, content: 'changed' })),
    }

    const result = pipeline([editor]).run([
      { id: 'f1', content: 'original', meta: { __owner: 'other' } },
    ])

    expect(result.status).toBe('ok')
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'loom/cross-owner-write')).toBe(true)
  })

  it('rejects meta.__owner mutation', () => {
    const mutator: Pass = {
      name: 'mutator',
      run: (fragments) => fragments.map((fragment) => ({
        ...fragment,
        meta: { ...(fragment.meta as Record<string, unknown>), __owner: 'mutator' },
      })),
    }

    const result = pipeline([mutator]).run([
      { id: 'f1', content: 'original', meta: { __owner: 'other' } },
    ])

    expect(result.status).toBe('error')
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'loom/owner-mutation')).toBe(true)
  })
})
