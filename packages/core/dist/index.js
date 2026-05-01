export { cloneFragment, cloneFragments } from './fragment/clone';
export { validateFragments } from './fragment/validate';
export { computeMutation, computeMutations } from './mutation/diff';
export { applyMutation, replayTrace } from './mutation/replay';
export { factoryDiagnostic, PassRegistry } from './pass/registry';
export { TraceCollector } from './trace/collector';
export { deserializeTrace, serializeTrace } from './trace/serialize';
export { annotateOwners, assertOwnerNotMutated, detectCrossOwnerWrites } from './owner/owner';
export { pipeline } from './pipeline/pipeline';
export { run, runPasses } from './pipeline/runner';
export { LoomError, PipelineError, PipelineValidationError, serializeError, } from './pipeline/errors';
//# sourceMappingURL=index.js.map