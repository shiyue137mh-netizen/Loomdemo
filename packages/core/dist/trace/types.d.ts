import type { Diagnostic } from '../diagnostic/types';
import type { Fragment } from '../fragment/types';
import type { Mutation } from '../mutation/types';
import type { PassConfig } from '../pass/types';
export type TraceMode = 'on' | 'off';
export type SnapshotMode = 'off' | 'boundaries' | 'after-only';
export interface TraceOptions {
    readonly mode?: TraceMode;
    readonly snapshot?: SnapshotMode;
    readonly sink?: TraceSink | readonly TraceSink[];
}
export interface TraceSink {
    onPassStart?(passName: string, passIndex: number): void;
    onPassEnd?(execution: TraceExecution): void;
    onDiagnostic?(diagnostic: Diagnostic): void;
}
export interface TraceExecution<M = unknown> {
    readonly passName: string;
    readonly passIndex: number;
    readonly durationMs: number;
    readonly diagnostics: readonly Diagnostic[];
    readonly mutations: readonly Mutation[];
    readonly afterFragments: readonly Fragment<M>[];
    readonly snapshot?: {
        readonly before?: readonly Fragment<M>[];
        readonly after?: readonly Fragment<M>[];
    };
}
export interface Trace<M = unknown> {
    readonly version: '1';
    readonly mode: TraceMode;
    readonly initialFragments: readonly Fragment<M>[];
    readonly finalFragments: readonly Fragment<M>[];
    readonly passConfigs?: readonly PassConfig[];
    readonly executions: readonly TraceExecution<M>[];
    readonly diagnostics: readonly Diagnostic[];
}
//# sourceMappingURL=types.d.ts.map