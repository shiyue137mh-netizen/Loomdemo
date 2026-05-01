import {
  DataFragment,
  Diagnostic,
  Mutation,
  Pass,
  PassContext,
  PassLog,
  PassTiming,
  PipelineResult,
  PipelineSnapshot,
  ResolvedFragment,
  RunOptions,
  TraceSink,
} from './types'
import { resolveFragments } from './resolution'
import { computeMutation } from './mutations'
import {
  LoomError,
  PipelineCancelledError,
  PipelineError,
  PipelineValidationError,
} from './errors'

// ── Built-in Diagnostic Codes ──────────────────────────

const DIAG_CODES = {
  DUPLICATE_ID: 'loom/duplicate-id',
  EMPTY_ID: 'loom/empty-id',
  EMPTY_PIPELINE: 'loom/empty-pipeline',
  MISSING_CAPABILITY: 'loom/missing-capability',
  PASS_THREW: 'loom/pass-threw',
  UNVERSIONED_PASS: 'loom/unversioned-pass',
  INVALID_PASS: 'loom/invalid-pass',
} as const

// ── Helpers ────────────────────────────────────────────

function normalizeSinks(sink?: TraceSink | ReadonlyArray<TraceSink>): ReadonlyArray<TraceSink> {
  if (!sink) return []
  return Array.isArray(sink) ? sink : [sink]
}

function notifySinks(
  sinks: ReadonlyArray<TraceSink>,
  method: 'onPassStart' | 'onPassEnd' | 'onDiagnostic',
  ...args: any[]
): void {
  for (const sink of sinks) {
    const fn = (sink as any)[method]
    if (typeof fn === 'function') {
      try { fn.apply(sink, args) } catch { /* sink errors are swallowed */ }
    }
  }
}

function freezeFragments<M>(fragments: ReadonlyArray<ResolvedFragment<M>>): ReadonlyArray<ResolvedFragment<M>> {
  for (const f of fragments) {
    if (!Object.isFrozen(f)) Object.freeze(f)
  }
  if (!Object.isFrozen(fragments)) Object.freeze(fragments)
  return fragments
}

function validatePasses(passes: ReadonlyArray<Pass<unknown>>): Diagnostic[] {
  const diags: Diagnostic[] = []

  for (let i = 0; i < passes.length; i++) {
    const pass = passes[i]
    if (pass === null || pass === undefined) {
      diags.push({
        severity: 'error',
        code: DIAG_CODES.INVALID_PASS,
        message: `Pass at index ${i} is null or undefined`,
        pass: 'core',
      })
      continue
    }
    if (typeof pass.name !== 'string' || pass.name.length === 0) {
      diags.push({
        severity: 'error',
        code: DIAG_CODES.INVALID_PASS,
        message: `Pass at index ${i} has invalid name`,
        pass: 'core',
      })
    }
    if (typeof pass.run !== 'function') {
      diags.push({
        severity: 'error',
        code: DIAG_CODES.INVALID_PASS,
        message: `Pass "${pass.name}" at index ${i} has no run() method`,
        pass: 'core',
      })
    }
  }

  return diags
}

function validateIds(fragments: ReadonlyArray<ResolvedFragment<unknown>>): Diagnostic[] {
  const diags: Diagnostic[] = []
  const seen = new Set<string>()

  for (const f of fragments) {
    if (!f.id) {
      diags.push({
        severity: 'error',
        code: DIAG_CODES.EMPTY_ID,
        message: 'Fragment has empty id',
        pass: 'core',
      })
      continue
    }
    if (seen.has(f.id)) {
      diags.push({
        severity: 'error',
        code: DIAG_CODES.DUPLICATE_ID,
        message: `Duplicate fragment id "${f.id}"`,
        pass: 'core',
        fragmentId: f.id,
      })
    }
    seen.add(f.id)
  }

  return diags
}

function validateCapabilities(passes: ReadonlyArray<Pass<unknown>>): Diagnostic[] {
  const diags: Diagnostic[] = []
  const available = new Set<string>()

  for (let i = 0; i < passes.length; i++) {
    const pass = passes[i]
    // Invalid passes already reported by validatePasses
    if (!pass?.name) continue

    // Check requires
    if (pass.requires) {
      for (const cap of pass.requires) {
        if (!available.has(cap)) {
          diags.push({
            severity: 'error',
            code: DIAG_CODES.MISSING_CAPABILITY,
            message: `Pass "${pass.name}" requires capability "${cap}" which is not provided by any prior pass`,
            pass: pass.name,
          })
        }
      }
    }

    // Register provides
    if (pass.provides) {
      for (const cap of pass.provides) {
        available.add(cap)
      }
    }
  }

  return diags
}

// ── Pipeline Factory ───────────────────────────────────

