import type { Fragment } from '../fragment/types';
import type { Trace } from '../trace/types';
import type { Mutation } from './types';
export declare function applyMutation<M>(fragments: readonly Fragment<M>[], mutation: Mutation, source: readonly Fragment<M>[]): Fragment<M>[];
export declare function replayTrace<M>(trace: Trace<M>, options?: {
    readonly untilPassIndex?: number;
}): Fragment<M>[];
//# sourceMappingURL=replay.d.ts.map