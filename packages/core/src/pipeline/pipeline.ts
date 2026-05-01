import type { Fragment } from '../fragment/types'
import type { Pass } from '../pass/types'
import type { TraceOptions } from '../trace/types'
import type { RunResult } from './runner'
import { runPasses } from './runner'

export interface Pipeline<M = unknown> {
  run(fragments: readonly Fragment<M>[], options?: TraceOptions): RunResult<M>
}

export function pipeline<M = unknown>(passes: readonly Pass<M>[]): Pipeline<M> {
  return {
    run(fragments, options) {
      return runPasses({
        fragments,
        passes,
        ...(options ? { trace: options } : {}),
      })
    },
  }
}
