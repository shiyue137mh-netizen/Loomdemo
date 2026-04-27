import { Pass } from '@loom/core';

/**
 * 模拟外部开发的插件
 */
export const ExternalRagPass = (options: { databaseUrl: string }): Pass => {
  return {
    name: 'External.RagPlugin',
    run: async (fragments, ctx) => {
      ctx.log(`正在从外部数据库 [${options.databaseUrl}] 检索知识...`);
      
      const retrievedKnowledge = [
        {
          id: 'shared-rag-001', // 固定 ID，模拟可能冲突的知识点
          content: '【外部检索】这是来自第三方插件的知识库条目。',
          meta: { 
            kind: 'rag-retrieval',
            author: '青子' 
          }
        }
      ];

      ctx.log('检索成功，已注入 1 条外部碎片。');
      return [...fragments, ...retrievedKnowledge];
    }
  };
};
