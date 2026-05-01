import { pipeline } from '@loom/core';
import { 
  LoadCharacterCard, 
  AggregateContextByAuthor,
  FlattenToMessages 
} from '@loom/st';
import { DedupById } from '@loom/stdlib';

// 导入外部开发者的插件 (模拟脚本挂载)
import { ExternalRagPass } from '../external-plugin.ts';

// 1. 初始数据
const characterData = {
  name: '青子',
  description: '青子是一名温顺的蛇娘秘书。'
};

const internalRagFragment = {
  id: 'shared-rag-001', // 与外部插件产出的 ID 冲突！
  content: '【内部检索】这是来自系统内部自带的知识库。',
  meta: { kind: 'rag-retrieval', author: '青子' }
};

// 2. 组装 Pipeline
const pluginPipeline = pipeline([
  // 1. 官方 Source
  LoadCharacterCard(characterData),
  
  // 模拟注入一个内部碎片
  {
    name: 'Internal.KnowledgeInjection',
    run: (frags) => [...frags, internalRagFragment]
  },
  
  // 2. 外部第三方插件 (产出冲突 ID)
  ExternalRagPass({ databaseUrl: 'sqlite://external_rag.db' }),
  
  // 3. 通用工具：去重 (stdlib 发威)
  DedupById(),
  
  // 4. 官方聚合 Pass
  AggregateContextByAuthor(),
  
  // 5. 官方 Emit
  FlattenToMessages()
]);

// 3. 执行
async function runTest() {
  console.log('--- 正在启动插件挂载验证 (External Plugin Mount Test) ---\n');
  
  const result = await pluginPipeline.run([]);

  console.log('\n--- 流程执行日志 ---');
  result.snapshots.forEach(s => {
    if (s.logs.length > 0) {
      console.log(`[Pass: ${s.passName}]`);
      s.logs.forEach(l => console.log(`  > ${l.message}`));
    }
  });

  const finalFragment = result.fragments.find(f => f.id === 'openai-messages');
  if (finalFragment) {
    const messages = JSON.parse(finalFragment.content);
    console.log('\n--- 最终输出结果 ---');
    console.log(JSON.stringify(messages, null, 2));
    
    // 验证
    const systemMsg = messages.find((m: any) => m.role === 'system');
    if (systemMsg.content.includes('【外部检索】')) {
      console.log('\n✅ 验证成功：外部插件产生的碎片已被官方 Pipeline 正确处理并聚合！');
    }
  }
}

runTest().catch(console.error);
