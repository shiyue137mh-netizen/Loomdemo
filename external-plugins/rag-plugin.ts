import { Pass } from '@loom/core';

/**
 * 外部开发者编写的 RAG 插件
 * 甚至不需要引用 @loom/st 的类型，只要符合 DataFragment 结构即可
 */
export function ExternalRagPass(options: { databaseUrl: string }): Pass {
  return {
    name: 'External.RagPlugin',
    run: async (fragments, ctx) => {
      ctx.log(`正在从外部数据库 [${options.databaseUrl}] 检索知识...`);
      
      // 模拟检索逻辑
      const retrievedKnowledge = [
        {
          id: 'rag-external-1',
          content: '【外部检索】这是来自第三方插件的知识库条目。',
          meta: { 
            kind: 'rag-retrieval', // 只要 kind 字符串对得上，就能触发官方的 Aggregate Pass
            author: '青子' 
          }
        }
      ];

      ctx.log('检索成功，已注入 1 条外部碎片。');
      
      return [...fragments, ...retrievedKnowledge];
    }
  };
}
