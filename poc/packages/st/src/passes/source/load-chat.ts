import { Pass, ResolvedFragment } from '@loom/core';
import { StMeta } from '../../types.js';

/**
 * 将 SillyTavern 的聊天记录转换为 DataFragment
 * @param chat ST 的原始 chat 数组
 */
export function LoadChat(chat: any[]): Pass<StMeta> {
  return {
    name: 'ST.LoadChat',
    run: (fragments) => {
      const chatFragments: ResolvedFragment<StMeta>[] = chat.map((msg, index) => {
        // 基础角色映射
        let role: StMeta['role'] = msg.is_user ? 'user' : 'assistant';
        
        // 特殊处理 Narrator 消息类型
        // 在 ST 中，extra.type 为 1 (NARRATOR) 的消息通常作为系统提示
        if (msg.extra?.type === 1 || msg.extra?.type === 'narrator') {
          role = 'system';
        }

        return {
          id: `msg-${index}-${Date.now()}`,
          content: (msg.mes || '').replace(/\r/gm, ''), // 清理回车符
          meta: {
            kind: 'chat-message',
            role,
            author: msg.name,
            stIndex: index,
            extra: msg.extra,
            // 聊天记录默认深度为正数，对应倒数位置
            // 在排序 Pass 中会用到
            depth: chat.length - index
          }
        };
      });

      return [...fragments, ...chatFragments];
    }
  };
}
