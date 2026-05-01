import { Pass, ResolvedFragment } from '@loom/core';
import { StMeta } from '../../types.js';

/**
 * 扫描聊天记录并激活对应的世界书条目 (支持递归激活)
 */
export function ActivateWorldInfo(options?: { maxIterations?: number }): Pass<StMeta> {
  const maxIterations = options?.maxIterations ?? 10;

  return {
    name: 'ST.ActivateWorldInfo',
    run: (fragments, ctx) => {
      let currentFragments = [...fragments];
      let changed = true;
      let iterations = 0;

      // 递归激活逻辑
      while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        ctx.log(`开始第 ${iterations} 轮世界书扫描...`);

        // 1. 构建当前的“扫描缓冲区”
        const activeWIs = currentFragments.filter(f => f.meta.kind === 'worldinfo-entry' && f.meta.active);
        ctx.log(`当前活跃世界书条目数: ${activeWIs.length}`);
        
        const scanText = currentFragments
          .filter(f => 
            f.meta.kind === 'chat-message' || 
            (f.meta.kind === 'worldinfo-entry' && f.meta.active)
          )
          .map(f => f.content)
          .join('\n');

        // 2. 尝试激活新的条目
        currentFragments = currentFragments.map(fragment => {
          if (fragment.meta.kind !== 'worldinfo-entry') return fragment;
          if (fragment.meta.active) return fragment; // 已经激活的跳过

          const keys: string[] = fragment.meta.extra?.keys || [];
          let matchedKey = '';
          const isMatched = keys.some(key => {
            if (!key) return false;
            if (scanText.includes(key)) {
              matchedKey = key;
              return true;
            }
            return false;
          });

          if (isMatched) {
            changed = true;
            
            // 提取命中位置的上下文 (前后 20 个字符)
            const matchIndex = scanText.indexOf(matchedKey);
            const start = Math.max(0, matchIndex - 15);
            const end = Math.min(scanText.length, matchIndex + matchedKey.length + 15);
            const context = scanText.substring(start, end).replace(/\n/g, ' ');
            
            const entryName = fragment.meta.extra?.comment || fragment.id.substring(0, 8);
            ctx.log(`WI_ACTIVATE: [${entryName}]`, {
              keyword: matchedKey,
              context: `...${context}...`
            });
            
            return {
              ...fragment,
              meta: { ...fragment.meta, active: true }
            };
          }

          return fragment;
        });
      }

      if (iterations >= maxIterations) {
        ctx.log('⚠️ 达到最大递归深度，扫描停止。', { iterations });
      } else {
        ctx.log(`扫描结束，共执行 ${iterations} 轮。`);
      }

      return currentFragments;
    }
  };
}
