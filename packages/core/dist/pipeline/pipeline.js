import { runPasses } from './runner';
export function pipeline(passes) {
    return {
        run(fragments, options) {
            return runPasses({
                fragments,
                passes,
                ...(options ? { trace: options } : {}),
            });
        },
    };
}
//# sourceMappingURL=pipeline.js.map