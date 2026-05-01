import type { Fragment } from '../fragment/types'
import type { Mutation } from './types'

export function computeMutations<M>(
  before: readonly Fragment<M>[],
  after: readonly Fragment<M>[]
): Mutation[] {
  const mutations: Mutation[] = []
  const beforeById = new Map<string, { index: number; content: string }>()

  for (let i = 0; i < before.length; i++) {
    const fragment = before[i]
    if (fragment) beforeById.set(fragment.id, { index: i, content: fragment.content })
  }

  for (let i = 0; i < after.length; i++) {
    const fragment = after[i]
    if (!fragment) continue

    const previous = beforeById.get(fragment.id)
    if (!previous) {
      mutations.push({ op: 'add', fragmentId: fragment.id, index: i })
    } else if (previous.index !== i) {
      mutations.push({
        op: 'move',
        fragmentId: fragment.id,
        fromIndex: previous.index,
        toIndex: i,
      })
    } else if (previous.content !== fragment.content) {
      mutations.push({
        op: 'update',
        fragmentId: fragment.id,
        beforeContent: previous.content,
        afterContent: fragment.content,
      })
    }
    beforeById.delete(fragment.id)
  }

  for (const [fragmentId, info] of beforeById) {
    mutations.push({ op: 'remove', fragmentId, index: info.index })
  }

  return mutations
}

export const computeMutation = computeMutations
