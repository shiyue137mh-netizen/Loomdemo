function asMetaRecord(meta) {
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
        return meta;
    }
    return {};
}
function ownerOf(fragment) {
    const owner = asMetaRecord(fragment.meta).__owner;
    return typeof owner === 'string' ? owner : undefined;
}
function withoutOwner(meta) {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta))
        return meta;
    const { __owner: _owner, ...rest } = meta;
    return rest;
}
function sameJson(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
function fragmentChanged(before, after) {
    return before.content !== after.content || !sameJson(withoutOwner(before.meta), withoutOwner(after.meta));
}
export function annotateOwners(before, after, passName) {
    const beforeIds = new Set(before.map((fragment) => fragment.id));
    return after.map((fragment) => {
        if (beforeIds.has(fragment.id))
            return fragment;
        const meta = asMetaRecord(fragment.meta);
        if (meta.__owner === undefined) {
            return {
                ...fragment,
                meta: { ...meta, __owner: passName },
            };
        }
        if (typeof meta.__owner !== 'string') {
            throw new Error(`Fragment "${fragment.id}" has non-string meta.__owner`);
        }
        return fragment;
    });
}
export function assertOwnerNotMutated(before, after) {
    const beforeById = new Map(before.map((fragment) => [fragment.id, fragment]));
    for (const next of after) {
        const previous = beforeById.get(next.id);
        if (!previous)
            continue;
        const previousOwner = ownerOf(previous);
        const nextOwner = ownerOf(next);
        if (previousOwner !== nextOwner) {
            throw new Error(`Fragment "${next.id}" meta.__owner cannot be modified`);
        }
    }
}
export function detectCrossOwnerWrites(before, after, passName) {
    const diagnostics = [];
    const beforeById = new Map(before.map((fragment) => [fragment.id, fragment]));
    for (const next of after) {
        const previous = beforeById.get(next.id);
        if (!previous)
            continue;
        const owner = ownerOf(previous);
        if (!owner || owner === passName || !fragmentChanged(previous, next))
            continue;
        diagnostics.push({
            severity: 'warning',
            code: 'loom/cross-owner-write',
            message: `Pass "${passName}" modified fragment "${next.id}" owned by "${owner}"`,
            pass: passName,
            fragmentId: next.id,
            meta: { owner },
        });
    }
    return diagnostics;
}
//# sourceMappingURL=owner.js.map