export function pipeline<M = unknown>(
  passes: ReadonlyArray<Pass<M>>
): {
  run(
    input: ReadonlyArray<DataFragment<M>>,
    options?: RunOptions
  ): Promise<PipelineResult<M>>
} {
  // ── Construction-time validation ──────────────────────
  const constructionDiagnostics: Diagnostic[] = [
    ...validatePasses(passes as ReadonlyArray<Pass<unknown>>),
    ...validateCapabilities(passes as ReadonlyArray<Pass<unknown>>),
  ]

  if (passes.length === 0) {
    constructionDiagnostics.push({
      severity: 'info',
      code: DIAG_CODES.EMPTY_PIPELINE,
      message: 'Pipeline has no passes',
      pass: 'core',
    })
  }

  // If there are errors in construction diagnostics, throw
  const hasErrors = constructionDiagnostics.some((d) => d.severity === 'error')
  if (hasErrors) {
    const errorDiags = constructionDiagnostics.filter((d) => d.severity === 'error')
    throw new PipelineValidationError(
      `Pipeline construction failed with ${errorDiags.length} error(s)`,
      errorDiags.map((d) => ({ code: d.code, message: d.message }))
    )
  }

  return {
    async run(
      input: ReadonlyArray<DataFragment<M>>,
      options?: RunOptions
    ): Promise<PipelineResult<M>> {
      const snapshotMode = options?.snapshot ?? 'boundaries'
      const sinks = normalizeSinks(options?.sink)
      const allDiagnostics: Diagnostic[] = []

      // Helper: emit diagnostic to collection + sinks
      const emitDiagnostic = (diag: Diagnostic) => {
        allDiagnostics.push(diag)
        notifySinks(sinks, 'onDiagnostic', diag)
      }

      // ── Create scope BEFORE resolution (so thunks can access it) ──
      const scopeStore: Record<string, any> = { ...options?.initialScope }
      const scope = {
        get: (key: string) => scopeStore[key],
        set: (key: string, value: any) => { scopeStore[key] = value },
        has: (key: string) => Object.prototype.hasOwnProperty.call(scopeStore, key),
        get entries() { return Object.freeze({ ...scopeStore }) },
      }

      // ── Phase 1: Resolve all content (thunks receive scope) ──
      const resolvedStart = performance.now()
      let currentFragments: ResolvedFragment<M>[]

      try {
        currentFragments = await resolveFragments(input, scope)
      } catch (error) {
        throw new LoomError('Pipeline failed during resolution', error)
      }

      // Validate resolved ids
      const resolvedDiags = validateIds(currentFragments as ReadonlyArray<ResolvedFragment<unknown>>)
      for (const d of resolvedDiags) emitDiagnostic(d)

      const snapshots: PipelineSnapshot<M>[] = []
      const timings: PassTiming[] = []

      // ── Record resolution snapshot ─────────────────────
      if (snapshotMode !== 'off') {
        currentFragments = freezeFragments(currentFragments) as ResolvedFragment<M>[]
        snapshots.push({
          passName: 'ResolutionPass',
          fragments: currentFragments,
          scopeEntries: scope.entries,
          logs: [],
          diagnostics: [],
          mutations: [],
          durationMs: performance.now() - resolvedStart,
        })
      }

      // ── Phase 2: Run passes sequentially ───────────────
      for (let i = 0; i < passes.length; i++) {
        const pass = passes[i]!
        // Pass validity already checked at construction time; skip if somehow invalid
        if (!pass || typeof pass.run !== 'function') continue

        if (options?.signal?.aborted) {
          throw new PipelineCancelledError(pass.name, i)
        }

        // Emit unversioned-pass diagnostic
        if (!pass.version) {
          emitDiagnostic({
            severity: 'info',
            code: DIAG_CODES.UNVERSIONED_PASS,
            message: `Pass "${pass.name}" has no version — treated as uncacheable`,
            pass: pass.name,
          })
        }

        notifySinks(sinks, 'onPassStart', pass.name, i)

        const passStart = performance.now()
        const passLogs: PassLog[] = []
        const passDiags: Diagnostic[] = []

        // ── Build PassContext ────────────────────────────
        const signal = options?.signal
        const ctx: PassContext = {
          snapshots: Object.freeze([...snapshots]),
          scope,
          ...(signal !== undefined ? { signal } : {}),
          log: (message: string, data?: any) => {
            passLogs.push({
              level: 'info',
              message,
              data,
              timestamp: performance.now(),
            })
          },
          diagnose: (diag: Omit<Diagnostic, 'pass' | 'at'>) => {
            const full: Diagnostic = {
              ...diag,
              pass: pass.name,
              at: performance.now(),
            }
            passDiags.push(full)
            emitDiagnostic(full)
          },
        }

        try {
          const result = await pass.run(currentFragments, ctx)
          currentFragments = result
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)

          emitDiagnostic({
            severity: 'error',
            code: DIAG_CODES.PASS_THREW,
            message: `Pass "${pass.name}" threw: ${msg}`,
            pass: pass.name,
          })

          throw new PipelineError(
            `Pass "${pass.name}" threw an error`,
            pass.name,
            i,
            error,
            currentFragments
          )
        }

        const durationMs = performance.now() - passStart
        timings.push({ passName: pass.name, durationMs })

        // ── Compute mutations ──────────────────────────────
        const mutations: Mutation[] = snapshotMode !== 'off'
          ? computeMutation(
              snapshots.length > 0
                ? snapshots[snapshots.length - 1]!.fragments
                : currentFragments,
              currentFragments
            )
          : []

        // ── Record pass snapshot ──────────────────────────
        if (snapshotMode !== 'off') {
          currentFragments = freezeFragments(currentFragments) as ResolvedFragment<M>[]
          snapshots.push({
            passName: pass.name,
            fragments: currentFragments,
            scopeEntries: scope.entries,
            logs: Object.freeze(passLogs),
            diagnostics: Object.freeze(passDiags),
            mutations,
            durationMs,
          })
        }

        notifySinks(sinks, 'onPassEnd', {
          passName: pass.name,
          passIndex: i,
          durationMs,
          diagnostics: Object.freeze(passDiags),
          mutations,
        })
      }

      return {
        fragments: currentFragments,
        snapshots,
        constructionDiagnostics: Object.freeze(constructionDiagnostics),
        diagnostics: Object.freeze(allDiagnostics),
        timings: Object.freeze(timings),
        status: 'ok',
      }
    },
  }
}
