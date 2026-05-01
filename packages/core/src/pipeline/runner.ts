import type { Diagnostic } from '../diagnostic/types'
import { cloneFragments } from '../fragment/clone'
import type { Fragment } from '../fragment/types'
import { validateFragments } from '../fragment/validate'
import { computeMutations } from '../mutation/diff'
import { annotateOwners, assertOwnerNotMutated, detectCrossOwnerWrites } from '../owner/owner'
import type { Pass, PassConfig } from '../pass/types'
import { factoryDiagnostic, PassRegistry } from '../pass/registry'
import { TraceCollector } from '../trace/collector'
import type { Trace, TraceOptions } from '../trace/types'
import { now } from '../utils/time'
import { createPassContext } from './context'
import { PipelineValidationError, serializeError, type SerializedError } from './errors'

export interface RunConfig<M = unknown> {
  readonly fragments: readonly Fragment<M>[]
  readonly passes: readonly PassConfig[]
  readonly registry: PassRegistry<M>
  readonly trace?: TraceOptions
}

export interface RunResult<M = unknown> {
  readonly fragments: readonly Fragment<M>[]
  readonly trace: Trace<M>
  readonly diagnostics: readonly Diagnostic[]
  readonly status: 'ok' | 'error'
  readonly error?: SerializedError
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return !!value && typeof value === 'object' && typeof (value as { then?: unknown }).then === 'function'
}

function validatePasses(passes: readonly Pass[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (let i = 0; i < passes.length; i++) {
    const pass = passes[i]
    if (!pass || typeof pass !== 'object') {
      diagnostics.push({
        severity: 'error',
        code: 'loom/invalid-pass',
        message: `Pass at index ${i} must be an object`,
        pass: 'core',
      })
      continue
    }
    if (typeof pass.name !== 'string' || pass.name.length === 0) {
      diagnostics.push({
        severity: 'error',
        code: 'loom/invalid-pass',
        message: `Pass at index ${i} must have a non-empty name`,
        pass: 'core',
      })
    }
    if (typeof pass.run !== 'function') {
      diagnostics.push({
        severity: 'error',
        code: 'loom/invalid-pass',
        message: `Pass "${pass.name}" at index ${i} must have run()`,
        pass: 'core',
      })
    }
  }
  return diagnostics
}

function throwIfErrors(diagnostics: readonly Diagnostic[]): void {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error')
  if (errors.length === 0) return
  throw new PipelineValidationError(
    `Pipeline validation failed with ${errors.length} error(s)`,
    errors.map((diagnostic) => ({ code: diagnostic.code, message: diagnostic.message }))
  )
}

function normalizeInitialFragments<M>(fragments: readonly Fragment<M>[]): Fragment<M>[] {
  return fragments.map((fragment) => {
    const meta = fragment.meta && typeof fragment.meta === 'object' && !Array.isArray(fragment.meta)
      ? fragment.meta as Record<string, unknown>
      : {}
    return {
      ...fragment,
      meta: {
        ...meta,
        __owner: typeof meta.__owner === 'string' ? meta.__owner : 'input',
      } as M,
    }
  })
}

export function run<M = unknown>(config: RunConfig<M>): RunResult<M> {
  const diagnostics: Diagnostic[] = []
  let passes: readonly Pass<M>[]

  try {
    passes = config.registry.createAll(config.passes)
  } catch (error) {
    const diagnostic = factoryDiagnostic('unknown', error)
    diagnostics.push(diagnostic)
    const trace = new TraceCollector(config.fragments, config.trace, config.passes)
    trace.addDiagnostic(diagnostic)
    return {
      fragments: config.fragments,
      trace: trace.endTrace(config.fragments),
      diagnostics,
      status: 'error',
      error: serializeError(error),
    }
  }

  return runPasses({
    fragments: config.fragments,
    passes,
    passConfigs: config.passes,
    ...(config.trace ? { trace: config.trace } : {}),
  })
}

export function runPasses<M = unknown>(input: {
  readonly fragments: readonly Fragment<M>[]
  readonly passes: readonly Pass<M>[]
  readonly trace?: TraceOptions
  readonly passConfigs?: readonly PassConfig[]
}): RunResult<M> {
  const diagnostics: Diagnostic[] = []
  let current = normalizeInitialFragments(input.fragments)
  const collector = new TraceCollector(current, input.trace, input.passConfigs)

  const constructionDiagnostics = [
    ...validatePasses(input.passes as readonly Pass[]),
    ...validateFragments(current as readonly Fragment[], 'core'),
  ]
  for (const diagnostic of constructionDiagnostics) {
    diagnostics.push(diagnostic)
    collector.addDiagnostic(diagnostic)
  }
  throwIfErrors(constructionDiagnostics)

  for (let passIndex = 0; passIndex < input.passes.length; passIndex++) {
    const pass = input.passes[passIndex]!
    const passDiagnostics: Diagnostic[] = []
    const logs: { readonly message: string; readonly data?: unknown; readonly at: number }[] = []
    const before = cloneFragments(current)
    const startedAt = now()

    collector.startPass(pass.name, passIndex)

    try {
      const ctx = createPassContext({
        passName: pass.name,
        passIndex,
        diagnostics: passDiagnostics,
        logs,
      })
      const result = pass.run(current, ctx)
      if (isPromiseLike(result)) {
        throw new Error(`Pass "${pass.name}" returned a Promise; Core v0.1 requires synchronous passes`)
      }

      let next = [...result]
      const resultDiagnostics = validateFragments(next as readonly Fragment[], pass.name)
      for (const diagnostic of resultDiagnostics) passDiagnostics.push(diagnostic)
      throwIfErrors(resultDiagnostics)

      assertOwnerNotMutated(before, next)
      next = annotateOwners(before, next, pass.name)
      passDiagnostics.push(...detectCrossOwnerWrites(before, next, pass.name))

      const mutations = computeMutations(before, next)
      const durationMs = now() - startedAt

      for (const diagnostic of passDiagnostics) {
        diagnostics.push(diagnostic)
        collector.addDiagnostic(diagnostic)
      }

      collector.endPass({
        passName: pass.name,
        passIndex,
        durationMs,
        diagnostics: passDiagnostics,
        mutations,
        beforeFragments: before,
        afterFragments: next,
      })

      current = next
    } catch (error) {
      const diagnostic: Diagnostic = {
        severity: 'error',
        code: error instanceof Error && error.message.includes('meta.__owner')
          ? 'loom/owner-mutation'
          : error instanceof Error && error.message.includes('returned a Promise')
            ? 'loom/async-pass-result'
            : 'loom/pass-threw',
        message: error instanceof Error ? error.message : String(error),
        pass: pass.name,
      }
      diagnostics.push(diagnostic)
      collector.addDiagnostic(diagnostic)

      return {
        fragments: current,
        trace: collector.endTrace(current),
        diagnostics,
        status: 'error',
        error: serializeError(error),
      }
    }
  }

  return {
    fragments: current,
    trace: collector.endTrace(current),
    diagnostics,
    status: 'ok',
  }
}
