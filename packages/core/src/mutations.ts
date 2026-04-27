import { Mutation, ResolvedFragment } from './types'

/**
 * Compute the full structured diff between two fragment snapshots.
 *
 * Algorithm: O(n + m) single pass.
 * - Build a map of before fragments by id.
 * - Walk after fragments, classify each:
 *   1. ID not in before → add
 *   2. ID in before at different index → move
 *   3. ID in before, content changed → update
 * - Remaining before IDs → remove
 *
 * Returns all mutations detected, or an empty array if no change.
 * Order of mutations is: first the after-scan mutations, then removals.
 */
export function computeMutation<M>(
  before: ReadonlyArray<ResolvedFragment<M>>,
  after: ReadonlyArray<ResolvedFragment<M>>
): Mutation[] {
  const mutations: Mutation[] = []

  const beforeById = new Map<string, { index: number; content: string }>()
  for (let i = 0; i < before.length; i++) {
    const f = before[i]
    if (!f) continue
    beforeById.set(f.id, { index: i, content: f.content })
  }

  for (let i = 0; i < after.length; i++) {
    const f = after[i]
    if (!f) continue

    const prev = beforeById.get(f.id)

    if (!prev) {
      // New fragment that didn't exist before
      mutations.push({ op: 'add', fragmentId: f.id, index: i })
    } else if (prev.index !== i) {
      // Moved
      mutations.push({ op: 'move', fragmentId: f.id, fromIndex: prev.index, toIndex: i })
    } else if (prev.content !== f.content) {
      // Updated in-place
      mutations.push({ op: 'update', fragmentId: f.id, beforeContent: prev.content, afterContent: f.content })
    }
    beforeById.delete(f.id)
  }

  // Remaining entries in beforeById were removed
  for (const [id, info] of beforeById) {
    mutations.push({ op: 'remove', fragmentId: id, index: info.index })
  }

  return mutations
}
