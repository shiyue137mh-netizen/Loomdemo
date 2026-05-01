export function now() {
    return typeof performance === 'undefined' ? Date.now() : performance.now();
}
//# sourceMappingURL=time.js.map