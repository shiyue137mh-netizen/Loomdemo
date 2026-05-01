export class LoomError extends Error {
    cause;
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'LoomError';
    }
}
export class PipelineError extends LoomError {
    passName;
    passIndex;
    fragments;
    constructor(message, passName, passIndex, cause, fragments) {
        super(message, cause);
        this.passName = passName;
        this.passIndex = passIndex;
        this.fragments = fragments;
        this.name = 'PipelineError';
    }
}
export class PipelineValidationError extends LoomError {
    diagnostics;
    constructor(message, diagnostics) {
        super(message);
        this.diagnostics = diagnostics;
        this.name = 'PipelineValidationError';
    }
}
export function serializeError(error) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            ...(error.stack ? { stack: error.stack } : {}),
        };
    }
    return { name: 'Error', message: String(error) };
}
//# sourceMappingURL=errors.js.map