export function computeMutations(before, after) {
    const mutations = [];
    const beforeById = new Map();
    for (let i = 0; i < before.length; i++) {
        const fragment = before[i];
        if (fragment)
            beforeById.set(fragment.id, { index: i, content: fragment.content });
    }
    for (let i = 0; i < after.length; i++) {
        const fragment = after[i];
        if (!fragment)
            continue;
        const previous = beforeById.get(fragment.id);
        if (!previous) {
            mutations.push({ op: 'add', fragmentId: fragment.id, index: i });
        }
        else if (previous.index !== i) {
            mutations.push({
                op: 'move',
                fragmentId: fragment.id,
                fromIndex: previous.index,
                toIndex: i,
            });
        }
        else if (previous.content !== fragment.content) {
            mutations.push({
                op: 'update',
                fragmentId: fragment.id,
                beforeContent: previous.content,
                afterContent: fragment.content,
            });
        }
        beforeById.delete(fragment.id);
    }
    for (const [fragmentId, info] of beforeById) {
        mutations.push({ op: 'remove', fragmentId, index: info.index });
    }
    return mutations;
}
export const computeMutation = computeMutations;
//# sourceMappingURL=diff.js.map