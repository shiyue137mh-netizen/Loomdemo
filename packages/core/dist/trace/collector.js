import { cloneFragments } from '../fragment/clone';
function normalizeSinks(sink) {
    if (!sink)
        return [];
    return Array.isArray(sink) ? sink : [sink];
}
function notifySink(sinks, method, ...args) {
    for (const sink of sinks) {
        const fn = sink[method];
        if (typeof fn === 'function') {
            try {
                ;
                fn(...args);
            }
            catch {
                // Trace sinks must not affect Core execution.
            }
        }
    }
}
export class TraceCollector {
    initialFragments;
    options;
    passConfigs;
    mode;
    snapshotMode;
    sinks;
    executions = [];
    diagnostics = [];
    finalFragments = [];
    constructor(initialFragments, options = {}, passConfigs) {
        this.initialFragments = initialFragments;
        this.options = options;
        this.passConfigs = passConfigs;
        this.mode = options.mode ?? 'on';
        this.snapshotMode = options.snapshot ?? 'off';
        this.sinks = normalizeSinks(options.sink);
    }
    startPass(passName, passIndex) {
        if (this.mode === 'off')
            return;
        notifySink(this.sinks, 'onPassStart', passName, passIndex);
    }
    addDiagnostic(diagnostic) {
        this.diagnostics.push(diagnostic);
        if (this.mode === 'off')
            return;
        notifySink(this.sinks, 'onDiagnostic', diagnostic);
    }
    endPass(input) {
        if (this.mode === 'off')
            return;
        const execution = {
            passName: input.passName,
            passIndex: input.passIndex,
            durationMs: input.durationMs,
            diagnostics: [...input.diagnostics],
            mutations: [...input.mutations],
            afterFragments: cloneFragments(input.afterFragments),
            ...(this.snapshotMode !== 'off'
                ? {
                    snapshot: {
                        ...(this.snapshotMode === 'boundaries'
                            ? { before: cloneFragments(input.beforeFragments) }
                            : {}),
                        after: cloneFragments(input.afterFragments),
                    },
                }
                : {}),
        };
        this.executions.push(execution);
        notifySink(this.sinks, 'onPassEnd', execution);
    }
    endTrace(finalFragments) {
        this.finalFragments = cloneFragments(finalFragments);
        return {
            version: '1',
            mode: this.mode,
            initialFragments: this.mode === 'off' ? [] : cloneFragments(this.initialFragments),
            finalFragments: this.mode === 'off' ? [] : this.finalFragments,
            ...(this.passConfigs ? { passConfigs: this.passConfigs } : {}),
            executions: this.mode === 'off' ? [] : [...this.executions],
            diagnostics: [...this.diagnostics],
        };
    }
}
//# sourceMappingURL=collector.js.map