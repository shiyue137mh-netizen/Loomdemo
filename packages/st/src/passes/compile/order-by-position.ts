import { Pass, ResolvedFragment } from '@loom/core';
import { StMeta } from '../../types.js';

/**
 * 根据 SillyTavern 的 depth 和 order 逻辑对碎片进行排序和注入
 */
export function OrderByPosition(): Pass<StMeta> {
  return {
    name: 'ST.OrderByPosition',
    run: (fragments) => {
      // 1. 提取并排序基础聊天记录 (作为锚点)
      const chatMessages = fragments
        .filter(f => f.meta.kind === 'chat-message')
        .sort((a, b) => (a.meta.stIndex ?? 0) - (b.meta.stIndex ?? 0));
      
      // 2. 提取需要注入的其他碎片 (人设、世界书、预设等)
      const injections = fragments
        .filter(f => f.meta.kind !== 'chat-message')
        // 先按 depth 升序，再按 order 升序
        .sort((a, b) => {
          const depthA = a.meta.depth ?? 0;
          const depthB = b.meta.depth ?? 0;
          if (depthA !== depthB) return depthA - depthB;
          return (a.meta.order ?? 100) - (b.meta.order ?? 100);
        });

      // 3. 构建结果数组
      const result: ResolvedFragment<StMeta>[] = [...chatMessages];

      // 4. 执行注入逻辑
      // 我们从后往前处理 injection，或者在插入时计算偏移
      // 为了逻辑清晰，我们维护一个当前的 result 状态
      
      // 注意：ST 的 depth 定义：
      // 0: 绝对头部
      // 1: 倒数第1条消息之前
      // N: 倒数第N条消息之前
      
      // 我们先处理 depth 0 的 (它们会排在最前面)
      const depth0 = injections.filter(i => (i.meta.depth ?? 0) === 0);
      result.unshift(...depth0);

      // 再处理 depth > 0 的
      const depthN = injections.filter(i => (i.meta.depth ?? 0) > 0);
      
      for (const fragment of depthN) {
        const depth = fragment.meta.depth!;
        
        const firstChatIndex = result.findIndex(r => r.meta.kind === 'chat-message');
        if (firstChatIndex === -1) {
          result.push(fragment);
          continue;
        }

        // ST 逻辑：injection_index = chat.length - depth
        // 例如：len=10, depth=1, index=9 (即最后一条消息之前)
        const targetIndex = firstChatIndex + Math.max(0, chatMessages.length - depth);
        
        // 边界处理：不能超出当前聊天范围
        const safeIndex = Math.max(firstChatIndex, Math.min(targetIndex, result.length));
        
        result.splice(safeIndex, 0, fragment);
      }

      return result;
    }
  };
}
