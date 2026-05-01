import type { Trace } from './types'

export function serializeTrace(trace: Trace): string {
  return JSON.stringify(trace)
}

export function deserializeTrace<M = unknown>(input: string): Trace<M> {
  return JSON.parse(input) as Trace<M>
}
