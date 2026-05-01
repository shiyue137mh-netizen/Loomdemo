import type { Diagnostic } from '../diagnostic/types'
import type { Fragment } from '../fragment/types'
import { cloneFragments } from '../fragment/clone'
import type { Mutation } from '../mutation/types'
import type { PassConfig } from '../pass/types'
import type { Trace, TraceExecution, TraceOptions, TraceSink } from './types'

function normalizeSinks(sink?: TraceSink | readonly TraceSink[]): readonly TraceSink[] {
  if (!sink) return []
  return Array.isArray(sink) ? sink : [sink]
}

function notifySink<K extends keyof TraceSink>(
  sinks: readonly TraceSink[],
  method: K,
  ...args: Parameters<NonNullable<TraceSink[K]>>
): void {
  for (const sink of sinks) {
    const fn = sink[method]
    if (typeof fn === 'function') {
      try {
        ;(fn as (...innerArgs: unknown[]) => void)(...args)
      } catch {
        // Trace sinks must not affect Core execution.
      }
    }
  }
}

export class TraceCollector<M = unknown> {
  private readonly mode: 'on' | 'off'
  private readonly snapshotMode: 'off' | 'boundaries' | 'after-only'
  private readonly sinks: readonly TraceSink[]
  private readonly executions: TraceExecution<M>[] = []
  private readonly diagnostics: Diagnostic[] = []
  private finalFragments: readonly Fragment<M>[] = []

  constructor(
    private readonly initialFragments: readonly Fragment<M>[],
    private readonly options: TraceOptions = {},
    private readonly passConfigs?: readonly PassConfig[]
  ) {
    this.mode = options.mode ?? 'on'
    this.snapshotMode = options.snapshot ?? 'off'
    this.sinks = normalizeSinks(options.sink)
  }

  startPass(passName: string, passIndex: number): void {
    if (this.mode === 'off') return
    notifySink(this.sinks, 'onPassStart', passName, passIndex)
  }

  addDiagnostic(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic)
    if (this.mode === 'off') return
    notifySink(this.sinks, 'onDiagnostic', diagnostic)
  }

  endPass(input: {
    readonly passName: string
    readonly passIndex: number
    readonly durationMs: number
    readonly diagnostics: readonly Diagnostic[]
    readonly mutations: readonly Mutation[]
    readonly beforeFragments: readonly Fragment<M>[]
    readonly afterFragments: readonly Fragment<M>[]
  }): void {
    if (this.mode === 'off') return

    const execution: TraceExecution<M> = {
      passName: input.passName,
      passIndex: input.passIndex,
      durationMs: input.durationMs,
      diagnostics: [...input.diagnostics],
      mutations: [...input.mutations],
      afterFragments: cloneFragments(input.afterFragments),
      ...(this.snapshotMode !== 'off'
        ? {
            snapshot: {
              ...(this.snapshotMode === 'boundaries'
                ? { before: cloneFragments(input.beforeFragments) }
                : {}),
              after: cloneFragments(input.afterFragments),
            },
          }
        : {}),
    }

    this.executions.push(execution)
    notifySink(this.sinks, 'onPassEnd', execution)
  }

  endTrace(finalFragments: readonly Fragment<M>[]): Trace<M> {
    this.finalFragments = cloneFragments(finalFragments)
    return {
      version: '1',
      mode: this.mode,
      initialFragments: this.mode === 'off' ? [] : cloneFragments(this.initialFragments),
      finalFragments: this.mode === 'off' ? [] : this.finalFragments,
      ...(this.passConfigs ? { passConfigs: this.passConfigs } : {}),
      executions: this.mode === 'off' ? [] : [...this.executions],
      diagnostics: [...this.diagnostics],
    }
  }
}
