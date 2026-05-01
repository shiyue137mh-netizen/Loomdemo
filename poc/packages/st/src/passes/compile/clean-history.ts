import { Pass } from '@loom/core';
import { StMeta } from '../../types.js';

/**
 * 清洗所有的 <think> 思维链内容
 */
export function CleanThinkingPass(): Pass<StMeta> {
  return {
    name: 'ST.CleanThinking',
    run: (fragments, ctx) => {
      ctx.log('正在清理所有思维链 (<think>)...');
      let cleanCount = 0;

      const result = fragments.map(f => {
        if (f.meta.kind !== 'chat-message') return f;
        
        const originalContent = f.content;
        // 使用正则匹配 <think>...</think>，包括换行符
        const cleanedContent = originalContent.replace(/<think>[\s\S]*?<\/think>/g, '');
        
        if (cleanedContent !== originalContent) {
          cleanCount++;
          return { ...f, content: cleanedContent.trim() };
        }
        return f;
      });

      ctx.log(`思维链清理完成，共清洗 ${cleanCount} 条消息。`);
      return result;
    }
  };
}

/**
 * 角色状态裁剪：只保留最近的 N 层 <角色状态>
 */
export function PruneStatusPass(options: { keepRecent: number }): Pass<StMeta> {
  const { keepRecent } = options;

  return {
    name: 'ST.PruneStatus',
    run: (fragments, ctx) => {
      ctx.log(`正在进行角色状态裁剪，保留最近的 ${keepRecent} 层...`);
      
      let foundCount = 0;
      // 我们需要倒着遍历碎片，因为“最近”的在后面
      const reversedResult = [...fragments].reverse().map(f => {
        if (f.meta.kind !== 'chat-message') return f;

        const tagRegex = /<角色状态>[\s\S]*?<\/角色状态>/g;
        const matches = f.content.match(tagRegex);

        if (matches) {
          let content = f.content;
          // 如果这块碎片里有状态标记
          if (foundCount >= keepRecent) {
            // 已经超过配额了，把这块碎片里的所有状态标记删掉
            content = content.replace(tagRegex, '').trim();
            ctx.log(`  - 移除了旧碎片 [${f.id.substring(0, 8)}] 中的状态标记`);
          } else {
            // 还没超过配额，记录一下发现了多少个标记
            foundCount += matches.length;
            // 如果加完之后刚好跨过了界限，我们需要特殊处理这一块（比如这块里有 3 个，但我们只需要 1 个）
            if (foundCount > keepRecent) {
              const overCount = foundCount - keepRecent;
              // 比较复杂，简单处理：只要这一块里包含了让它超出的标记，我们就从这一块开始往前的都删掉
              // 这里简化处理为：一旦达到配额，这一块之后的全部干掉
            }
          }
          return { ...f, content };
        }
        return f;
      });

      return reversedResult.reverse();
    }
  };
}
