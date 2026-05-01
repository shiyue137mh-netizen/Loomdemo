import type { Fragment } from '../fragment/types'
import type { Trace } from '../trace/types'
import type { Mutation } from './types'

export function applyMutation<M>(
  fragments: readonly Fragment<M>[],
  mutation: Mutation,
  source: readonly Fragment<M>[]
): Fragment<M>[] {
  const next = [...fragments]

  switch (mutation.op) {
    case 'add': {
      const fragment = source.find((item) => item.id === mutation.fragmentId)
      if (!fragment) throw new Error(`Cannot replay add for missing fragment "${mutation.fragmentId}"`)
      next.splice(mutation.index, 0, fragment)
      return next
    }
    case 'remove': {
      const index = next.findIndex((item) => item.id === mutation.fragmentId)
      if (index >= 0) next.splice(index, 1)
      return next
    }
    case 'move': {
      const index = next.findIndex((item) => item.id === mutation.fragmentId)
      if (index < 0) return next
      const [fragment] = next.splice(index, 1)
      if (fragment) next.splice(mutation.toIndex, 0, fragment)
      return next
    }
    case 'update': {
      const index = next.findIndex((item) => item.id === mutation.fragmentId)
      const fragment = source.find((item) => item.id === mutation.fragmentId)
      if (index < 0 || !fragment) return next
      next[index] = fragment
      return next
    }
  }
}

export function replayTrace<M>(
  trace: Trace<M>,
  options?: { readonly untilPassIndex?: number }
): Fragment<M>[] {
  let fragments = [...trace.initialFragments]
  const until = options?.untilPassIndex ?? Number.POSITIVE_INFINITY

  for (const execution of trace.executions) {
    if (execution.passIndex > until) break
    for (const mutation of execution.mutations) {
      fragments = applyMutation(fragments, mutation, execution.afterFragments)
    }
  }

  return fragments
}
