import type { Diagnostic } from '../diagnostic/types';
import type { Fragment } from '../fragment/types';
import type { Mutation } from '../mutation/types';
import type { PassConfig } from '../pass/types';
import type { Trace, TraceOptions } from './types';
export declare class TraceCollector<M = unknown> {
    private readonly initialFragments;
    private readonly options;
    private readonly passConfigs?;
    private readonly mode;
    private readonly snapshotMode;
    private readonly sinks;
    private readonly executions;
    private readonly diagnostics;
    private finalFragments;
    constructor(initialFragments: readonly Fragment<M>[], options?: TraceOptions, passConfigs?: readonly PassConfig[] | undefined);
    startPass(passName: string, passIndex: number): void;
    addDiagnostic(diagnostic: Diagnostic): void;
    endPass(input: {
        readonly passName: string;
        readonly passIndex: number;
        readonly durationMs: number;
        readonly diagnostics: readonly Diagnostic[];
        readonly mutations: readonly Mutation[];
        readonly beforeFragments: readonly Fragment<M>[];
        readonly afterFragments: readonly Fragment<M>[];
    }): void;
    endTrace(finalFragments: readonly Fragment<M>[]): Trace<M>;
}
//# sourceMappingURL=collector.d.ts.map