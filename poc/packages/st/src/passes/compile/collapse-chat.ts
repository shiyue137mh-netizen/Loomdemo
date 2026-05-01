import { Pass, ResolvedFragment } from '@loom/core';
import { StMeta } from '../../types.js';

/**
 * 将所有分散的聊天记录碎片合并为单条 User 消息
 * 这可以用于节省 Token 或改变模型的感知方式
 */
export function CollapseChatToUser(): Pass<StMeta> {
  return {
    name: 'ST.CollapseChatToUser',
    run: (fragments) => {
      // 1. 找出所有的聊天记录
      const chatFragments = fragments.filter(f => f.meta.kind === 'chat-message');
      const otherFragments = fragments.filter(f => f.meta.kind !== 'chat-message');

      if (chatFragments.length === 0) return [...fragments];

      // 2. 合并内容
      const collapsedContent = chatFragments
        .map(f => `${f.meta.author || '未知'}: ${f.content}`)
        .join('\n\n');

      // 3. 创建合并后的碎片
      const collapsedFragment: ResolvedFragment<StMeta> = {
        id: 'collapsed-chat-history',
        content: `--- 以下是之前的对话记录 ---\n\n${collapsedContent}`,
        meta: {
          kind: 'chat-message',
          role: 'user',
          author: 'System',
          depth: 1, // 作为一个整体插在末尾附近
          stIndex: 9999 // 确保在排序时排在最后
        }
      };

      // 4. 返回：非聊天碎片 + 合并后的碎片
      return [...otherFragments, collapsedFragment];
    }
  };
}
