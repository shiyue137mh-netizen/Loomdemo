import type { Diagnostic } from '../diagnostic/types';
import type { Fragment } from '../fragment/types';
export type OwnerMeta = Record<string, unknown> & {
    __owner?: string;
};
export declare function annotateOwners<M>(before: readonly Fragment<M>[], after: readonly Fragment<M>[], passName: string): Fragment<M>[];
export declare function assertOwnerNotMutated<M>(before: readonly Fragment<M>[], after: readonly Fragment<M>[]): void;
export declare function detectCrossOwnerWrites<M>(before: readonly Fragment<M>[], after: readonly Fragment<M>[], passName: string): Diagnostic[];
//# sourceMappingURL=owner.d.ts.map