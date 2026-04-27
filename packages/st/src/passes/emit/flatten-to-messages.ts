import { Pass, ResolvedFragment } from '@loom/core';
import { StMeta } from '../../types.js';

/**
 * 将有序的碎片展平为 OpenAI 格式的消息数组
 */
export function FlattenToMessages(): Pass<StMeta> {
  return {
    name: 'ST.FlattenToMessages',
    run: (fragments) => {
      const messages: { role: string; content: string; name?: string }[] = [];
      
      for (const fragment of fragments) {
        const role = fragment.meta.role || 'user';
        const content = fragment.content;
        const name = fragment.meta.author;

        const lastMessage = messages[messages.length - 1];
        
        // 策略：如果连续两个碎片的角色相同，且发言人也一致，则合并内容
        if (lastMessage && lastMessage.role === role && lastMessage.name === name) {
          lastMessage.content += '\n\n' + content;
        } else {
          messages.push({
            role,
            content,
            ...(name ? { name } : {})
          });
        }
      }
      
      // M0 阶段产出一个包含最终 JSON 的单碎片
      return [{
        id: 'openai-messages',
        content: JSON.stringify(messages, null, 2),
        meta: { 
          kind: 'emit-result' as any,
          count: messages.length 
        } as any
      }];
    }
  };
}
