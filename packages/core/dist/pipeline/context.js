import { now } from '../utils/time';
export function createPassContext(input) {
    return {
        passName: input.passName,
        passIndex: input.passIndex,
        diagnose(diagnostic) {
            input.diagnostics.push({
                ...diagnostic,
                pass: input.passName,
                at: now(),
            });
        },
        log(message, data) {
            input.logs.push({ message, data, at: now() });
        },
    };
}
//# sourceMappingURL=context.js.map