import { cloneJson } from '../utils/clone';
export function cloneFragment(fragment) {
    return {
        id: fragment.id,
        content: fragment.content,
        meta: cloneJson(fragment.meta),
    };
}
export function cloneFragments(fragments) {
    return fragments.map((fragment) => cloneFragment(fragment));
}
//# sourceMappingURL=clone.js.map