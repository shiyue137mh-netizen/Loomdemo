import { describe, it, expect } from 'vitest'
import { computeMutation } from '../src/mutations'
import { ResolvedFragment } from '../src/types'

function frag(id: string, content: string): ResolvedFragment {
  return { id, content, meta: {} }
}

describe('computeMutation', () => {
  it('should return empty array when arrays have same content and order', () => {
    const before = [frag('a', 'hello'), frag('b', 'world')]
    const after = [frag('a', 'hello'), frag('b', 'world')]
    // Different object references, same content — should detect no change
    expect(computeMutation(before, after)).toEqual([])
  })

  it('should detect single add mutation', () => {
    const before: ResolvedFragment[] = []
    const after = [frag('a', 'new')]

    const mutations = computeMutation(before, after)
    expect(mutations).toHaveLength(1)
    expect(mutations[0]).toEqual({ op: 'add', fragmentId: 'a', index: 0 })
  })

  it('should detect single remove mutation', () => {
    const before = [frag('a', 'old')]
    const after: ResolvedFragment[] = []

    const mutations = computeMutation(before, after)
    expect(mutations).toHaveLength(1)
    expect(mutations[0]!.op).toBe('remove')
  })

  it('should detect single update mutation', () => {
    const before = [frag('a', 'old')]
    const after = [frag('a', 'new')]

    const mutations = computeMutation(before, after)
    expect(mutations).toHaveLength(1)
    expect(mutations[0]!.op).toBe('update')
    if (mutations[0]!.op === 'update') {
      expect(mutations[0]!.beforeContent).toBe('old')
      expect(mutations[0]!.afterContent).toBe('new')
    }
  })

  it('should detect move mutations (reversal = 2 moves)', () => {
    const before = [frag('a', 'a'), frag('b', 'b')]
    const after = [frag('b', 'b'), frag('a', 'a')]

    const mutations = computeMutation(before, after)
    // Reversing [a,b] → [b,a] moves both elements
    expect(mutations).toHaveLength(2)
    expect(mutations.every((m) => m.op === 'move')).toBe(true)
  })

  it('should detect multiple mutations: add + remove', () => {
    const before = [frag('a', 'keep')]
    const after = [frag('b', 'new'), frag('a', 'keep')]

    const mutations = computeMutation(before, after)
    expect(mutations).toHaveLength(2)

    const adds = mutations.filter((m) => m.op === 'add')
    const moves = mutations.filter((m) => m.op === 'move')
    expect(adds).toHaveLength(1)
    expect(moves).toHaveLength(1)
  })

  it('should detect multiple mutations: update + remove', () => {
    const before = [frag('a', 'old'), frag('b', 'will-be-removed')]
    const after = [frag('a', 'new')]

    const mutations = computeMutation(before, after)
    expect(mutations).toHaveLength(2)

    const updates = mutations.filter((m) => m.op === 'update')
    const removes = mutations.filter((m) => m.op === 'remove')
    expect(updates).toHaveLength(1)
    expect(removes).toHaveLength(1)
  })

  it('should return empty array for empty arrays', () => {
    expect(computeMutation([], [])).toEqual([])
  })
})
