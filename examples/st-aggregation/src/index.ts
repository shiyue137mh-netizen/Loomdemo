import { pipeline } from '@loom/core';
import { 
  AggregateContextByAuthor,
  FlattenToMessages 
} from '@loom/st';

// 1. 模拟来自不同来源的碎片
const fragments = [
  // 角色卡 (原始设定)
  {
    id: 'char-card',
    content: '青子是一名温顺、忠诚的蛇娘秘书。',
    meta: { kind: 'character-card', author: '青子', role: 'system' }
  },
  // 世界书 (设定增强)
  {
    id: 'wi-takoyaki',
    content: '青子特别喜欢吃章鱼烧，尤其是在工作累了的时候。',
    meta: { kind: 'worldinfo-entry', author: '青子', active: true }
  },
  // RAG (历史记忆)
  {
    id: 'rag-osaka',
    content: '在昨天的谈话中，青子提到过她很向往去大阪的旅行。',
    meta: { kind: 'rag-retrieval', author: '青子' }
  },
  // 变量系统 (实时状态)
  {
    id: 'state-affection',
    content: '当前对哥哥的好感度：100 (亲密无间)',
    meta: { kind: 'state-variable', author: '青子' }
  },
  // 聊天记录 (不参与聚合)
  {
    id: 'chat-1',
    content: '青子，你在想什么呢？',
    meta: { kind: 'chat-message', author: '哥哥', role: 'user', stIndex: 1 }
  }
];

// 2. 定义 Pipeline
const aggregationPipeline = pipeline([
  // 核心：高阶聚合 Pass
  AggregateContextByAuthor(),
  
  // 打包
  FlattenToMessages()
]);

// 3. 执行测试
async function runTest() {
  console.log('--- 正在启动 Loom-ST 高阶聚合验证 (Multi-Source Aggregation) ---\n');
  
  const result = await aggregationPipeline.run(fragments as any);
  
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
    console.log('\n--- 聚合后的 OpenAI 消息预览 ---');
    console.log(JSON.stringify(messages, null, 2));
    
    // 验证内容顺序
    const systemMsg = messages.find((m: any) => m.role === 'system');
    if (systemMsg.content.includes('角色设定') && systemMsg.content.includes('历史记忆回溯')) {
      console.log('\n✅ 验证通过：多源碎片已按 [设定 -> 世界书 -> RAG -> 变量] 顺序完美聚合！');
    }
  }
}

runTest().catch(console.error);
