import { Pass, ResolvedFragment } from '@loom/core';
import { StMeta } from '../../types.js';

/**
 * 过滤掉所有标记为未激活 (active: false) 的世界书条目
 */
export function FilterInactive(): Pass<StMeta> {
  return {
    name: 'ST.FilterInactive',
    run: (fragments) => {
      return fragments.filter(fragment => {
        // 如果不是世界书条目，默认保留
        if (fragment.meta.kind !== 'worldinfo-entry') return true;
        
        // 只有 active 为 true 的才留下
        return fragment.meta.active === true;
      });
    }
  };
}
