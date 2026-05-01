import type { Fragment } from '../fragment/types';
import type { Mutation } from './types';
export declare function computeMutations<M>(before: readonly Fragment<M>[], after: readonly Fragment<M>[]): Mutation[];
export declare const computeMutation: typeof computeMutations;
//# sourceMappingURL=diff.d.ts.map