import { describe, it, expect } from 'vitest'
import { DedupById } from '../src/dedup-by-id'
import { ResolvedFragment } from '@loom/core'

describe('DedupById', () => {
  it('should dedup keeping first by default', () => {
    const pass = DedupById()
    const input: ResolvedFragment[] = [
      { id: '1', content: 'first', meta: {} },
      { id: '2', content: 'second', meta: {} },
      { id: '1', content: 'third', meta: {} },
    ]
    
    // Pass is synchronous
    const result = pass.run(input, { snapshots: [] }) as ResolvedFragment[]
    
    expect(result).toHaveLength(2)
    expect(result[0].content).toBe('first')
    expect(result[1].content).toBe('second')
  })

  it('should dedup keeping last when specified', () => {
    const pass = DedupById({ strategy: 'keep-last' })
    const input: ResolvedFragment[] = [
      { id: '1', content: 'first', meta: {} },
      { id: '2', content: 'second', meta: {} },
      { id: '1', content: 'third', meta: {} },
    ]
    
    const result = pass.run(input, { snapshots: [] }) as ResolvedFragment[]
    
    expect(result).toHaveLength(2)
    expect(result[0].content).toBe('second')
    expect(result[1].content).toBe('third') // keep relative order, so 2 comes before 1? Wait!
    // Original array: 1, 2, 1
    // Keep last means the second '1' is kept.
    // So the final array should be 2, 1. Wait, let's check my implementation.
  })
})
