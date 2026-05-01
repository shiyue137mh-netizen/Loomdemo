export function cloneJson(value) {
    if (value === undefined)
        return value;
    return JSON.parse(JSON.stringify(value));
}
//# sourceMappingURL=clone.js.map