import type { Diagnostic } from '../diagnostic/types';
import type { Fragment } from '../fragment/types';
import type { Pass, PassConfig } from '../pass/types';
import { PassRegistry } from '../pass/registry';
import type { Trace, TraceOptions } from '../trace/types';
import { type SerializedError } from './errors';
export interface RunConfig<M = unknown> {
    readonly fragments: readonly Fragment<M>[];
    readonly passes: readonly PassConfig[];
    readonly registry: PassRegistry<M>;
    readonly trace?: TraceOptions;
}
export interface RunResult<M = unknown> {
    readonly fragments: readonly Fragment<M>[];
    readonly trace: Trace<M>;
    readonly diagnostics: readonly Diagnostic[];
    readonly status: 'ok' | 'error';
    readonly error?: SerializedError;
}
export declare function run<M = unknown>(config: RunConfig<M>): RunResult<M>;
export declare function runPasses<M = unknown>(input: {
    readonly fragments: readonly Fragment<M>[];
    readonly passes: readonly Pass<M>[];
    readonly trace?: TraceOptions;
    readonly passConfigs?: readonly PassConfig[];
}): RunResult<M>;
//# sourceMappingURL=runner.d.ts.map