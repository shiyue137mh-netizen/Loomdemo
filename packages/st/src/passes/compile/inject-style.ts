import { Pass, ResolvedFragment } from '@loom/core';
import { StMeta } from '../../types.js';

/**
 * 将激活的“文风”世界书条目注入到系统提示词中
 */
export function InjectStyleToSystem(): Pass<StMeta> {
  return {
    name: 'ST.InjectStyleToSystem',
    run: (fragments) => {
      // 1. 寻找激活的文风片段 (假设关键词里包含“文风”)
      const styleFragment = fragments.find(f => 
        f.meta.kind === 'worldinfo-entry' && 
        f.meta.active && 
        f.content.includes('【文风指南】')
      );

      if (!styleFragment) return [...fragments];

      // 2. 寻找系统提示词片段 (通常是角色描述或预设主提示词)
      // 在这个例子中，我们找 ID 为 'char-description' 的片段进行增强
      return fragments.map(f => {
        if (f.id === 'char-description') {
          return {
            ...f,
            content: `${f.content}\n\n写作风格要求：${styleFragment.content}`
          };
        }
        
        // 3. 剔除原有的文风碎片，避免重复
        if (f.id === styleFragment.id) {
          return null as any; 
        }

        return f;
      }).filter(f => f !== null);
    }
  };
}
