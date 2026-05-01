import type { Fragment } from '../fragment/types';
import type { Pass } from '../pass/types';
import type { TraceOptions } from '../trace/types';
import type { RunResult } from './runner';
export interface Pipeline<M = unknown> {
    run(fragments: readonly Fragment<M>[], options?: TraceOptions): RunResult<M>;
}
export declare function pipeline<M = unknown>(passes: readonly Pass<M>[]): Pipeline<M>;
//# sourceMappingURL=pipeline.d.ts.map