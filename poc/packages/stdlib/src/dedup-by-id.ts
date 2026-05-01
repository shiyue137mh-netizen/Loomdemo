import { Pass, ResolvedFragment } from '@loom/core'

export function DedupById<M = unknown>(options?: {
  strategy?: 'keep-first' | 'keep-last'
}): Pass<M> {
  const strategy = options?.strategy ?? 'keep-first'
  
  return {
    name: 'DedupById',
    run: (fragments) => {
      const seen = new Set<string>()
      const result: ResolvedFragment<M>[] = []
      
      if (strategy === 'keep-first') {
        for (const f of fragments) {
          if (!seen.has(f.id)) {
            seen.add(f.id)
            result.push(f)
          }
        }
      } else {
        // keep-last
        for (let i = fragments.length - 1; i >= 0; i--) {
          const f = fragments[i]!
          if (!seen.has(f.id)) {
            seen.add(f.id)
            result.unshift(f) // prepend to keep original relative order
          }
        }
      }
      
      return result
    }
  }
}
