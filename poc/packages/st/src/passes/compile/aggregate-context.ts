import { Pass, ResolvedFragment } from '@loom/core';
import { StMeta } from '../../types.js';

/**
 * 按角色名称聚合碎片内容
 * 逻辑顺序：世界书 (WI) -> RAG 检索 -> 状态变量 (State)
 */
export function AggregateContextByAuthor(): Pass<StMeta> {
  return {
    name: 'ST.AggregateContextByAuthor',
    run: (fragments, ctx) => {
      // 1. 找出所有非聊天记录且有作者信息的碎片
      const targets = fragments.filter(f => 
        f.meta.kind !== 'chat-message' && 
        f.meta.author
      );
      
      const others = fragments.filter(f => 
        f.meta.kind === 'chat-message' || 
        !f.meta.author
      );

      // 2. 按作者分组
      const groups = new Map<string, ResolvedFragment<StMeta>[]>();
      for (const f of targets) {
        const author = f.meta.author!;
        if (!groups.has(author)) groups.set(author, []);
        groups.get(author)!.push(f);
      }

      // 3. 在每组内进行“三段式”重组
      const aggregatedFragments: ResolvedFragment<StMeta>[] = [];
      
      for (const [author, group] of groups.entries()) {
        ctx.log(`正在聚合角色 [${author}] 的上下文...`);
        
        const wi = group.filter(f => f.meta.kind === 'worldinfo-entry');
        const rag = group.filter(f => f.meta.kind === 'rag-retrieval');
        const state = group.filter(f => f.meta.kind === 'state-variable');
        const card = group.filter(f => f.meta.kind === 'character-card');

        // 拼接内容
        let combinedContent = '';
        
        if (card.length > 0) {
          combinedContent += `### 角色设定\n${card.map(f => f.content).join('\n')}\n\n`;
        }
        
        if (wi.length > 0) {
          combinedContent += `### 世界书设定\n${wi.map(f => f.content).join('\n')}\n\n`;
        }
        
        if (rag.length > 0) {
          combinedContent += `### 历史记忆回溯 (RAG)\n${rag.map(f => f.content).join('\n')}\n\n`;
        }
        
        if (state.length > 0) {
          combinedContent += `### 当前状态变量\n${state.map(f => f.content).join('\n')}\n\n`;
        }

        // 创建一个新的聚合碎片
        aggregatedFragments.push({
          id: `aggregated-${author}`,
          content: combinedContent.trim(),
          meta: {
            kind: 'character-card', // 聚合后视为角色卡的增强版
            role: 'system',
            author,
            depth: 0,
            order: 1 // 优先级极高，通常放在最前面
          }
        });
        
        ctx.log(`角色 [${author}] 聚合完成，包含 ${group.length} 个原始碎片。`);
      }

      // 4. 返回：剩余碎片 + 聚合后的碎片
      return [...others, ...aggregatedFragments];
    }
  };
}
