// ── Content ────────────────────────────────────────────

/** Context provided to lazy thunks at resolution time */
export interface ResolveContext {
  readonly scope: Scope
  readonly fragmentId: string
}

export type Content =
  | string
  | Promise<string>
  | ((ctx: ResolveContext) => string | Promise<string>)

// ── Fragment ───────────────────────────────────────────

export interface DataFragment<M = unknown> {
  readonly id: string
  readonly content: Content
  readonly meta: M
}

export interface ResolvedFragment<M = unknown> {
  readonly id: string
  readonly content: string
  readonly meta: M
}

// ── Scope ──────────────────────────────────────────────

export interface Scope {
  get<T = any>(key: string): T | undefined
  set(key: string, value: any): void
  has(key: string): boolean
  readonly entries: Readonly<Record<string, any>>
}

// ── Log ────────────────────────────────────────────────

export interface PassLog {
  readonly level: 'info' | 'warn' | 'error' | 'debug'
  readonly message: string
  readonly data?: any
  readonly timestamp: number
}

// ── Diagnostic ─────────────────────────────────────────

export type DiagnosticLevel = 'error' | 'warning' | 'info' | 'hint'

export interface Diagnostic {
  readonly severity: DiagnosticLevel
  readonly code: string
  readonly message: string
  readonly pass: string
  readonly fragmentId?: string
  readonly at?: number
  readonly meta?: Record<string, unknown>
  readonly relatedFragmentIds?: string[]
}

// ── Mutation ───────────────────────────────────────────

export type Mutation =
  | { readonly op: 'add';    readonly fragmentId: string; readonly index: number }
  | { readonly op: 'remove'; readonly fragmentId: string; readonly index: number }
  | { readonly op: 'update'; readonly fragmentId: string; readonly beforeContent: string; readonly afterContent: string }
  | { readonly op: 'move';   readonly fragmentId: string; readonly fromIndex: number; readonly toIndex: number }

// ── Pass Capabilities ──────────────────────────────────

export type FieldPath = string   // e.g. 'content', 'meta.priority'
export type Capability = string  // e.g. 'resolved', 'sorted', 'deduped'

// ── Pass ───────────────────────────────────────────────

export interface Pass<M = unknown> {
  readonly name: string

  /** Algorithm version for cache keying. Unversioned passes are treated as uncacheable. */
  readonly version?: string

  /** Fields this pass reads (declarative, optional) */
  readonly reads?: FieldPath[]

  /** Fields this pass writes (declarative, optional) */
  readonly writes?: FieldPath[]

  /** Capabilities this pass requires from prior passes */
  readonly requires?: Capability[]

  /** Capabilities this pass provides to subsequent passes */
  readonly provides?: Capability[]

  run(
    fragments: ReadonlyArray<ResolvedFragment<M>>,
    ctx: PassContext
  ): ResolvedFragment<M>[] | Promise<ResolvedFragment<M>[]>
}

// ── PassContext ────────────────────────────────────────

export interface PassContext {
  readonly signal?: AbortSignal
  readonly snapshots: ReadonlyArray<PipelineSnapshot>
  readonly scope: Scope

  /** Legacy log method — kept for backward compat with existing passes.
   *  New code should prefer ctx.diagnose() for structured diagnostics. */
  readonly log: (message: string, data?: any) => void

  /** Emit a structured diagnostic from within a pass */
  readonly diagnose: (diag: Omit<Diagnostic, 'pass' | 'at'>) => void
}

// ── Snapshot ───────────────────────────────────────────

export interface PipelineSnapshot<M = unknown> {
  readonly passName: string
  readonly fragments: ReadonlyArray<ResolvedFragment<M>>
  readonly scopeEntries: Readonly<Record<string, any>>
  readonly logs: ReadonlyArray<PassLog>
  readonly diagnostics: ReadonlyArray<Diagnostic>
  readonly mutations: ReadonlyArray<Mutation>
  readonly durationMs: number
}

// ── Timing ─────────────────────────────────────────────

export interface PassTiming {
  readonly passName: string
  readonly durationMs: number
}

// ── Snapshot Mode ──────────────────────────────────────

export type SnapshotMode =
  | 'off'
  | 'boundaries'
  | 'after-only'

// ── TraceSink ──────────────────────────────────────────

export interface TraceSink {
  onPassStart?(passName: string, passIndex: number): void
  onPassEnd?(execution: {
    passName: string
    passIndex: number
    durationMs: number
    diagnostics: ReadonlyArray<Diagnostic>
    mutations: ReadonlyArray<Mutation>
  }): void
  onDiagnostic?(diagnostic: Diagnostic): void
}

// ── Run Options ────────────────────────────────────────

export interface RunOptions {
  readonly signal?: AbortSignal
  readonly snapshot?: SnapshotMode
  readonly sink?: TraceSink | ReadonlyArray<TraceSink>
  /** Pre-populated scope values available during content resolution */
  readonly initialScope?: Readonly<Record<string, unknown>>
}

// ── Run Result ─────────────────────────────────────────

export interface PipelineResult<M = unknown> {
  readonly fragments: ReadonlyArray<ResolvedFragment<M>>

  /** Legacy: flat array of all snapshots. Present iff snapshot !== 'off'. */
  readonly snapshots: ReadonlyArray<PipelineSnapshot<M>>

  /** Diagnostics from pipeline construction (capability checks, empty pipeline, etc.) */
  readonly constructionDiagnostics: ReadonlyArray<Diagnostic>

  /** All runtime diagnostics collected across the run */
  readonly diagnostics: ReadonlyArray<Diagnostic>

  /** Per-pass timing breakdown */
  readonly timings: ReadonlyArray<PassTiming>

  readonly status: 'ok' | 'cancelled' | 'error'
  readonly error?: unknown
}
