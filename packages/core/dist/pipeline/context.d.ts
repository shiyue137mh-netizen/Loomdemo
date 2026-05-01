import type { Diagnostic } from '../diagnostic/types';
import type { PassContext } from '../pass/types';
export declare function createPassContext(input: {
    readonly passName: string;
    readonly passIndex: number;
    readonly diagnostics: Diagnostic[];
    readonly logs: {
        readonly message: string;
        readonly data?: unknown;
        readonly at: number;
    }[];
}): PassContext;
//# sourceMappingURL=context.d.ts.map