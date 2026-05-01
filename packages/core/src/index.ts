export type { Fragment } from './fragment/types'
export { cloneFragment, cloneFragments } from './fragment/clone'
export { validateFragments } from './fragment/validate'

export type { Diagnostic, DiagnosticInput, DiagnosticSeverity } from './diagnostic/types'

export type { Mutation } from './mutation/types'
export { computeMutation, computeMutations } from './mutation/diff'
export { applyMutation, replayTrace } from './mutation/replay'

export type {
  Capability,
  FieldPath,
  Pass,
  PassConfig,
  PassContext,
  PassFactory,
} from './pass/types'
export { factoryDiagnostic, PassRegistry } from './pass/registry'

export type {
  SnapshotMode,
  Trace,
  TraceExecution,
  TraceMode,
  TraceOptions,
  TraceSink,
} from './trace/types'
export { TraceCollector } from './trace/collector'
export { deserializeTrace, deserializeTraceChecked, serializeTrace } from './trace/serialize'

export { annotateOwners, assertOwnerNotMutated, detectCrossOwnerWrites } from './owner/owner'

export { pipeline } from './pipeline/pipeline'
export type { Pipeline } from './pipeline/pipeline'
export { run, runPasses } from './pipeline/runner'
export type { RunConfig, RunResult } from './pipeline/runner'
export {
  LoomError,
  PipelineError,
  PipelineValidationError,
  serializeError,
} from './pipeline/errors'
export type { SerializedError } from './pipeline/errors'
