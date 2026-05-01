import type { Fragment } from '../fragment/types';
export interface SerializedError {
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
}
export declare class LoomError extends Error {
    readonly cause?: unknown | undefined;
    constructor(message: string, cause?: unknown | undefined);
}
export declare class PipelineError extends LoomError {
    readonly passName: string;
    readonly passIndex: number;
    readonly fragments?: readonly Fragment[] | undefined;
    constructor(message: string, passName: string, passIndex: number, cause?: unknown, fragments?: readonly Fragment[] | undefined);
}
export declare class PipelineValidationError extends LoomError {
    readonly diagnostics: readonly {
        readonly code: string;
        readonly message: string;
    }[];
    constructor(message: string, diagnostics: readonly {
        readonly code: string;
        readonly message: string;
    }[]);
}
export declare function serializeError(error: unknown): SerializedError;
//# sourceMappingURL=errors.d.ts.map